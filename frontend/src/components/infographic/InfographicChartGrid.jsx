import { useMemo } from "react";
import { BarChart } from "./BarChart.jsx";
import { DonutChart } from "./DonutChart.jsx";
import { PieChart } from "./PieChart.jsx";
import { CHART_PALETTE, MODERNIZE_CHART } from "./chartUtils.js";

export const InfographicChartGrid = ({
  funnel = null,
  completionRate = 0,
  consultRate = 0,
  labRate = 0,
  treatmentRate = 0
}) => {
  const chartData = useMemo(() => {
    if (!funnel) {
      return null;
    }
    const total = Math.max(Number(funnel.total_visits) || 0, 0);
    const completed = Number(funnel.completed_status) || 0;
    const inProgress = Math.max(0, total - completed);

    const visitOutcome = [
      { label: "Completed", value: completed, color: MODERNIZE_CHART.primary },
      { label: "In progress", value: inProgress, color: MODERNIZE_CHART.accent }
    ].filter((s) => s.value > 0);

    const funnelStages = [
      { label: "Consult done", value: Number(funnel.reached_consult_end) || 0, color: MODERNIZE_CHART.primary },
      { label: "Lab touched", value: Number(funnel.touched_lab) || 0, color: MODERNIZE_CHART.purple },
      { label: "Treatment", value: Number(funnel.touched_treatment) || 0, color: MODERNIZE_CHART.teal },
      { label: "Completed", value: completed, color: MODERNIZE_CHART.primaryHover }
    ].filter((s) => s.value > 0);

    const deptRows = Array.isArray(funnel.department_breakdown) ? funnel.department_breakdown : [];
    const deptPie = deptRows
      .filter((row) => (row.total_visits ?? 0) > 0)
      .slice(0, 8)
      .map((row, index) => ({
        label: row.department || "Unknown",
        value: row.total_visits ?? 0,
        color: CHART_PALETTE[index % CHART_PALETTE.length]
      }));

    const stageBars = [
      { label: "Consult", value: consultRate },
      { label: "Lab", value: labRate },
      { label: "Treatment", value: treatmentRate },
      { label: "Completed", value: completionRate }
    ];

    const waitBars = deptRows
      .filter((row) => row.avg_waiting_minutes != null)
      .slice(0, 8)
      .map((row) => ({
        label: row.department || "Unknown",
        value: Number(row.avg_waiting_minutes) || 0
      }));

    const bottleneckBars = deptRows
      .filter((row) => row.bottleneck_stage && row.bottleneck_stage !== "none")
      .slice(0, 8)
      .map((row) => ({
        label: row.department || "Unknown",
        value: Number(row.bottleneck_minutes) || 0
      }));

    return {
      visitOutcome,
      funnelStages,
      deptPie,
      completionDonut: [
        { label: "Completed", value: completed, color: MODERNIZE_CHART.primary },
        { label: "Not completed", value: Math.max(0, total - completed), color: MODERNIZE_CHART.track }
      ].filter((s) => s.value > 0),
      stageBars,
      waitBars,
      bottleneckBars
    };
  }, [funnel, completionRate, consultRate, labRate, treatmentRate]);

  if (!chartData) {
    return null;
  }

  return (
    <div className="nf-infographic-charts nf-infographic-bento">
      <DonutChart
        className="nf-chart-slot nf-chart-slot-hero"
        title="Completion rate"
        subtitle="Share of visits marked complete"
        segments={chartData.completionDonut}
        centerValue={`${completionRate}%`}
        centerLabel="completed"
        featured
        size={152}
      />
      <PieChart
        className="nf-chart-slot nf-chart-slot-visit"
        title="Visit outcome"
        subtitle="Completed vs in progress"
        segments={chartData.visitOutcome}
        size={132}
      />
      <PieChart
        className="nf-chart-slot nf-chart-slot-journey"
        title="Journey stages"
        subtitle="Patient counts by stage"
        segments={chartData.funnelStages}
        size={132}
      />
      <PieChart
        className="nf-chart-slot nf-chart-slot-dept"
        title="Visits by department"
        subtitle="Top departments in range"
        segments={chartData.deptPie}
        emptyLabel="No department data"
        size={132}
      />
      <BarChart
        className="nf-chart-slot nf-chart-slot-stage"
        title="Stage conversion"
        subtitle="Percentage reaching each stage"
        items={chartData.stageBars}
        valueSuffix="%"
      />
      <BarChart
        className="nf-chart-slot nf-chart-slot-wait"
        title="Avg waiting time"
        subtitle="Minutes by department"
        items={chartData.waitBars}
        valueSuffix=" min"
        emptyLabel="No wait-time data"
      />
      {chartData.bottleneckBars.length ? (
        <BarChart
          className="nf-chart-slot nf-chart-slot-bottleneck"
          title="Bottleneck minutes"
          subtitle="Longest stage delay by dept"
          items={chartData.bottleneckBars}
          valueSuffix=" min"
        />
      ) : null}
    </div>
  );
};
