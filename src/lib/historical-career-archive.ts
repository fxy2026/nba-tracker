// Server-only archive loading. Evidence and unconsumed source fields never enter
// client props, and serving a snapshot does not update its retrieval timestamp.
import { createHash } from "node:crypto";
import { normalizeHistoricalCareerData, type HistoricalCareerData } from "./historical-career-data";

const archives: Record<number, { sha256: string; read: () => Promise<unknown>; retrievalPrecision?: "approximate-minute" }> = {
  893: {
    sha256: "8006fe4fb1aec9e98c9d967f1b25188025ff083ff787e4f997472f68f6c28e23",
    read: () => import("@/data/historical-career-archives/893-2026-10-04.json").then(module => module.default),
  },
  977: {
    sha256: "5d851d07b14e2c3e8eb46152b00113e05b07f73afd9bad1f34946b4180979490",
    read: () => import("@/data/historical-career-archives/977-2026-10-04.json").then(module => module.default),
  },
  1495: {
    sha256: "d2c974405e6e3dc2b4ffbfb20d89885bacb1a227a273bd0a240d228f76a53ad6",
    read: () => import("@/data/historical-career-archives/1495-2026-10-04.json").then(module => module.default),
  },
  76003: {
    sha256: "3be60da0aaf6a7784b0d6a8b8377df9bcca5be0f05a1bf31615e81a512b4c571",
    retrievalPrecision: "approximate-minute",
    read: () => import("@/data/historical-career-archives/76003-2026-10-04.json").then(module => module.default),
  },
  76375: {
    sha256: "5e9fab865536a6d3f8bb0a572ed5c83f978020b176321d9fd9f9685a91bde0b5",
    retrievalPrecision: "approximate-minute",
    read: () => import("@/data/historical-career-archives/76375-2026-10-04.json").then(module => module.default),
  },
  406: {
    sha256: "9f6dfabb0c0ea4852880d6c6be586b29651c970864a511f84a339264fe193a25",
    read: () => import("@/data/historical-career-archives/406-2026-10-04.json").then(module => module.default),
  },
  77142: {
    sha256: "c368f36994021e80c20b0ec1d25f3db00761488c4edff3ab73260069ef8c9158",
    read: () => import("@/data/historical-career-archives/77142-2026-10-04.json").then(module => module.default),
  },
  1449: {
    sha256: "45b4a77bc8b485d7b48ae28ecab57cb190191171715d480f1c78e2823a344710",
    read: () => import("@/data/historical-career-archives/1449-2026-10-04.json").then(module => module.default),
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
  try {
    const data = validateHistoricalCareerArchive(await archive.read(), playerId, archive.sha256);
    return data && archive.retrievalPrecision ? { ...data, retrievalPrecision: archive.retrievalPrecision } : data;
  }
  catch { return null; }
}
