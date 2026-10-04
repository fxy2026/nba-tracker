// Server-only archive loading. Evidence and unconsumed source fields never enter
// client props, and serving a snapshot does not update its retrieval timestamp.
import { createHash } from "node:crypto";
import { normalizeHistoricalCareerData, type HistoricalCareerData } from "./historical-career-data";

const archives: Record<number, { sha256: string; read: () => Promise<unknown> }> = {
  893: {
    sha256: "8006fe4fb1aec9e98c9d967f1b25188025ff083ff787e4f997472f68f6c28e23",
    read: () => import("@/data/historical-career-archives/893-2026-10-04.json").then(module => module.default),
  },
};

export function validateHistoricalCareerArchive(raw: unknown, playerId: number, sha256: string): HistoricalCareerData | null {
  try {
    const encoded = JSON.stringify(raw);
    if (typeof encoded !== "string" || createHash("sha256").update(encoded).digest("hex") !== sha256) return null;
    return normalizeHistoricalCareerData(raw, playerId);
  } catch { return null; }
}
export async function getHistoricalCareerArchive(playerId: number): Promise<HistoricalCareerData | null> {
  if (!Object.hasOwn(archives, playerId)) return null;
  const archive = archives[playerId];
  try { return validateHistoricalCareerArchive(await archive.read(), playerId, archive.sha256); }
  catch { return null; }
}
