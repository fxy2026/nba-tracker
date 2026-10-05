"use client";

import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { PLAYER_PANELS, playerPanelFromLocation, playerPanelHref, type PlayerPanel } from "@/lib/player-mobile-navigation";
import styles from "./player-panels.module.css";

const NAVIGATION_EVENT = "player-profile-navigation";
const labels: Record<PlayerPanel, [string, string]> = {
  data: ["数据", "Data"], shooting: ["投篮", "Shooting"], honors: ["荣誉", "Honors"],
  career: ["生涯", "Career"], games: ["比赛", "Games"], news: ["资讯", "News"], details: ["资料", "Details"],
};
function subscribeViewport(notify: () => void) {
  const media = window.matchMedia("(max-width: 639px)");
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
}
function mobileSnapshot() { return window.matchMedia("(max-width: 639px)").matches; }
function serverViewport() { return null; }
function subscribeLocation(notify: () => void) {
  window.addEventListener("popstate", notify);
  window.addEventListener("hashchange", notify);
  window.addEventListener(NAVIGATION_EVENT, notify);
  return () => {
    window.removeEventListener("popstate", notify);
    window.removeEventListener("hashchange", notify);
    window.removeEventListener(NAVIGATION_EVENT, notify);
  };
}
/** Next's patched native history API preserves its route tree, including Back across players. */
export function commitPlayerProfileUrl(href: string) {
  if (`${window.location.pathname}${window.location.search}${window.location.hash}` === href) return;
  window.history.pushState(null, "", href);
  window.dispatchEvent(new Event(NAVIGATION_EVENT));
}
export function usePlayerProfileLocation(playerId: number, initialSearch = "") {
  return useSyncExternalStore(subscribeLocation, () => [`/player/${playerId}`, `/player/${playerId}/gamelog`].includes(window.location.pathname)
    ? `${window.location.search}${window.location.hash}` : initialSearch, () => initialSearch);
}
const PanelContext = createContext<{ mobile: boolean | null; active: PlayerPanel }>({ mobile: null, active: "data" });

