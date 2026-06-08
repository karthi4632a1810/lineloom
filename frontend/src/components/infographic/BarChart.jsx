import { abbrevChartLabel, MODERNIZE_CHART } from "./chartUtils.js";

export const BarChart = ({
  title = "",
  subtitle = "",
  items = [],
  valueSuffix = "",
  barColor = MODERNIZE_CHART.primary,
  highlightMax = true,
  emptyLabel = "No data",
  className = ""
}) => {
  const rows = items.filter((item) => Number(item.value) >= 0 && String(item.label ?? "").trim());
  const max = Math.max(...rows.map((r) => Number(r.value) || 0), 1);
  const peakValue = Math.max(...rows.map((r) => Number(r.value) || 0), 0);

  return (
    <div className={`nf-chart-card nf-chart-card--bars ${className}`.trim()}>
      {title || subtitle ? (
        <div className="nf-chart-card-head">
          {title ? <h3 className="nf-chart-heading">{title}</h3> : null}
          {subtitle ? <p className="nf-chart-sub">{subtitle}</p> : null}
        </div>
      ) : null}
      {!rows.length ? (
        <p className="nf-chart-empty nf-chart-empty--inline">{emptyLabel}</p>
      ) : (
        <div className="nf-vbar-chart" aria-label={title}>
          <div className="nf-vbar-chart-grid" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </div>
          <ul className="nf-vbar-chart-columns">
            {rows.map((item) => {
              const value = Number(item.value) || 0;
              const heightPct = Math.max(10, Math.round((value / max) * 100));
              const isHighlight = highlightMax && value === peakValue && value > 0;
              const fillColor = isHighlight
                ? barColor
                : item.color ?? MODERNIZE_CHART.primarySoft;

              return (
                <li key={item.label} className="nf-vbar-column">
                  <span className="nf-vbar-value">
                    {value}
                    {valueSuffix}
                  </span>
                  <div className="nf-vbar-track">
                    <div
                      className={`nf-vbar-fill${isHighlight ? " is-highlight" : ""}`}
                      style={{ height: `${heightPct}%`, background: fillColor }}
                    />
                  </div>
                  <span className="nf-vbar-label" title={item.label}>
                    {abbrevChartLabel(item.label)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};
