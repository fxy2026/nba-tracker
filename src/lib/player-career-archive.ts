// Server-only: node:crypto plus imports used solely by /api/player. No archive
// dataset or evidence is imported by client hooks/components.
import { createHash } from "node:crypto";
import { validateCareerArchive, type ValidatedCareerArchive } from "./player-career-archive-validation";

// Immutable allowlist. A new capture requires independent source/data review
// and a new dated file/hash. Visitor requests never write or fetch an archive.
const archives: Record<string, { reviewed: boolean; sha256: string; read: () => Promise<unknown> }> = {
  "2544": {
    reviewed: true,
    sha256: "5f7b73768c91111508da248e55f8070eab71ea8ff5d39fea5c93238a8eea343b",
    read: () => import("@/data/player-career-archives/2544-2026-10-03.json").then(module => module.default),
  },
  "203999": {
    reviewed: true,
    sha256: "70b8b255c97d7a74160c7493d46dc3ef7b11c561164ad0c08d55061940a4682f",
    read: () => import("@/data/player-career-archives/203999-2026-10-03.json").then(module => module.default),
  },
  "201939": {
    reviewed: true,
    sha256: "8f84c64775d19545806ccdd1480a42e4d2ed47b2dc420ee56c85bf6c7d56a716",
    read: () => import("@/data/player-career-archives/201939-2026-10-03.json").then(module => module.default),
  },
  "203507": {
    reviewed: true,
    sha256: "b73fb099aef69b35649c1f4481f40907aa9d8fef0fad4b600e04cca26b80057f",
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