export default function PlayerProfilePanels({ playerId, locale, initialSearch = "", panels = PLAYER_PANELS, header, children }: {
  playerId: number; locale: "en" | "zh"; initialSearch?: string; panels?: readonly PlayerPanel[]; header: ReactNode; children: ReactNode;
}) {
  const mobile = useSyncExternalStore(subscribeViewport, mobileSnapshot, serverViewport);
  const location = usePlayerProfileLocation(playerId, initialSearch);
  const [search, hash] = location.split("#");
  const active = playerPanelFromLocation(search, hash ? `#${hash}` : "", panels);
  const tabs = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const lastFocusedPanel = useRef<string | null>(null);
  useEffect(() => {
    if (mobile !== true) return;
    const focused = document.activeElement;
    const hiddenPart = focused?.closest("[data-profile-part]");
    const browserClearedHiddenFocus = focused === document.body && lastFocusedPanel.current !== null && lastFocusedPanel.current !== active;
    if (browserClearedHiddenFocus || (hiddenPart && hiddenPart.getAttribute("data-profile-part") !== active && body.current?.contains(focused)) || (tabs.current?.contains(focused) && focused?.id !== `player-tab-${playerId}-${active}`)) {
      lastFocusedPanel.current = null;
      document.getElementById(`player-tab-${playerId}-${active}`)?.focus({ preventScroll: true });
    }
  }, [active, mobile, playerId]);
  const choose = (panel: PlayerPanel) => {
    commitPlayerProfileUrl(playerPanelHref(window.location.href, panel));
    const button = document.getElementById(`player-tab-${playerId}-${panel}`);
    button?.scrollIntoView({ block: "nearest", inline: "nearest" });
    // Keep the compact navigation visible when switching from a long panel.
    const top = tabs.current?.getBoundingClientRect().top;
    const headerHeight = parseFloat(tabs.current ? getComputedStyle(tabs.current).top : "48") || 48;
    if (top != null && top <= headerHeight + 1 && body.current && tabs.current) {
      // The body remains in normal flow. A sticky tab's own rect cannot tell us
      // its original document position once a long panel has been scrolled.
      const contentTop = body.current.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: Math.max(0, contentTop - headerHeight - tabs.current.getBoundingClientRect().height), behavior: "instant" });
    }
  };
  return <PanelContext.Provider value={{ mobile, active }}>
    <div className={styles.shell} data-player-panel={active}>
      <div className={styles.mobileHeader}>{header}</div>
      <div ref={tabs} className={styles.tabs} role="tablist" aria-label={locale === "zh" ? "球员页面" : "Player sections"}>
        {panels.map((panel, index) => <button key={panel} type="button" role="tab"
          id={`player-tab-${playerId}-${panel}`} aria-selected={active === panel}
          aria-controls={`player-panel-${playerId}`} tabIndex={active === panel ? 0 : -1}
          onClick={() => choose(panel)} onKeyDown={event => {
            const next = event.key === "ArrowRight" ? (index + 1) % panels.length : event.key === "ArrowLeft" ? (index + panels.length - 1) % panels.length : event.key === "Home" ? 0 : event.key === "End" ? panels.length - 1 : null;
            if (next === null) return;
            event.preventDefault();
            document.getElementById(`player-tab-${playerId}-${panels[next]}`)?.focus({ preventScroll: true });
            choose(panels[next]);
          }}>{labels[panel][locale === "zh" ? 0 : 1]}</button>)}
      </div>
      <div ref={body} id={`player-panel-${playerId}`} className={styles.body}
        onFocusCapture={event => { lastFocusedPanel.current = event.target.closest("[data-profile-part]")?.getAttribute("data-profile-part") ?? null; }}
        onBlurCapture={event => { if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) lastFocusedPanel.current = null; }}
        role={mobile === false ? undefined : "tabpanel"}
        aria-labelledby={mobile === false ? undefined : `player-tab-${playerId}-${active}`} tabIndex={mobile === false ? undefined : 0}>
        {children}
      </div>
    </div>
  </PanelContext.Provider>;
}

/** One subtree per feature. Unvisited phone panels do not mount fetching children;
 * visited ones stay mounted and hidden, preserving controls, caches and scrollable tables. */
export function PlayerProfilePart({ panel, deferred = false, mobileOnly = false, children }: {
  panel: PlayerPanel; deferred?: boolean; mobileOnly?: boolean; children: ReactNode;
}) {
  const { mobile, active } = useContext(PanelContext);
  const [activated, setActivated] = useState(false);
  const eligible = mobile === true ? active === panel : mobile === false && !mobileOnly;
  // A guarded render-time adjustment avoids an effect-only blank frame and never
  // activates hidden mobile data owners during the server/hydration pass.
  if (eligible && !activated) setActivated(true);
  const mounted = eligible || activated || (!deferred && mobile === null);
  return <div className={`${styles.part} ${mobileOnly ? styles.mobileOnly : ""}`} data-profile-part={panel}
    hidden={mobile === true && active !== panel}>
    {mounted ? children : <div className={styles.loading} aria-busy="true"><span className="skeleton-shimmer" /></div>}
  </div>;
}
export function PlayerDesktopOnly({ children }: { children: ReactNode }) {
  return <div className={styles.desktopOnly}>{children}</div>;
}

/** Keep the surrounding server-rendered source labels and deep-link targets,
 * while delaying just the interactive data owner until its panel is needed. */
export function PlayerDeferred({ panel, children }: { panel: PlayerPanel; children: ReactNode }) {
  const { mobile, active } = useContext(PanelContext);
  const [activated, setActivated] = useState(false);
  const eligible = mobile === false || (mobile === true && active === panel);
  if (eligible && !activated) setActivated(true);
  return eligible || activated ? children : <div className={styles.loading} data-player-deferred={panel} aria-busy="true"><span className="skeleton-shimmer" /></div>;
}
