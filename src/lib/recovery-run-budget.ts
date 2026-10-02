/** Pure, conservative admission calculation for this recovery workflow only.
 * Ledger and job-proof completeness are attestations by a trusted API adapter;
 * this module cannot authenticate GitHub, discover other callers, or reserve
 * calls durably. A serialized job must enforce its returned per-run allowance
 * and stop before expiresAt. No provider-wide or external-manual-usage guarantee.
 */
export const RECOVERY_DAILY_LIMIT = 100;
export const RECOVERY_MANUAL_RESERVATION = { requests: 7, reservedAt: "2026-10-02T10:13:00Z" } as const;
export const RECOVERY_WORKFLOW_PATH = ".github/workflows/player-data-ingestion.yml";
export const RECOVERY_INGESTION_JOB_NAME = "Ingest player data";
export const RECOVERY_FIRST_PILOT = { runId: 37006667059, jobId: 110836575247, sha: "60e9585a4f44ffb182db89fc39c381212c3944df", maxRequests: 25 } as const;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface RecoveryIngestionSkipProof {
  source: "complete-github-job-metadata";
  runId: number;
  repository: string;
  workflowPath: string;
  allAttemptsChecked: true;
  attempts: {
    runAttempt: number;
    allJobsFetched: true;
    jobId: number;
    jobName: typeof RECOVERY_INGESTION_JOB_NAME;
    steps: [];
    status: "completed";
    conclusion: "skipped";
  }[];
}

export interface RecoveryRunRecord {
  id: number;
  runAttempt: number;
  repository: string;
  workflowPath: string;
  status: string;
  conclusion: string | null;
  createdAt: string;
  startedAt: string | null;
  updatedAt: string;
  reviewedPilotProof?: { source: "complete-github-job-metadata"; runId: number; jobId: number; headSha: string; headBranch: "master"; event: "push"; maxRequests: 25; allJobsFetched: true };
  ingestionSkippedProof?: RecoveryIngestionSkipProof | null;
}

export interface RecoveryRunBudgetInput {
  now: string;
  repository: string;
  workflowPath: string;
  currentRun: { id: number; runAttempt: number };
  ledger: {
    repository: string;
    workflowPath: string;
    complete: boolean;
    allPagesFetched: boolean;
    totalCount: number;
    fetchedPages: number;
    runs: RecoveryRunRecord[];
  };
}

export type RecoveryRunBudgetResult =
  | { allowed: true; maxRequests: number; remaining: number; knownManualRequests: number; priorReservedRequests: number; dayStart: string; expiresAt: string }
  | { allowed: false; maxRequests: 0; remaining: 0; reason: string };

const deny = (reason: string): RecoveryRunBudgetResult => ({ allowed: false, maxRequests: 0, remaining: 0, reason });
const positiveInteger = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value > 0;
const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value)
  && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
  && Reflect.ownKeys(value).every(key => typeof key === "string" && "value" in Object.getOwnPropertyDescriptor(value, key)!);
const statuses = new Set(["queued", "in_progress", "completed", "waiting", "requested", "pending"]);

function timestamp(value: unknown): number | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return null;
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return null;
  const canonical = new Date(time).toISOString();
  return canonical === value || canonical.replace(".000Z", "Z") === value ? time : null;
}

function proofStatus(proof: unknown, run: RecoveryRunRecord, repository: string, workflowPath: string): "absent" | "valid" | "invalid" {
  if (proof === undefined || proof === null) return "absent";
  if (!isRecord(proof) || proof.source !== "complete-github-job-metadata" || proof.runId !== run.id
    || proof.repository !== repository || proof.workflowPath !== workflowPath || proof.allAttemptsChecked !== true
    || run.status !== "completed" || !Array.isArray(proof.attempts) || proof.attempts.length !== run.runAttempt) return "invalid";
  const attempts = new Set<number>();
  const jobs = new Set<number>();
  for (const attempt of proof.attempts) {
    if (!isRecord(attempt) || !positiveInteger(attempt.runAttempt) || attempt.runAttempt > run.runAttempt
      || attempts.has(attempt.runAttempt) || attempt.allJobsFetched !== true || !positiveInteger(attempt.jobId)
      || jobs.has(attempt.jobId) || attempt.jobName !== RECOVERY_INGESTION_JOB_NAME || !Array.isArray(attempt.steps) || attempt.steps.length !== 0
      || attempt.status !== "completed" || attempt.conclusion !== "skipped") return "invalid";
    attempts.add(attempt.runAttempt); jobs.add(attempt.jobId);
  }
  return attempts.size === run.runAttempt ? "valid" : "invalid";
}

/** Fail closed on incomplete, ambiguous, malformed, or exhausted evidence.
 * A skipped/failed/cancelled run still reserves 100 unless complete trusted job
 * metadata proves the ingestion job was skipped without steps in every attempt.
 * First attempts reserve from startedAt (createdAt while queued), not completion
 * time. UTC midnight resets admission for new runs, never an ongoing batch.
 */
