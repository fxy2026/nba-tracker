export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

/** Keyboard movement never lands on unavailable choices or wraps unexpectedly. */
export function nextEnabledOption(options: readonly SelectOption[], current: number, direction: 1 | -1): number {
  for (let index = current + direction; index >= 0 && index < options.length; index += direction) {
    if (!options[index].disabled) return index;
  }
  return options[current] && !options[current].disabled ? current : -1;
}

export function findTypeaheadOption(options: readonly SelectOption[], query: string, current: number, includeCurrent = false): number {
  const normalized = query.toLocaleLowerCase();
  for (let step = includeCurrent ? 0 : 1; step < options.length + (includeCurrent ? 0 : 1); step++) {
    const index = ((Math.max(current, includeCurrent ? 0 : -1) + step) % options.length + options.length) % options.length;
    if (!options[index].disabled && options[index].label.toLocaleLowerCase().startsWith(normalized)) return index;
  }
  return -1;
}

export interface SelectPopupPosition { left: number; top: number; width: number; maxHeight: number }
interface Rect { left: number; top: number; bottom: number; width: number }
interface Viewport { left: number; top: number; width: number; height: number }

/** Fixed, body-portaled listbox: it cannot be clipped by a chart/card container. */
export function positionSelectPopup(rect: Rect, viewport: Viewport, contentHeight: number): SelectPopupPosition {
  const margin = 8, gap = 6;
  const width = Math.min(Math.max(rect.width, 184), Math.max(0, viewport.width - margin * 2));
  const left = Math.max(viewport.left + margin, Math.min(rect.left, viewport.left + viewport.width - width - margin));
  const below = Math.max(0, viewport.top + viewport.height - rect.bottom - gap - margin);
  const above = Math.max(0, rect.top - viewport.top - gap - margin);
  const desired = Math.min(320, contentHeight);
  const opensAbove = below < desired && above > below;
  const maxHeight = Math.min(desired, opensAbove ? above : below);
  const top = opensAbove ? rect.top - gap - maxHeight : rect.bottom + gap;
  return { left, top: Math.max(viewport.top + margin, Math.min(top, viewport.top + viewport.height - maxHeight - margin)), width, maxHeight };
}
