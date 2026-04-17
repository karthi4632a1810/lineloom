import { Token } from "../models/Token.js";
import { TimeTracking } from "../models/TimeTracking.js";
import { ApiError } from "../utils/apiError.js";
import { resolveEffectiveTreatmentStart } from "../utils/timeMetrics.js";
import { buildTatMetrics, resolveTimeRange } from "./dashboardService.js";

const toIso = (d) => (d && !Number.isNaN(new Date(d).getTime()) ? new Date(d).toISOString() : null);
const round2 = (n) => Number((Number(n) || 0).toFixed(2));
const mean = (items = []) => {
  const values = items.filter((x) => x != null && !Number.isNaN(Number(x)));
  if (!values.length) {
    return null;
  }
  return round2(values.reduce((a, b) => a + b, 0) / values.length);
};
const median = (items = []) => {
  const values = items
    .filter((x) => x != null && !Number.isNaN(Number(x)))
    .map((x) => Number(x))
    .sort((a, b) => a - b);
  if (!values.length) {
    return null;
  }
  const mid = Math.floor(values.length / 2);
  if (values.length % 2) {
    return round2(values[mid]);
  }
  return round2((values[mid - 1] + values[mid]) / 2);
};

const segmentDurationMinutes = (start, end, useNowIfOpen) => {
  if (!start) {
    return null;
  }
  const endDate = end ?? (useNowIfOpen ? new Date() : null);
  if (!endDate) {
    return null;
  }
  const ms = Math.max(new Date(endDate).getTime() - new Date(start).getTime(), 0);
  return Number((ms / 60000).toFixed(2));
};

/**
 * Ordered journey segments for a visit (chronological by start time).
 */
export const buildJourneyTimeline = (tracking = {}, token = {}) => {
  const status = token.status === "ACTIVE" ? "WAITING" : token.status;
  const metrics = buildTatMetrics(tracking, status);

  const candidates = [];

  if (tracking.waiting_start) {
    const open = status === "WAITING" && !tracking.consult_start;
    candidates.push({
      kind: "waiting",
      label: "Waiting",
      start: tracking.waiting_start,
      end: tracking.consult_start ?? null,
      duration_minutes: metrics.waiting_tat_minutes,
      in_progress: open
    });
  }
  if (tracking.consult_start) {
    const open = status === "CONSULTING" && !tracking.consult_end;
    candidates.push({
      kind: "consultation",
      label: "Consultation",
      start: tracking.consult_start,
      end: tracking.consult_end ?? null,
      duration_minutes: metrics.consulting_tat_minutes,
      in_progress: open
    });
  }
  if (tracking.billing_start) {
    const open = status === "CONSULTING" && Boolean(tracking.billing_start) && !tracking.billing_end;
    candidates.push({
      kind: "billing",
      label: "Billing",
      start: tracking.billing_start,
      end: tracking.billing_end ?? null,
      duration_minutes: metrics.billing_tat_minutes,
      in_progress: open
    });
  }
  if (
    tracking.billing_end &&
    (tracking.lab_start || (status === "CONSULTING" && !tracking.lab_start))
  ) {
    const open = status === "CONSULTING" && !tracking.lab_start;
    candidates.push({
      kind: "lab_queue",
      label: "Lab queue (post-payment)",
      start: tracking.billing_end,
      end: tracking.lab_start ?? null,
      duration_minutes: metrics.lab_wait_tat_minutes,
      in_progress: open
    });
  }
  if (tracking.lab_start) {
    const open = status === "CONSULTING" && !tracking.lab_end;
    candidates.push({
      kind: "lab",
      label: "Lab testing",
      start: tracking.lab_start,
      end: tracking.lab_end ?? null,
      duration_minutes: metrics.lab_test_tat_minutes,
      in_progress: open
    });
  }

  const treatmentStart = resolveEffectiveTreatmentStart(tracking.care_start, tracking.consult_end);
  if (treatmentStart) {
    const open = status === "IN_TREATMENT" && !tracking.care_end;
    candidates.push({
      kind: "treatment",
      label: "Treatment / care",
      start: treatmentStart,
      end: tracking.care_end ?? null,
      duration_minutes: metrics.treatment_tat_minutes,
      in_progress: open
    });
  }

  if (tracking.break_start) {
    const open = !tracking.break_end;
    candidates.push({
      kind: "break",
      label: "Break / handoff",
      start: tracking.break_start,
      end: tracking.break_end ?? null,
      duration_minutes: metrics.break_tat_minutes ?? segmentDurationMinutes(tracking.break_start, tracking.break_end, open),
      in_progress: open
    });
  }

  const timeline = candidates
    .map((row, index) => ({
      id: `${row.kind}-${index}`,
      kind: row.kind,
      label: row.label,
      start: toIso(row.start),
      end: toIso(row.end),
      duration_minutes: row.duration_minutes,
      in_progress: Boolean(row.in_progress)
    }))
    .sort((a, b) => {
      const ta = a.start ? new Date(a.start).getTime() : 0;
      const tb = b.start ? new Date(b.start).getTime() : 0;
      return ta - tb;
    });

  return {
    token_id: token.token_id,
    department: token.department,
    status,
    timeline,
    metrics
  };
};

