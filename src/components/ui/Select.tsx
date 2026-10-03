"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import { findTypeaheadOption, nextEnabledOption, positionSelectPopup, type SelectOption, type SelectPopupPosition } from "./select-behavior";
import styles from "./select.module.css";

export type { SelectOption } from "./select-behavior";
export interface SelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: readonly SelectOption[];
  "aria-label": string;
  "aria-describedby"?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  placeholder?: string;
}

/** Select-only combobox. DOM focus stays on the trigger; Tab is never trapped. */
export default function Select({ value, onValueChange, options, disabled = false, className = "", id, placeholder = "—", "aria-label": label, "aria-describedby": describedBy }: SelectProps) {
  const generatedId = useId(), triggerId = id ?? `${generatedId}-select`, listId = `${generatedId}-options`;
  const trigger = useRef<HTMLButtonElement>(null), list = useRef<HTMLDivElement>(null);
  const search = useRef({ text: "", time: 0 });
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [position, setPosition] = useState<SelectPopupPosition | null>(null);
  const selectedIndex = options.findIndex(option => option.value === value);
  const unavailable = disabled || !options.some(option => !option.disabled);
  const expanded = open && !unavailable;
  const active = options[activeIndex] && !options[activeIndex].disabled ? activeIndex : -1;

  function close(restoreFocus = false) {
    setOpen(false);
    search.current = { text: "", time: 0 };
    if (restoreFocus) trigger.current?.focus({ preventScroll: true });
  }
  function show(index = selectedIndex) {
    if (unavailable) return;
    setActiveIndex(options[index] && !options[index].disabled ? index : nextEnabledOption(options, -1, 1));
    setPosition(null);
    setOpen(true);
  }
  function choose(index: number) {
    const option = options[index];
    if (!option || option.disabled || unavailable) return;
    close(true);
    if (option.value !== value) onValueChange(option.value);
  }
  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (unavailable) return;
    if (event.key === "Tab") { close(); return; }
    if (event.key === "Escape") {
      if (expanded) { event.preventDefault(); event.stopPropagation(); close(true); }
      return;
    }
    if (event.altKey && event.key === "ArrowUp") { event.preventDefault(); close(true); return; }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      search.current = { text: "", time: 0 };
      if (!expanded) show();
      else setActiveIndex(nextEnabledOption(options, active < 0 && event.key === "ArrowUp" ? options.length : active, event.key === "ArrowDown" ? 1 : -1));
      return;
    }
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const next = event.key === "Home" ? nextEnabledOption(options, -1, 1) : nextEnabledOption(options, options.length, -1);
      if (!expanded) show(next); else setActiveIndex(next);
      return;
    }
    if (event.key === "Enter" || (event.key === " " && (!search.current.text || Date.now() - search.current.time > 700))) {
      event.preventDefault();
      if (expanded) choose(active); else show();
      return;
    }
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      const now = Date.now();
      const text = now - search.current.time > 700 ? event.key : search.current.text + event.key;
      search.current = { text, time: now };
      const repeated = [...text].every(character => character.toLocaleLowerCase() === text[0].toLocaleLowerCase());
      const query = repeated ? text[0] : text;
      const next = findTypeaheadOption(options, query, expanded ? active : selectedIndex, !repeated);
      if (!expanded) show(next >= 0 ? next : selectedIndex); else if (next >= 0) setActiveIndex(next);
    }
  }

  useLayoutEffect(() => {
    if (!expanded) return;
    const updatePosition = (event?: Event) => {
      if (event?.target === list.current) return;
      if (!trigger.current || !list.current) return;
      const viewport = window.visualViewport;
      const nextPosition = positionSelectPopup(trigger.current.getBoundingClientRect(), {
        left: viewport?.offsetLeft ?? 0, top: viewport?.offsetTop ?? 0,
        width: viewport?.width ?? window.innerWidth, height: viewport?.height ?? window.innerHeight,
      }, list.current.scrollHeight + 2);
      setPosition(previous => previous && Object.keys(nextPosition).every(key => previous[key as keyof SelectPopupPosition] === nextPosition[key as keyof SelectPopupPosition]) ? previous : nextPosition);
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    window.visualViewport?.addEventListener("resize", updatePosition);
    window.visualViewport?.addEventListener("scroll", updatePosition);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => updatePosition());
    if (trigger.current) observer?.observe(trigger.current);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      window.visualViewport?.removeEventListener("resize", updatePosition);
      window.visualViewport?.removeEventListener("scroll", updatePosition);
      observer?.disconnect();
    };
  }, [expanded, options]);

  useLayoutEffect(() => {
    if (!expanded || !position || active < 0 || !list.current) return;
    const option = list.current.children[active] as HTMLElement | undefined;
    if (!option) return;
    // Scroll only the popup, never the surrounding page.
    if (option.offsetTop < list.current.scrollTop) list.current.scrollTop = option.offsetTop;
    else if (option.offsetTop + option.offsetHeight > list.current.scrollTop + list.current.clientHeight) {
      list.current.scrollTop = option.offsetTop + option.offsetHeight - list.current.clientHeight;
    }
  }, [expanded, active, position]);

  useEffect(() => {
    if (!expanded) return;
    const dismiss = (event: Event) => {
      const target = event.target as Node | null;
      if (target && !trigger.current?.contains(target) && !list.current?.contains(target)) {
        setOpen(false);
        search.current = { text: "", time: 0 };
      }
    };
    document.addEventListener("pointerdown", dismiss, true);
    document.addEventListener("focusin", dismiss, true);
    return () => {
      document.removeEventListener("pointerdown", dismiss, true);
      document.removeEventListener("focusin", dismiss, true);
    };
  }, [expanded]);

  return <>
    <button ref={trigger} id={triggerId} type="button" role="combobox" aria-label={label} aria-describedby={describedBy}
      aria-haspopup="listbox" aria-expanded={expanded} aria-controls={expanded ? listId : undefined}
      aria-activedescendant={expanded && active >= 0 ? `${listId}-${active}` : undefined}
      disabled={unavailable} className={`${styles.trigger} ${className}`} data-ui-select="trigger"
      onClick={() => expanded ? close() : show()} onKeyDown={handleKeyDown}>
      <span className={styles.value}>{options[selectedIndex]?.label ?? (value || placeholder)}</span>
      <ChevronDown aria-hidden="true" size={15} className={styles.chevron} />
    </button>
    {expanded && createPortal(<div ref={list} id={listId} role="listbox" aria-label={label} className={styles.popup}
      data-ui-select="popup" style={position ?? { visibility: "hidden" }}>
      {options.map((option, index) => <div id={`${listId}-${index}`} role="option" key={option.value}
        aria-selected={option.value === value} aria-disabled={option.disabled || undefined}
        data-active={index === active || undefined} className={styles.option}
        onPointerMove={event => { if (event.pointerType === "mouse" && !option.disabled) setActiveIndex(index); }}
        onPointerDown={event => { if (event.pointerType === "mouse") event.preventDefault(); }}
        onClick={() => choose(index)}>
        <span>{option.label}</span><Check size={15} aria-hidden="true" className={styles.check} />
      </div>)}
    </div>, document.body)}
  </>;
}
