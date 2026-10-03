// Server-only: node:crypto plus imports used solely by /api/player. No archive
// dataset or evidence is imported by client hooks/components.
import { createHash } from "node:crypto";
import { validateCareerArchive, type ValidatedCareerArchive } from "./player-career-archive-validation";

// Immutable allowlist. A new capture requires independent source/data review
// and a new dated file/hash. Visitor requests never write or fetch an archive.
const archives: Record<string, { reviewed: boolean; sha256: string; read: () => Promise<unknown> }> = {
  "2544": {
    reviewed: true,
    sha256: "519e96ee707e44df00c52400ce19dee4119fd9b35969961d7bc8ee7178e2911d",
    read: () => import("@/data/player-career-archives/2544-2026-10-03.json").then(module => module.default),
  },
  "203999": {
    reviewed: true,
    sha256: "9b09f438d30dd89a5fa2480c97178020df08c9f110eb45e36bdc4648c4383241",
    read: () => import("@/data/player-career-archives/203999-2026-10-03.json").then(module => module.default),
  },
  "201939": {
    reviewed: true,
    sha256: "280e3340ab86bf6f998e8d448dabcdd6706439efbca6979f7438348af731560c",
    read: () => import("@/data/player-career-archives/201939-2026-10-03.json").then(module => module.default),
  },
  "203507": {
    reviewed: true,
    sha256: "8270f47fe4bf8af14c9ed810337c31ed204838bd7dff750b30fd7458713e01fb",
    read: () => import("@/data/player-career-archives/203507-2026-10-03.json").then(module => module.default),
  },
};

export function validateReviewedCareerArchive(raw: unknown, playerId: string, reviewedHash: string): ValidatedCareerArchive | null {
  try {
    const encoded = JSON.stringify(raw);
    if (typeof encoded !== "string" || createHash("sha256").update(encoded).digest("hex") !== reviewedHash) return null;
    return validateCareerArchive(raw, playerId);
  } catch { return null; }
}

export async function getReviewedCareerArchive(playerId: string): Promise<ValidatedCareerArchive | null> {
  if (!Object.hasOwn(archives, playerId)) return null;
  const entry = archives[playerId];
  if (!entry.reviewed) return null;
  try {
    const raw = await entry.read();
    return validateReviewedCareerArchive(raw, playerId, entry.sha256);
  } catch { return null; }
}