export const getTokenJourney = async (tokenId = "") => {
  const id = String(tokenId ?? "").trim();
  if (!id) {
    throw new ApiError("Token id is required", 400);
  }
  const token = await Token.findOne({ token_id: id }).lean();
  if (!token) {
    throw new ApiError("Token not found", 404);
  }
  const tracking = await TimeTracking.findOne({ token_id: id }).lean();
  return buildJourneyTimeline(tracking ?? {}, token);
};

/**
 * Funnel-style counts: how many visits in range touched each stage.
 */
export const getDepartmentJourneyFunnel = async (filters = {}) => {
  const fromDate = filters?.from ? new Date(filters.from) : null;
  const toDate = filters?.to ? new Date(filters.to) : null;
  const hasExplicitRange =
    fromDate &&
    toDate &&
    !Number.isNaN(fromDate.getTime()) &&
    !Number.isNaN(toDate.getTime()) &&
    toDate > fromDate;

  const tokens = await resolveTimeRange(filters);
  const tokenIds = tokens.map((t) => t.token_id);
  const trackings = await TimeTracking.find({ token_id: { $in: tokenIds } }).lean();
  const byId = trackings.reduce((acc, row) => {
    acc[row.token_id] = row;
    return acc;
  }, {});

  const departmentFilter = String(filters?.department ?? "").trim();
  const scoped = departmentFilter ? tokens.filter((t) => t.department === departmentFilter) : tokens;

  let with_consult_end = 0;
  let with_lab = 0;
  let with_treatment = 0;
  let completed = 0;
  let long_wait_count = 0;
  const byDepartment = {};

  const ensureDept = (name = "Unknown") => {
    const key = String(name || "Unknown");
    if (!byDepartment[key]) {
      byDepartment[key] = {
        department: key,
        total_visits: 0,
        reached_consult_end: 0,
        touched_lab: 0,
        touched_treatment: 0,
        completed_status: 0,
        avg_waiting_minutes: null,
        avg_consulting_minutes: null,
        avg_treatment_minutes: null,
        _waiting_count: 0,
        _consult_count: 0,
        _treatment_count: 0,
        long_wait_count: 0,
        bottleneck_stage: "none",
        bottleneck_minutes: null
      };
    }
    return byDepartment[key];
  };

  for (const token of scoped) {
    const tr = byId[token.token_id] ?? {};
    const tat = buildTatMetrics(tr, token.status);
    const dept = ensureDept(token.department);
    dept.total_visits += 1;
    if (tr.consult_end) {
      with_consult_end += 1;
      dept.reached_consult_end += 1;
    }
    if (tr.lab_end || tr.lab_start) {
      with_lab += 1;
      dept.touched_lab += 1;
    }
    if (tr.care_end || tr.care_start) {
      with_treatment += 1;
      dept.touched_treatment += 1;
    }
    if (token.status === "COMPLETED") {
      completed += 1;
      dept.completed_status += 1;
    }

    const wait = tat.waiting_tat_minutes;
    const consult = tat.consulting_tat_minutes;
    const treatment = tat.treatment_tat_minutes;
    const pushAvg = (current, incoming, count) => {
      if (incoming == null) {
        return current;
      }
      if (current == null || count <= 1) {
        return incoming;
      }
      return Number((((current * (count - 1)) + incoming) / count).toFixed(2));
    };
    if (wait != null) {
      dept._waiting_count += 1;
      dept.avg_waiting_minutes = pushAvg(dept.avg_waiting_minutes, wait, dept._waiting_count);
    }
    if (consult != null) {
      dept._consult_count += 1;
      dept.avg_consulting_minutes = pushAvg(dept.avg_consulting_minutes, consult, dept._consult_count);
    }
    if (treatment != null) {
      dept._treatment_count += 1;
      dept.avg_treatment_minutes = pushAvg(dept.avg_treatment_minutes, treatment, dept._treatment_count);
    }
    if (wait != null && wait > 30) {
      long_wait_count += 1;
      dept.long_wait_count += 1;
    }
  }

  const department_breakdown = Object.values(byDepartment).map((dept) => {
    const candidates = [
      { key: "waiting", value: dept.avg_waiting_minutes },
      { key: "consulting", value: dept.avg_consulting_minutes },
      { key: "treatment", value: dept.avg_treatment_minutes }
    ].filter((row) => row.value != null);
    if (candidates.length) {
      candidates.sort((a, b) => b.value - a.value);
      dept.bottleneck_stage = candidates[0].key;
      dept.bottleneck_minutes = candidates[0].value;
    }
    delete dept._waiting_count;
    delete dept._consult_count;
    delete dept._treatment_count;
    dept.long_wait_share_pct = dept.total_visits
      ? round2((dept.long_wait_count / dept.total_visits) * 100)
      : 0;
    dept.completion_ratio_pct = dept.total_visits
      ? round2((dept.completed_status / dept.total_visits) * 100)
      : 0;
    return dept;
  });

  // Build baseline window to support explainable AI attribution.
  let baselineByDept = {};
  if (hasExplicitRange) {
    const rangeMs = toDate.getTime() - fromDate.getTime();
    const baselineFrom = new Date(fromDate.getTime() - rangeMs);
    const baselineTo = new Date(fromDate.getTime());
    const baseTokens = await resolveTimeRange({
      ...filters,
      from: baselineFrom.toISOString(),
      to: baselineTo.toISOString()
    });
    const baseTokenIds = baseTokens.map((t) => t.token_id);
    const baseTrackings = await TimeTracking.find({ token_id: { $in: baseTokenIds } }).lean();
    const baseByToken = baseTrackings.reduce((acc, row) => {
      acc[row.token_id] = row;
      return acc;
    }, {});

    baselineByDept = baseTokens.reduce((acc, token) => {
      const dept = String(token.department || "Unknown");
      const tat = buildTatMetrics(baseByToken[token.token_id] ?? {}, token.status);
      if (!acc[dept]) {
        acc[dept] = { wait: [], consult: [], treatment: [], count: 0 };
      }
      acc[dept].count += 1;
      if (tat.waiting_tat_minutes != null) {
        acc[dept].wait.push(tat.waiting_tat_minutes);
      }
      if (tat.consulting_tat_minutes != null) {
        acc[dept].consult.push(tat.consulting_tat_minutes);
      }
      if (tat.treatment_tat_minutes != null) {
        acc[dept].treatment.push(tat.treatment_tat_minutes);
      }
      return acc;
    }, {});
  }

  const insightRows = department_breakdown.map((dept) => {
    const base = baselineByDept[dept.department] ?? null;
    const baseWait = base ? mean(base.wait) : null;
    const baseConsult = base ? mean(base.consult) : null;
    const baseTreatment = base ? mean(base.treatment) : null;

    const waitDelta = baseWait == null || dept.avg_waiting_minutes == null ? null : round2(dept.avg_waiting_minutes - baseWait);
    const consultDelta =
      baseConsult == null || dept.avg_consulting_minutes == null
        ? null
        : round2(dept.avg_consulting_minutes - baseConsult);
    const treatmentDelta =
      baseTreatment == null || dept.avg_treatment_minutes == null
        ? null
        : round2(dept.avg_treatment_minutes - baseTreatment);

    const stageDeltas = [
      { stage: "waiting", delta: waitDelta ?? Number.NEGATIVE_INFINITY },
      { stage: "consulting", delta: consultDelta ?? Number.NEGATIVE_INFINITY },
      { stage: "treatment", delta: treatmentDelta ?? Number.NEGATIVE_INFINITY }
    ].sort((a, b) => b.delta - a.delta);

    const dominant = stageDeltas[0];
    const positiveDelta = Math.max(0, dominant.delta === Number.NEGATIVE_INFINITY ? 0 : dominant.delta);
    const contributionScore = round2(positiveDelta * (dept.total_visits || 0));

    return {
      department: dept.department,
      contribution_score: contributionScore,
      sample_size: dept.total_visits || 0,
      baseline: {
        avg_waiting_minutes: baseWait,
        avg_consulting_minutes: baseConsult,
        avg_treatment_minutes: baseTreatment
      },
      deltas: {
        waiting_minutes: waitDelta,
        consulting_minutes: consultDelta,
        treatment_minutes: treatmentDelta
      },
      dominant_stage_driver: positiveDelta > 0 ? dominant.stage : "none",
      dominant_stage_delta_minutes: positiveDelta > 0 ? dominant.delta : null
    };
  });

  const totalContribution = insightRows.reduce((sum, row) => sum + (row.contribution_score || 0), 0);
  const ranked = [...insightRows]
    .sort((a, b) => (b.contribution_score || 0) - (a.contribution_score || 0))
    .map((row) => ({
      ...row,
      contribution_pct:
        totalContribution > 0 ? round2(((row.contribution_score || 0) / totalContribution) * 100) : 0
    }));

  const topContributor = ranked[0] ?? null;
  const realtimeTop =
    [...department_breakdown]
      .sort((a, b) => {
        const aw = a.avg_waiting_minutes ?? -1;
        const bw = b.avg_waiting_minutes ?? -1;
        if (bw !== aw) {
          return bw - aw;
        }
        return (b.long_wait_share_pct ?? 0) - (a.long_wait_share_pct ?? 0);
      })[0] ?? null;
  const confidenceScore = (() => {
    const n = scoped.length;
    if (n >= 120) {
      return "high";
    }
    if (n >= 35) {
      return "medium";
    }
    return "low";
  })();

  const recommendationByStage = {
    waiting: "Reallocate triage/front-desk capacity and open a parallel intake lane in peak hours.",
    consulting: "Add consult capacity or rebalance doctor allocation during high-load blocks.",
    treatment: "Increase treatment bay turnover and align nursing support with consult output."
  };

  const hasPositiveAttribution = Boolean(
    topContributor &&
      topContributor.dominant_stage_delta_minutes != null &&
      topContributor.dominant_stage_delta_minutes > 0
  );

  const realtimeStage = realtimeTop?.bottleneck_stage && realtimeTop.bottleneck_stage !== "none"
    ? realtimeTop.bottleneck_stage
    : "waiting";

  const ai_insight = {
    principle: "explainable_causal_ops_ai",
    summary: hasPositiveAttribution
      ? {
          what_happened:
            topContributor.dominant_stage_delta_minutes != null
              ? `Delay increase is most linked to ${topContributor.department}, where ${topContributor.dominant_stage_driver} is +${topContributor.dominant_stage_delta_minutes} min vs baseline.`
              : "No material positive delay shift versus baseline was detected.",
          who_contributed_most: topContributor.department,
          why: topContributor.dominant_stage_driver,
          confidence: confidenceScore,
          recommended_action:
            recommendationByStage[topContributor.dominant_stage_driver] ??
            "Maintain current operations and keep monitoring stage-level drift."
        }
      : realtimeTop
      ? {
          what_happened: `${realtimeTop.department} currently shows the highest operational delay pressure with avg waiting ${realtimeTop.avg_waiting_minutes ?? 0} min and long-wait share ${realtimeTop.long_wait_share_pct ?? 0}%.`,
          who_contributed_most: realtimeTop.department,
          why: realtimeStage,
          confidence: confidenceScore,
          recommended_action:
            recommendationByStage[realtimeStage] ??
            "Shift on-floor capacity toward the most delayed stage and re-check after one cycle."
        }
      : {
          what_happened: "Insufficient data for causal attribution.",
          who_contributed_most: null,
          why: "none",
          confidence: "low",
          recommended_action: "Collect more operational data before making policy changes."
        },
    contributors_ranked: ranked
  };

  const currentWaits = department_breakdown.map((d) => d.avg_waiting_minutes).filter((x) => x != null);

  return {
    total_visits: scoped.length,
    reached_consult_end: with_consult_end,
    touched_lab: with_lab,
    touched_treatment: with_treatment,
    completed_status: completed,
    long_wait_count,
    long_wait_share_pct: scoped.length ? round2((long_wait_count / scoped.length) * 100) : 0,
    avg_waiting_minutes_global: mean(currentWaits),
    median_waiting_minutes_global: median(currentWaits),
    department_breakdown,
    ai_insight,
    department: departmentFilter || null,
    from: filters?.from ?? null,
    to: filters?.to ?? null
  };
};
