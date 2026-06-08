import { buildPieSlices, describeSlice } from "./chartUtils.js";

export const PieChart = ({
  title = "",
  subtitle = "",
  segments = [],
  size = 148,
  emptyLabel = "No data",
  className = ""
}) => {
  const slices = buildPieSlices(segments);
  const hasData = slices.length > 0;

  return (
    <div className={`nf-chart-card nf-chart-card--pie ${className}`.trim()}>
      {title || subtitle ? (
        <div className="nf-chart-card-head">
          {title ? <h3 className="nf-chart-heading">{title}</h3> : null}
          {subtitle ? <p className="nf-chart-sub">{subtitle}</p> : null}
        </div>
      ) : null}
      <div className="nf-chart-body nf-chart-body--pie">
        {hasData ? (
          <svg
            className="nf-chart-svg nf-chart-svg--pie"
            viewBox="0 0 100 100"
            width={size}
            height={size}
            role="img"
            aria-label={title}
          >
            {slices.map((slice) => (
              <path
                key={slice.label}
                d={describeSlice(50, 50, 44, slice.startAngle, slice.endAngle)}
                fill={slice.color}
                stroke="#ffffff"
                strokeWidth="2"
                strokeLinejoin="round"
              />
            ))}
          </svg>
        ) : (
          <div className="nf-chart-empty" style={{ width: size, height: size }}>
            {emptyLabel}
          </div>
        )}
        {hasData ? (
          <ul className="nf-chart-legend nf-chart-legend--pie">
            {slices.map((slice) => (
              <li key={slice.label}>
                <span className="nf-chart-legend-dot" style={{ background: slice.color }} />
                <span className="nf-chart-legend-label">{slice.label}</span>
                <span className="nf-chart-legend-value">
                  {slice.value}
                  <em>({slice.percent}%)</em>
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
};
