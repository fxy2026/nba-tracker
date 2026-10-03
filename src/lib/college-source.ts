/** Preserve supplied school/team labels without inferring education history. */
export function collegeSourceLabel(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const label = value.trim();
  return !label || /^(?:[-–—]+|n\/?a|none|null|unknown|not available)$/i.test(label) ? null : label;
}
