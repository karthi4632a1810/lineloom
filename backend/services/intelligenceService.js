import mongoose from "mongoose";
import { Token } from "../models/Token.js";
import { TimeTracking } from "../models/TimeTracking.js";
import { ModelVersion } from "../models/ModelVersion.js";
import { OperationalAction } from "../models/OperationalAction.js";
import { ApiError } from "../utils/apiError.js";
import { buildTatMetrics } from "./dashboardService.js";

const startOfUtcDay = (d) => {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
};

const addDays = (d, n) => {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
};

const mean = (values = []) => {
  const v = values.filter((x) => typeof x === "number" && !Number.isNaN(x));
  if (!v.length) {
    return null;
  }
  return v.reduce((a, b) => a + b, 0) / v.length;
};

const stddev = (values = []) => {
  const m = mean(values);
  if (m == null) {
    return null;
  }
  const v = values.filter((x) => typeof x === "number" && !Number.isNaN(x));
  if (v.length < 2) {
    return 0;
  }
  const sq = v.map((x) => (x - m) ** 2);
  return Math.sqrt(sq.reduce((a, b) => a + b, 0) / (v.length - 1));
};

export const getIntelligenceSummary = async () => {
  const end = startOfUtcDay(new Date());
  const start = addDays(end, -7);

  const tokens = await Token.find({
    created_at: { $gte: start, $lt: addDays(end, 1) }
  }).lean();

  const tokenIds = tokens.map((t) => t.token_id);
  const trackings = await TimeTracking.find({ token_id: { $in: tokenIds } }).lean();
  const byToken = trackings.reduce((acc, row) => {
    acc[row.token_id] = row;
    return acc;
  }, {});

  const byDay = {};
  for (const t of tokens) {
    const key = new Date(t.created_at).toISOString().slice(0, 10);
    if (!byDay[key]) {
      byDay[key] = [];
    }
    byDay[key].push(t);
  }

  const series = Object.keys(byDay)
    .sort()
    .map((day) => {
      const dayTokens = byDay[day];
      const waits = dayTokens
        .map((tok) => buildTatMetrics(byToken[tok.token_id] ?? {}, tok.status).waiting_tat_minutes)
        .filter((w) => w != null);
      return {
        date: day,
        avg_waiting_minutes: waits.length ? Number(mean(waits).toFixed(2)) : null,
        sample_size: dayTokens.length
      };
    });

  const avgs = series.map((s) => s.avg_waiting_minutes).filter((x) => x != null);
  const overallMean = mean(avgs);
  const overallStd = stddev(avgs);
  const todayKey = new Date().toISOString().slice(0, 10);
  const todayRow = series.find((s) => s.date === todayKey);
  const todayAvg = todayRow?.avg_waiting_minutes ?? null;

  let anomaly = false;
  let anomaly_reason = "";
  if (
    todayAvg != null &&
    overallMean != null &&
    overallStd != null &&
    overallStd > 0 &&
    todayAvg > overallMean + 2 * overallStd
  ) {
    anomaly = true;
    anomaly_reason = "Today's average wait is above the recent 7-day band (mean + 2σ).";
  }

  const forecast_naive_next_day = overallMean != null ? Number(overallMean.toFixed(2)) : null;

  return {
    series,
    stats: {
      mean_7d_daily_avg_wait: overallMean != null ? Number(overallMean.toFixed(2)) : null,
      std_7d_daily_avg_wait: overallStd != null ? Number(overallStd.toFixed(2)) : null,
      today_avg_wait: todayAvg,
      anomaly,
      anomaly_reason
    },
    forecast: {
      method: "naive_mean_of_daily_averages",
      expected_avg_wait_minutes_next_day: forecast_naive_next_day
    },
    narrative:
      "Summaries are computed on-device from MongoDB; connect an approved LLM provider to generate natural-language narratives if policy allows."
  };
};

export const recordOperationalAction = async (input = {}) => {
  const summary = String(input?.summary ?? "").trim();
  if (!summary) {
    throw new ApiError("summary is required", 400);
  }
  let related = null;
  if (input?.related_alert_id) {
    if (!mongoose.isValidObjectId(String(input.related_alert_id))) {
      throw new ApiError("related_alert_id must be a valid id", 400);
    }
    related = input.related_alert_id;
  }
  const created = await OperationalAction.create({
    department: String(input?.department ?? "").trim(),
    summary,
    action_type: String(input?.action_type ?? "manual").trim(),
    source: String(input?.source ?? "ui").trim(),
    related_alert_id: related,
    recorded_by: String(input?.recorded_by ?? "").trim(),
    outcome_notes: String(input?.outcome_notes ?? "").trim()
  });
  return created.toObject();
};

export const refreshModelVersionRecord = async () => {
  const tag = `forecast_${new Date().toISOString().slice(0, 10)}`;
  const metrics = await getIntelligenceSummary();
  const doc = await ModelVersion.findOneAndUpdate(
    { model_key: "forecast_naive" },
    {
      version_tag: tag,
      trained_at: new Date(),
      metrics_json: JSON.stringify({ stats: metrics.stats, updated: new Date().toISOString() })
    },
    { upsert: true, new: true }
  ).lean();
  return doc;
};

export const getModelVersion = async () => {
  return ModelVersion.findOne({ model_key: "forecast_naive" }).lean();
};