export function calculateRecoveryRunBudget(input: unknown): RecoveryRunBudgetResult {
  try {
    if (!isRecord(input)) return deny("Budget input must be ordinary data");
    const { repository, workflowPath, currentRun, ledger } = input;
    const now = timestamp(input.now);
    if (now === null) return deny("A valid injected UTC timestamp is required");
    const manualAt = timestamp(RECOVERY_MANUAL_RESERVATION.reservedAt)!;
    if (typeof repository !== "string" || repository.trim() !== repository || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)
      || workflowPath !== RECOVERY_WORKFLOW_PATH) return deny("Exact repository and workflow path are required");
    if (!isRecord(currentRun) || !positiveInteger(currentRun.id) || currentRun.runAttempt !== 1) return deny("Only a current run's first attempt may request a budget");
    if (!isRecord(ledger) || ledger.repository !== repository || ledger.workflowPath !== workflowPath
      || ledger.complete !== true || ledger.allPagesFetched !== true || !positiveInteger(ledger.fetchedPages)
      || !Number.isSafeInteger(ledger.totalCount) || (ledger.totalCount as number) < 0 || !Array.isArray(ledger.runs)
      || ledger.totalCount !== ledger.runs.length) return deny("A complete, untruncated ledger for the exact repository and workflow is required");

    const dayStart = Date.parse(`${new Date(now).toISOString().slice(0, 10)}T00:00:00Z`);
    const expiresAt = dayStart + DAY_MS;
    const runIds = new Set<number>();
    let currentCount = 0;
    let priorReservedRequests = 0;
    for (const value of ledger.runs) {
      if (!isRecord(value) || !positiveInteger(value.id) || !positiveInteger(value.runAttempt)
        || value.repository !== repository || value.workflowPath !== workflowPath
        || typeof value.status !== "string" || !statuses.has(value.status)
        || !(value.conclusion === null || (typeof value.conclusion === "string" && value.conclusion.length > 0))) return deny("A run record has invalid schema or mismatched repository/workflow");
      if (runIds.has(value.id)) return deny("Duplicate run IDs make the ledger ambiguous");
      runIds.add(value.id);
      const created = timestamp(value.createdAt);
      const updated = timestamp(value.updatedAt);
      const started = value.startedAt === null ? null : timestamp(value.startedAt);
      if (created === null || updated === null || (value.startedAt !== null && started === null)
        || created > now || updated > now || (started !== null && started > now)
        || updated < created || (started !== null && (started < created || started > updated))) return deny("A run has missing, malformed, inconsistent, or future timestamps");
      if (value.status !== "completed" && value.conclusion !== null) return deny("Run status and conclusion are inconsistent");
      if (value.status === "completed" && value.conclusion === null) return deny("Completed run outcome is missing");
      const run = value as unknown as RecoveryRunRecord;
      const proof = proofStatus(value.ingestionSkippedProof, run, repository, workflowPath);
      if (proof === "invalid") return deny("Skipped-ingestion exclusion proof is incomplete or mismatched");
      let reservation = RECOVERY_DAILY_LIMIT;
      if (value.reviewedPilotProof !== undefined) {
        const bounded=value.reviewedPilotProof;
        if(!isRecord(bounded)||bounded.source!=="complete-github-job-metadata"||repository!=="fxy2026/nba-tracker"||value.id!==RECOVERY_FIRST_PILOT.runId||value.runAttempt!==1||value.status!=="completed"||value.conclusion!=="success"||bounded.runId!==value.id||bounded.jobId!==RECOVERY_FIRST_PILOT.jobId||bounded.headSha!==RECOVERY_FIRST_PILOT.sha||bounded.headBranch!=="master"||bounded.event!=="push"||bounded.maxRequests!==25||bounded.allJobsFetched!==true)return deny("Invalid immutable pilot bound proof");
        reservation=RECOVERY_FIRST_PILOT.maxRequests;
      }
      if (value.id === currentRun.id) {
        currentCount++;
        if (value.runAttempt !== 1) return deny("The current run is a rerun");
        if (value.status === "completed") return deny("The current run is already completed");
        if (started === null || started < dayStart) return deny("The current run must start in the current UTC day; no mid-run quota reset");
        continue; // This run receives the resulting allowance, not another 100.
      }
      if (proof === "valid") continue;
      if (started === null && (value.status === "completed" || value.status === "in_progress")) return deny("A potentially executed run has no start timestamp");
      // Rerun metadata may refer to a later attempt; count any recent activity.
      const reservationAt = value.runAttempt > 1 ? Math.max(created, started ?? created, updated) : started ?? created;
      if (reservationAt >= dayStart) priorReservedRequests += reservation;
      else if (value.status !== "completed") return deny("An old nonterminal run leaves outstanding usage uncertain");
      if (!Number.isSafeInteger(priorReservedRequests)) return deny("Reservation counts are uncertain");
    }
    if (currentCount !== 1) return deny("The current run must appear exactly once in the complete ledger");
    // Known external manual usage is reported separately and conservatively
    // subtracted; this calculator cannot observe or control other manual calls.
    const knownManualRequests = manualAt >= dayStart && manualAt <= now ? RECOVERY_MANUAL_RESERVATION.requests : 0;
    const remaining = Math.max(0, RECOVERY_DAILY_LIMIT - priorReservedRequests - knownManualRequests);
    if (remaining === 0) return deny("The UTC-day allowance is fully reserved");
    return { allowed: true, maxRequests: remaining, remaining, knownManualRequests, priorReservedRequests,
      dayStart: new Date(dayStart).toISOString(), expiresAt: new Date(expiresAt).toISOString() };
  } catch {
    return deny("Budget evidence could not be validated safely");
  }
}
