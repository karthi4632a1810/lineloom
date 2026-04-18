import { Department } from "../models/Department.js";
import { AlertEvent } from "../models/AlertEvent.js";
import { getLiveQueue } from "./tokenService.js";

const DEDUPE_MS = 20 * 60 * 1000;

const recentDuplicate = async ({ type, department, token_id }) => {
  const since = new Date(Date.now() - DEDUPE_MS);
  return AlertEvent.findOne({
    type,
    department,
    token_id: token_id ?? null,
    createdAt: { $gte: since },
    acknowledged_at: null
  }).lean();
};

const pushAlert = async ({ type, department, token_id, message, severity = "warn" }) => {
  if (await recentDuplicate({ type, department, token_id })) {
    return null;
  }
  return AlertEvent.create({ type, department, token_id, message, severity });
};

export const evaluateAndPersistAlerts = async () => {
  const departments = await Department.find({ is_active: true }).lean();
  const liveRows = await getLiveQueue({});

  for (const dept of departments) {
    const rules = dept.alert_rules ?? {};
    const maxDepth = rules.max_queue_depth;
    const maxWait = rules.max_wait_minutes;
    const maxLab = rules.max_lab_stuck_minutes;
    const name = dept.name;

    const inDept = liveRows.filter((row) => row.department === name);

    if (maxDepth != null && inDept.length > maxDepth) {
      await pushAlert({
        type: "queue_depth",
        department: name,
        token_id: null,
        message: `Queue depth ${inDept.length} exceeds limit ${maxDepth} in ${name}.`,
        severity: "warn"
      });
    }

    if (maxWait != null) {
      for (const row of inDept) {
        if (row.status !== "WAITING") {
          continue;
        }
        const w = row.waiting_tat_minutes;
        if (w != null && w > maxWait) {
          await pushAlert({
            type: "wait_threshold",
            department: name,
            token_id: row.token_id,
            message: `Waiting time ${w} min exceeds ${maxWait} min (${row.token_id}).`,
            severity: "crit"
          });
        }
      }
    }

    if (maxLab != null) {
      for (const row of inDept) {
        if (row.status !== "CONSULTING" || !row.lab_start || row.lab_end) {
          continue;
        }
        const labMin = row.lab_test_tat_minutes;
        if (labMin != null && labMin > maxLab) {
          await pushAlert({
            type: "lab_stuck",
            department: name,
            token_id: row.token_id,
            message: `Lab testing duration ${labMin} min exceeds ${maxLab} min (${row.token_id}).`,
            severity: "warn"
          });
        }
      }
    }
  }
};

export const listAlerts = async ({ limit = 100, unacknowledged_only: unack = false } = {}) => {
  await evaluateAndPersistAlerts();
  const q = unack ? { acknowledged_at: null } : {};
  return AlertEvent.find(q).sort({ createdAt: -1 }).limit(limit).lean();
};

export const acknowledgeAlert = async (id = "", by = "") => {
  const doc = await AlertEvent.findByIdAndUpdate(
    id,
    { acknowledged_at: new Date(), acknowledged_by: String(by ?? "").trim() || "user" },
    { new: true }
  ).lean();
  return doc;
};

const RECOMMENDATIONS = {
  queue_depth: "Open an additional consult bay, redistribute non-urgent cases, or add triage capacity.",
  wait_threshold: "Review queue order and prioritization; consider parallel intake or fast-track lanes.",
  lab_stuck: "Check lab workflow and sample backlog; coordinate with lab to clear the bottleneck."
};

const buildRealtimeRecommendations = async () => {
  const rows = await getLiveQueue({});
  if (!rows.length) {
    return [];
  }

  const byDepartment = rows.reduce((acc, row) => {
    const dept = String(row.department || "Unknown");
    if (!acc[dept]) {
      acc[dept] = {
        department: dept,
        total: 0,
        waiting: 0,
        waitingTimes: [],
        consultingTimes: []
      };
    }
    acc[dept].total += 1;
    if (row.status === "WAITING") {
      acc[dept].waiting += 1;
      if (row.waiting_tat_minutes != null) {
        acc[dept].waitingTimes.push(Number(row.waiting_tat_minutes));
      }
    }
    if (row.status === "CONSULTING" && row.consulting_tat_minutes != null) {
      acc[dept].consultingTimes.push(Number(row.consulting_tat_minutes));
    }
    return acc;
  }, {});

  const list = Object.values(byDepartment);
  const avg = (arr = []) => (arr.length ? Number((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2)) : null);
  const recommendations = [];

  const topQueueDept = [...list].sort((a, b) => b.waiting - a.waiting)[0];
  if (topQueueDept && topQueueDept.waiting > 0) {
    const waitAvg = avg(topQueueDept.waitingTimes);
    recommendations.push({
      alert_id: null,
      department: topQueueDept.department,
      type: "realtime_queue_pressure",
      title: `${topQueueDept.department} currently has ${topQueueDept.waiting} waiting patients${waitAvg != null ? ` (avg wait ${waitAvg} min)` : ""}.`,
      recommendation:
        "Temporarily shift intake/triage capacity to this department and prioritize longest-waiting tokens."
    });
  }

  const topConsultDept = [...list]
    .map((dept) => ({ ...dept, consultAvg: avg(dept.consultingTimes) }))
    .filter((dept) => dept.consultAvg != null)
    .sort((a, b) => b.consultAvg - a.consultAvg)[0];
  if (topConsultDept && topConsultDept.consultAvg > 0) {
    recommendations.push({
      alert_id: null,
      department: topConsultDept.department,
      type: "realtime_consult_slowdown",
      title: `${topConsultDept.department} has the longest active consult duration (${topConsultDept.consultAvg} min avg).`,
      recommendation:
        "Review consult workflow for this department and add support capacity during active slowdown."
    });
  }

  return recommendations.slice(0, 3);
};

export const getDeterministicRecommendations = async () => {
  await evaluateAndPersistAlerts();
  const recent = await AlertEvent.find({ acknowledged_at: null })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

  const lines = [];
  for (const ev of recent) {
    const hint = RECOMMENDATIONS[ev.type] ?? "Review operational load for this department.";
    lines.push({
      alert_id: ev._id,
      department: ev.department,
      type: ev.type,
      title: ev.message,
      recommendation: hint
    });
  }

  if (!lines.length) {
    const realtime = await buildRealtimeRecommendations();
    lines.push(...realtime);
  }

  return { recommendations: lines };
};
