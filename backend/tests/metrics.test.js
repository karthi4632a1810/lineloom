import test from "node:test";
import assert from "node:assert/strict";
import { buildTatMetrics } from "../services/dashboardService.js";

test("buildTatMetrics: waiting uses consult_start as end", () => {
  const t0 = new Date("2025-01-01T10:00:00Z");
  const t1 = new Date("2025-01-01T10:20:00Z");
  const m = buildTatMetrics({ waiting_start: t0, consult_start: t1 }, "WAITING");
  assert.equal(m.waiting_tat_minutes, 20);
  assert.equal(m.consulting_tat_minutes, null);
});

test("buildTatMetrics: treatment uses later of care_start and consult_end", () => {
  const consultEnd = new Date("2025-01-01T11:00:00Z");
  const careStart = new Date("2025-01-01T10:30:00Z");
  const careEnd = new Date("2025-01-01T11:30:00Z");
  const m = buildTatMetrics(
    {
      consult_start: new Date("2025-01-01T10:00:00Z"),
      consult_end: consultEnd,
      care_start: careStart,
      care_end: careEnd
    },
    "COMPLETED"
  );
  assert.equal(m.treatment_tat_minutes, 30);
});

test("buildTatMetrics: break is tracked but not in overall_tat", () => {
  const m = buildTatMetrics(
    {
      waiting_start: new Date("2025-01-01T09:00:00Z"),
      consult_start: new Date("2025-01-01T09:10:00Z"),
      consult_end: new Date("2025-01-01T09:40:00Z"),
      break_start: new Date("2025-01-01T09:45:00Z"),
      break_end: new Date("2025-01-01T10:00:00Z")
    },
    "COMPLETED"
  );
  assert.equal(m.break_tat_minutes, 15);
  assert.ok(m.overall_tat_minutes < 100);
  const sumStages =
    (m.waiting_tat_minutes ?? 0) +
    (m.consulting_tat_minutes ?? 0) +
    (m.billing_tat_minutes ?? 0) +
    (m.lab_wait_tat_minutes ?? 0) +
    (m.lab_test_tat_minutes ?? 0) +
    (m.treatment_tat_minutes ?? 0);
  assert.equal(m.overall_tat_minutes, Number(sumStages.toFixed(2)));
});

test("buildTatMetrics: missing consult_end yields null consulting TAT when not consulting", () => {
  const m = buildTatMetrics(
    {
      waiting_start: new Date("2025-01-01T09:00:00Z"),
      consult_start: new Date("2025-01-01T09:05:00Z")
    },
    "COMPLETED"
  );
  assert.equal(m.consulting_tat_minutes, null);
});

test("buildTatMetrics: lab wait uses consult_end for labs_ordered path (not billing)", () => {
  const consultEnd = new Date("2025-01-01T10:00:00Z");
  const labStart = new Date("2025-01-01T10:15:00Z");
  const m = buildTatMetrics(
    {
      consult_start: new Date("2025-01-01T09:00:00Z"),
      consult_end: consultEnd,
      labs_ordered: true,
      lab_start: labStart
    },
    "CONSULTING"
  );
  assert.equal(m.lab_wait_tat_minutes, 15);
});
