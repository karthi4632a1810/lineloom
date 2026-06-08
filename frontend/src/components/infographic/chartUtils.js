/** SVG arc helpers for pie / donut charts (viewBox 0 0 100 100). */

export const MODERNIZE_CHART = {
  primary: "#5d87ff",
  primaryHover: "#4570ea",
  primarySoft: "rgba(93, 135, 255, 0.28)",
  primaryLight: "#ecf2ff",
  accent: "#49beff",
  purple: "#763ebd",
  orange: "#ffae1f",
  teal: "#13deb9",
  track: "#ebf1f6",
  muted: "#7c8fac",
  text: "#2a3547"
};

export const CHART_PALETTE = [
  MODERNIZE_CHART.primary,
  MODERNIZE_CHART.accent,
  MODERNIZE_CHART.primaryHover,
  MODERNIZE_CHART.purple,
  MODERNIZE_CHART.teal,
  MODERNIZE_CHART.orange,
  "#fa896b",
  MODERNIZE_CHART.muted
];

const polar = (cx, cy, r, angleDeg) => {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
};

export const describeSlice = (cx, cy, r, startAngle, endAngle) => {
  if (endAngle - startAngle >= 359.99) {
    return `M ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy} A ${r} ${r} 0 1 1 ${cx - r} ${cy} Z`;
  }
  const start = polar(cx, cy, r, endAngle);
  const end = polar(cx, cy, r, startAngle);
  const large = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${large} 0 ${end.x} ${end.y} Z`;
};

export const describeDonutSlice = (cx, cy, outerR, innerR, startAngle, endAngle) => {
  if (endAngle - startAngle >= 359.99) {
    return "";
  }
  const outerStart = polar(cx, cy, outerR, startAngle);
  const outerEnd = polar(cx, cy, outerR, endAngle);
  const innerStart = polar(cx, cy, innerR, endAngle);
  const innerEnd = polar(cx, cy, innerR, startAngle);
  const large = endAngle - startAngle > 180 ? 1 : 0;
  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerR} ${outerR} 0 ${large} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerR} ${innerR} 0 ${large} 0 ${innerStart.x} ${innerStart.y}`,
    "Z"
  ].join(" ");
};

export const buildPieSlices = (segments = []) => {
  const cleaned = segments.filter((s) => Number(s.value) > 0);
  const total = cleaned.reduce((sum, s) => sum + Number(s.value), 0);
  if (total <= 0) {
    return [];
  }
  let cursor = 0;
  return cleaned.map((segment) => {
    const sweep = (Number(segment.value) / total) * 360;
    const slice = {
      ...segment,
      percent: Math.round((Number(segment.value) / total) * 100),
      startAngle: cursor,
      endAngle: cursor + sweep
    };
    cursor += sweep;
    return slice;
  });
};

export const abbrevChartLabel = (label, max = 11) => {
  const text = String(label ?? "").trim();
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, max - 1)}…`;
};
