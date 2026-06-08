import { buildPieSlices, describeDonutSlice, MODERNIZE_CHART } from "./chartUtils.js";

const OUTER_R = 46;
const INNER_R = 32;

export const DonutChart = ({
  title = "",
  subtitle = "",
  segments = [],
  centerLabel = "",
  centerValue = "",
  size = 156,
  emptyLabel = "No data",
  featured = false,
  className = ""
}) => {
  const slices = buildPieSlices(segments);
  const hasData = slices.length > 0;

  return (
    <div
      className={`nf-chart-card nf-chart-card--donut${featured ? " nf-chart-card--featured" : ""} ${className}`.trim()}
    >
      {title || subtitle ? (
        <div className="nf-chart-card-head">
          {title ? <h3 className="nf-chart-heading">{title}</h3> : null}
          {subtitle ? <p className="nf-chart-sub">{subtitle}</p> : null}
        </div>
      ) : null}
      <div className="nf-chart-body nf-chart-body--donut">
        <div className="nf-chart-donut-wrap" style={{ width: size, height: size }}>
          {hasData ? (
            <svg
              className="nf-chart-svg nf-chart-svg--donut"
              viewBox="0 0 100 100"
              width={size}
              height={size}
              role="img"
              aria-label={title}
            >
              <circle
                cx="50"
                cy="50"
                r={(OUTER_R + INNER_R) / 2}
                fill="none"
                stroke={MODERNIZE_CHART.track}
                strokeWidth={OUTER_R - INNER_R}
              />
              {slices.map((slice) => (
                <path
                  key={slice.label}
                  d={describeDonutSlice(50, 50, OUTER_R, INNER_R, slice.startAngle, slice.endAngle)}
                  fill={slice.color}
                  stroke="none"
                />
              ))}
            </svg>
          ) : (
            <div className="nf-chart-empty">{emptyLabel}</div>
          )}
          {hasData ? (
            <div className="nf-chart-donut-center">
              {centerValue ? <strong>{centerValue}</strong> : null}
              {centerLabel ? <span>{centerLabel}</span> : null}
            </div>
          ) : null}
        </div>
        {hasData ? (
          <ul className="nf-chart-legend nf-chart-legend--donut">
            {slices.map((slice) => (
              <li key={slice.label}>
                <span className="nf-chart-legend-dot" style={{ background: slice.color }} />
                <span className="nf-chart-legend-label">{slice.label}</span>
                <span className="nf-chart-legend-value">{slice.percent}%</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
};
