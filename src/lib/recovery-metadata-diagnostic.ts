/** Fixed-shape, content-free diagnostics for an already captured JSON body.
 * This does not validate player data, change parser acceptance, or establish
 * provider availability/plan coverage. No body, names, messages, or keys escape.
 */
export type DiagnosticKind = "missing" | "undefined" | "null" | "object" | "array" | "string" | "number" | "boolean" | "invalid";
export type DiagnosticFlag = "true" | "false" | "missing" | "invalid";
export type DiagnosticPlanCode = "history_not_included" | "plan_required";
type FlagName = "available" | "players_available" | "team_stats_available";
type CountName = "players" | "team_stats";
export type MetadataGateFailure = "malformed-envelope" | "malformed-data" | "malformed-meta"
  | `flag-${FlagName}-false` | `flag-${FlagName}-missing-or-invalid`
  | "withheld-missing-or-malformed" | `withheld-${CountName}-missing-or-invalid` | "withheld-players-positive";
export interface RecoveryMetadataDiagnostic {
  version: 1;
  envelope: DiagnosticKind;
  data: DiagnosticKind;
  meta: DiagnosticKind;
  flags: Record<FlagName, DiagnosticFlag>;
  withheld: { kind: DiagnosticKind; players: { kind: DiagnosticKind; count: number | null }; team_stats: { kind: DiagnosticKind; count: number | null } };
  arrays: { players: { kind: DiagnosticKind; count: number | null }; team_stats: { kind: DiagnosticKind; count: number | null } };
  metadataGateFailures: MetadataGateFailure[];
  planErrorCodes: DiagnosticPlanCode[];
}

const MISSING = Symbol("missing");
const INVALID = Symbol("invalid");
function kind(value: unknown): DiagnosticKind {
  if (value === MISSING) return "missing";
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  try {
    if (Array.isArray(value)) return "array";
    if (typeof value === "object") return "object";
  } catch { return "invalid"; }
  switch (typeof value) {
    case "string": return "string";
    case "number": return "number";
    case "boolean": return "boolean";
    default: return "invalid";
  }
}

// Do not execute accessors, coerce values, enumerate arbitrary keys, or walk
// arrays. JSON has only own data properties; inherited values are not evidence.
function own(value: unknown, key: string): unknown {
  if (kind(value) !== "object" && kind(value) !== "array") return MISSING;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor) return MISSING;
    return "value" in descriptor ? descriptor.value : INVALID;
  } catch { return INVALID; }
}
function flag(value: unknown): DiagnosticFlag {
  return value === true ? "true" : value === false ? "false" : value === MISSING ? "missing" : "invalid";
}
function count(value: unknown) {
  return { kind: kind(value), count: typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null };
}
function arrayCount(value: unknown) {
  const length = own(value, "length");
  return { kind: kind(value), count: kind(value) === "array" && typeof length === "number" && Number.isSafeInteger(length) && length >= 0 ? length : null };
}

export function diagnoseRecoveryMetadata(raw: unknown): RecoveryMetadataDiagnostic {
  const data = own(raw, "data"), meta = own(raw, "meta");
  const withheld = own(meta, "withheld");
  const flags: RecoveryMetadataDiagnostic["flags"] = {
    available: flag(own(meta, "available")),
    players_available: flag(own(meta, "players_available")),
    team_stats_available: flag(own(meta, "team_stats_available")),
  };
  const metadataGateFailures: MetadataGateFailure[] = [];
  if (kind(raw) !== "object") metadataGateFailures.push("malformed-envelope");
  else {
    if (kind(data) !== "object") metadataGateFailures.push("malformed-data");
    if (kind(meta) !== "object") metadataGateFailures.push("malformed-meta");
    else {
      for (const name of ["available", "players_available", "team_stats_available"] as const) {
        if (flags[name] === "false") metadataGateFailures.push(`flag-${name}-false`);
        else if (flags[name] !== "true") metadataGateFailures.push(`flag-${name}-missing-or-invalid`);
      }
      if (kind(withheld) !== "object") metadataGateFailures.push("withheld-missing-or-malformed");
      else for (const name of ["players", "team_stats"] as const) {
        const value = own(withheld, name);
        if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) metadataGateFailures.push(`withheld-${name}-missing-or-invalid`);
        // A positive team-stat count remains informational: this recovery
        // publishes player values only, with a separate team-identity check.
        else if (name === "players" && value > 0) metadataGateFailures.push("withheld-players-positive");
      }
    }
  }
  // Only exact tokens at these fixed code locations are reported. These are
  // safe labels, not evidence that the provider uses them or requires payment.
  const codes = [own(raw, "code"), own(own(raw, "error"), "code"), own(meta, "code"), own(own(meta, "error"), "code")];
  const planErrorCodes: DiagnosticPlanCode[] = [];
  for (const code of ["history_not_included", "plan_required"] as const) {
    if (codes.includes(code)) planErrorCodes.push(code);
  }
  return {
    version: 1, envelope: kind(raw), data: kind(data), meta: kind(meta), flags,
    withheld: { kind: kind(withheld), players: count(own(withheld, "players")), team_stats: count(own(withheld, "team_stats")) },
    arrays: { players: arrayCount(own(data, "players")), team_stats: arrayCount(own(data, "team_stats")) },
    metadataGateFailures, planErrorCodes,
  };
}
