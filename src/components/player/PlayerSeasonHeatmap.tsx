"use client";

import { useEffect, useRef, useState } from "react";
import SeasonHeatmapExplorer, { type SeasonHeatmapDatasetMetadata, type SeasonHeatmapResource } from "../SeasonHeatmapExplorer";
import { datasetKey } from "../season-heatmap/season-heatmap-display";
import { decodeSeasonHeatmapResource, type SeasonHeatmapArchiveResource } from "@/lib/season-heatmap-client";
import type { HeatmapIdentity } from "@/lib/season-heatmap";

interface PlayerSeasonHeatmapProps {
  player: { id: number; name: string; secondaryName?: string; teamLabel?: string };
  locale: "en" | "zh";
  datasets: readonly SeasonHeatmapDatasetMetadata[];
  initialSelection: HeatmapIdentity;
  initialResource: SeasonHeatmapArchiveResource;
}

export default function PlayerSeasonHeatmap(props: PlayerSeasonHeatmapProps) {
  return <HeatmapSession key={props.player.id} {...props} />;
}

function HeatmapSession({ player, locale, datasets, initialSelection, initialResource }: PlayerSeasonHeatmapProps) {
  const [resources, setResources] = useState<Record<string, SeasonHeatmapResource>>(() => ({ [datasetKey(initialSelection)]: decodeSeasonHeatmapResource(initialResource, initialSelection) }));
  const cache = useRef(resources);
  const mounted = useRef(true);
  const pending = useRef(new Map<string, { controller: AbortController; timer: ReturnType<typeof setTimeout> }>());
  useEffect(() => {
    mounted.current = true;
    const requests = pending.current;
    return () => {
      mounted.current = false;
      for (const { controller, timer } of requests.values()) { clearTimeout(timer); controller.abort(); }
      requests.clear();
    };
  }, []);

  async function request(identity: HeatmapIdentity, reason: "select" | "retry") {
    const key = datasetKey(identity);
    if (identity.playerId !== player.id || !datasets.some(item => datasetKey(item) === key && item.availability === "available")) return;
    if (reason === "select" && (cache.current[key]?.status === "ready" || pending.current.has(key))) return;
    const previous = pending.current.get(key);
    if (previous) { clearTimeout(previous.timer); previous.controller.abort(); }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      update({ status: "error" });
      if (pending.current.get(key) === active) pending.current.delete(key);
      controller.abort();
    }, 8000);
    const active = { controller, timer };
    pending.current.set(key, active);
    const update = (resource: SeasonHeatmapResource) => {
      if (!mounted.current || pending.current.get(key) !== active) return;
      cache.current = { ...cache.current, [key]: resource };
      setResources(cache.current);
    };
    update({ status: "loading" });
    try {
      const query = new URLSearchParams({ playerId: String(identity.playerId), season: identity.season, seasonType: identity.seasonType });
      const response = await fetch(`/api/player-season-heatmap?${query}`, { signal: controller.signal, cache: reason === "retry" ? "no-store" : "default" });
      const resource = decodeSeasonHeatmapResource(await response.json(), identity);
      update(response.ok && resource.status === "ready" || response.status === 404 && resource.status === "unavailable" ? resource : { status: "error" });
    } catch {
      update({ status: "error" });
    } finally {
      clearTimeout(timer);
      if (pending.current.get(key) === active) pending.current.delete(key);
    }
  }

  return <SeasonHeatmapExplorer player={player} locale={locale} datasets={datasets} resources={resources} initialSelection={initialSelection} publication="verified" onRequest={request} />;
}
