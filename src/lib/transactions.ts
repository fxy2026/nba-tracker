// Best-effort parsing of ESPN transaction prose. ESPN supplies only a free-text
// `description` (no structured player/type fields), so we extract what we can and
// leave results empty on no match — never fabricated.

export type TransactionKind = "signed" | "traded" | "waived" | "claimed" | "other";

// A position token (C/G/F, two-letter PG/SG/SF/PF, optional plural "Gs"/"Fs")
// immediately followed by a 2+ word capitalized name. Each name token allows an
// internal capital (DeRozan/LaVine), apostrophe (Day'Ron) and hyphen
// (Finney-Smith), and ends on a lowercase letter so a trailing sentence period is
// never absorbed and the match cannot bleed into the next capitalized word.
const PLAYER_RE = /\b(?:PG|SG|SF|PF|C|G|F)s?\s+([A-Z][A-Za-z'-]*[a-z](?:\s+[A-Z][A-Za-z'-]*[a-z])+)/g;

export function parseTransactionPlayers(description: string): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  for (const match of description.matchAll(PLAYER_RE)) {
    const name = match[1].trim();
    if (!seen.has(name)) {
      seen.add(name);
      names.push(name);
    }
  }
  return names;
}

// A description may describe several actions ("Signed ... Acquired ..."); we
// return the kind whose keyword appears EARLIEST in the text (the first/primary
// action), or "other" on no match.
const KIND_KEYWORDS: { kind: TransactionKind; patterns: string[] }[] = [
  { kind: "signed", patterns: ["sign"] },
  { kind: "traded", patterns: ["trad", "acquir"] },
  { kind: "waived", patterns: ["waiv"] },
  { kind: "claimed", patterns: ["claim"] },
];

export function classifyTransaction(description: string): TransactionKind {
  const lower = description.toLowerCase();
  let best: { kind: TransactionKind; index: number } | null = null;
  for (const { kind, patterns } of KIND_KEYWORDS) {
    for (const pattern of patterns) {
      const index = lower.indexOf(pattern);
      if (index === -1) continue;
      if (best === null || index < best.index) best = { kind, index };
    }
  }
  return best?.kind ?? "other";
}
