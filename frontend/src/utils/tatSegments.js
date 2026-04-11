/**
 * Treatment duration must not include idle time after consultation ends and before
 * treatment actually starts (care_start). It also must not overlap the consulting
 * segment when timestamps are out of order. We use the later of care_start and
 * consult_end as the segment start when both exist.
 */
export function resolveEffectiveTreatmentStart(careStart = null, consultEnd = null) {
  if (!careStart) {
    return null;
  }
  if (!consultEnd) {
    return careStart;
  }
  const a = new Date(careStart).getTime();
  const b = new Date(consultEnd).getTime();
  if (Number.isNaN(a)) {
    return null;
  }
  if (Number.isNaN(b)) {
    return careStart;
  }
  return a >= b ? careStart : consultEnd;
}
