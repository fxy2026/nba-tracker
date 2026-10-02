import { describe, expect, it } from "vitest";
import {
  calculateRecoveryRunBudget, RECOVERY_WORKFLOW_PATH, RECOVERY_INGESTION_JOB_NAME,
  type RecoveryRunBudgetInput, type RecoveryRunRecord, type RecoveryIngestionSkipProof,
} from "./recovery-run-budget";

const repository = "example/nba-tracker";
const now = "2026-10-02T11:00:00Z";
const record = (overrides: Partial<RecoveryRunRecord> = {}): RecoveryRunRecord => ({
  id: 2, runAttempt: 1, repository, workflowPath: RECOVERY_WORKFLOW_PATH,
  status: "in_progress", conclusion: null,
  createdAt: "2026-10-02T10:59:00Z", startedAt: "2026-10-02T10:59:10Z", updatedAt: "2026-10-02T10:59:20Z", ...overrides,
});
const prior = (overrides: Partial<RecoveryRunRecord> = {}) => record({ id: 1, status: "completed", conclusion: "success", createdAt: "2026-10-02T10:00:00Z", startedAt: "2026-10-02T10:00:10Z", updatedAt: "2026-10-02T10:05:00Z", ...overrides });
const input = (runs: RecoveryRunRecord[] = [record()], injectedNow = now): RecoveryRunBudgetInput => ({
  now: injectedNow, repository, workflowPath: RECOVERY_WORKFLOW_PATH, currentRun: { id: 2, runAttempt: 1 },
  ledger: { repository, workflowPath: RECOVERY_WORKFLOW_PATH, complete: true, allPagesFetched: true, totalCount: runs.length, fetchedPages: 1, runs },
});
const skippedProof = (run: RecoveryRunRecord): RecoveryIngestionSkipProof => ({
  source: "complete-github-job-metadata", runId: run.id, repository, workflowPath: RECOVERY_WORKFLOW_PATH, allAttemptsChecked: true,
  attempts: Array.from({ length: run.runAttempt }, (_, i) => ({ runAttempt: i + 1, allJobsFetched: true, jobId: 100 + i, jobName: RECOVERY_INGESTION_JOB_NAME, status: "completed", conclusion: "skipped", steps: [] })),
});
function denied(value: unknown, reason?: string) {
  const result = calculateRecoveryRunBudget(value);
  expect(result).toMatchObject({ allowed: false, maxRequests: 0, remaining: 0 });
  if (!result.allowed) { expect(result.reason.length).toBeGreaterThan(0); if (reason) expect(result.reason).toContain(reason); }
}

describe("pure conservative recovery workflow run budget", () => {
  it("reserves the known manual seven and gives the only current run93", () => {
    expect(calculateRecoveryRunBudget(input())).toMatchObject({ allowed: true, maxRequests: 93, remaining: 93, knownManualRequests: 7, priorReservedRequests: 0 });
  });
  it("excludes the current run exactly once instead of charging it another100", () => {
    const result = calculateRecoveryRunBudget(input());
    expect(result.allowed).toBe(true); if (result.allowed) expect(result.maxRequests).toBeLessThanOrEqual(100);
  });
  it.each(["success", "failure", "cancelled", "skipped", "timed_out", "neutral", "action_required"])("a prior %s run reserves100 without a refund", conclusion => denied(input([record(), prior({ conclusion })]), "fully reserved"));
  it.each(["queued", "waiting", "pending", "requested", "in_progress"])("counts a concurrent prior %s run conservatively", status => denied(input([record(), prior({ status, conclusion: null, startedAt: status === "in_progress" ? "2026-10-02T10:00:10Z" : null })]), "fully reserved"));
  it("counts a crashed/in-progress prior run even without any success", () => denied(input([record(), prior({ status: "in_progress", conclusion: null })]), "fully reserved"));
  it("denies reruns in either current input or ledger", () => {
    const raw = input(); raw.currentRun.runAttempt = 2; denied(raw, "first attempt");
    denied(input([record({ runAttempt: 2 })]), "rerun");
  });
  it("counts an old run whose rerun updated recently", () => {
    denied(input([record(), prior({ runAttempt: 2, createdAt: "2026-09-25T10:00:00Z", startedAt: "2026-09-25T10:00:10Z", updatedAt: "2026-10-02T10:05:00Z" })]), "fully reserved");
  });
  it("does not extend first-attempt reservations because completion updated later", () => {
    const old = prior({ createdAt: "2026-09-25T10:00:00Z", startedAt: "2026-09-25T10:00:10Z", updatedAt: "2026-10-02T10:05:00Z" });
    expect(calculateRecoveryRunBudget(input([record(), old]))).toMatchObject({ allowed: true, maxRequests: 93 });
  });
  it("denies an old uncompleted run whose outstanding usage is uncertain", () => {
    const old = prior({ status: "queued", conclusion: null, createdAt: "2026-09-25T10:00:00Z", startedAt: null, updatedAt: "2026-09-25T10:00:00Z" });
    denied(input([record(), old]), "nonterminal");
  });
  it("counts reservations starting exactly at UTC midnight and ages out yesterday's completed runs", () => {
    const today = prior({ createdAt: "2026-10-02T00:00:00Z", startedAt: "2026-10-02T00:00:00Z", updatedAt: "2026-10-02T00:00:01Z" });
    denied(input([record(), today]), "fully reserved");
    const yesterday = prior({ createdAt: "2026-10-01T23:58:00Z", startedAt: "2026-10-01T23:59:59.999Z", updatedAt: "2026-10-01T23:59:59.999Z" });
    expect(calculateRecoveryRunBudget(input([record(), yesterday]))).toMatchObject({ allowed: true, maxRequests: 93 });
  });
  it("returns an exact midnight expiry and tracks manual seven only on its UTC day", () => {
    const lastMinute = record({ createdAt: "2026-10-02T23:58:00Z", startedAt: "2026-10-02T23:58:10Z", updatedAt: "2026-10-02T23:58:20Z" });
    expect(calculateRecoveryRunBudget(input([lastMinute], "2026-10-02T23:59:59.999Z"))).toMatchObject({ allowed: true, maxRequests: 93, knownManualRequests: 7, dayStart: "2026-10-02T00:00:00.000Z", expiresAt: "2026-10-03T00:00:00.000Z" });
    const nextDay = record({ createdAt: "2026-10-02T23:59:59Z", startedAt: "2026-10-03T00:00:00Z", updatedAt: "2026-10-03T00:00:00Z" });
    expect(calculateRecoveryRunBudget(input([nextDay], "2026-10-03T00:00:00Z"))).toMatchObject({ allowed: true, maxRequests: 100, knownManualRequests: 0, expiresAt: "2026-10-04T00:00:00.000Z" });
  });
  it("does not refill an in-flight batch at midnight or allow a current run without a start", () => {
    const crossing = record({ createdAt: "2026-10-02T23:59:00Z", startedAt: "2026-10-02T23:59:30Z", updatedAt: "2026-10-03T00:00:00Z" });
    denied(input([crossing], "2026-10-03T00:00:00Z"), "no mid-run quota reset");
    denied(input([record({ startedAt: null, status: "queued" })]), "must start");
  });

  it.each([null, undefined, {}, { now }, { ...input(), ledger: null }])("denies missing budget/ledger evidence %#", raw => denied(raw));
  it.each([
    { complete: false }, { allPagesFetched: false }, { fetchedPages: 0 }, { fetchedPages: 1.5 }, { totalCount: 2 }, { totalCount: NaN },
    { repository: "other/repo" }, { workflowPath: ".github/workflows/other.yml" }, { runs: {} },
  ])("denies incomplete/truncated/mismatched ledger %#", changes => {
    const raw = input(); Object.assign(raw.ledger, changes); denied(raw, "complete, untruncated ledger");
  });
  it("requires the current run and forbids duplicate current or prior IDs", () => {
    denied(input([prior()]), "current run must appear exactly once");
    denied(input([record(), record()]), "Duplicate run IDs");
    denied(input([record(), prior(), prior()]), "Duplicate run IDs");
  });
  it.each([
    { id: 0 }, { id: Number.MAX_SAFE_INTEGER + 1 }, { runAttempt: 0 }, { status: "unknown" }, { conclusion: 1 },
    { repository: "other/repo" }, { workflowPath: ".github/workflows/other.yml" },
  ])("denies invalid record schema/scope %#", changes => denied(input([record(), { ...prior(), ...changes } as RecoveryRunRecord]), "invalid schema"));
  it.each([
    { createdAt: "bad" }, { updatedAt: "bad" }, { startedAt: "bad" }, { createdAt: "2026-02-30T00:00:00Z" },
    { createdAt: "2026-10-02" }, { createdAt: "2026-10-02T10:00:00+00:00" }, { updatedAt: "2026-10-03T10:00:00Z" },
    { updatedAt: "2026-10-02T09:00:00Z" }, { startedAt: "2026-10-02T09:00:00Z" }, { startedAt: undefined },
  ])("denies uncertain timestamps %#", changes => denied(input([record(), { ...prior(), ...changes } as RecoveryRunRecord]), "timestamps"));
  it("denies inconsistent outcomes, stale/completed current runs, and executed runs without a start", () => {
    denied(input([record({ conclusion: "success" })]), "inconsistent");
    denied(input([record(), prior({ conclusion: null })]), "outcome is missing");
    denied(input([record({ status: "completed", conclusion: "success" })]), "already completed");
    denied(input([record({ createdAt: "2026-09-25T10:00:00Z", startedAt: "2026-09-25T10:00:10Z", updatedAt: "2026-09-25T10:00:20Z" })]), "must start");
    denied(input([record(), prior({ startedAt: null })]), "no start timestamp");
  });
  it.each(["bad", "2026-02-30T11:00:00Z", "2026-10-02T10:12:59Z"])("denies invalid injected now %s", injectedNow => denied(input([record()], injectedNow)));
  it("requires exact configured workflow and a repository identity", () => {
    denied({ ...input(), workflowPath: ".github/workflows/other.yml" }, "Exact repository");
    denied({ ...input(), repository: "repo" }, "Exact repository");
  });

  it("excludes a completed skipped ingestion job only with complete all-attempt proof", () => {
    const old = prior({ conclusion: "skipped" }); old.ingestionSkippedProof = skippedProof(old);
    expect(calculateRecoveryRunBudget(input([record(), old]))).toMatchObject({ allowed: true, maxRequests: 93 });
  });
  it("can exclude a prior rerun only when every unique attempt has a skipped empty ingestion job", () => {
    const old = prior({ runAttempt: 2, conclusion: "failure" }); old.ingestionSkippedProof = skippedProof(old);
    expect(calculateRecoveryRunBudget(input([record(), old]))).toMatchObject({ allowed: true, maxRequests: 93 });
    old.ingestionSkippedProof.attempts.pop(); denied(input([record(), old]), "exclusion proof");
  });
  it.each([
    { source: "bare-skipped" }, { runId: 7 }, { repository: "other/repo" }, { workflowPath: ".github/workflows/other.yml" },
    { allAttemptsChecked: false }, { attempts: [] },
  ])("denies incomplete/mismatched skip-proof metadata %#", changes => {
    const old = prior(); old.ingestionSkippedProof = Object.assign(skippedProof(old), changes) as RecoveryIngestionSkipProof;
    denied(input([record(), old]), "exclusion proof");
  });
  it.each([
    { runAttempt: 2 }, { allJobsFetched: false }, { jobId: 0 }, { jobName: "Other job" }, { status: "in_progress" },
    { conclusion: "success" }, { steps: [{ name: "Read key" }] }, { steps: undefined },
  ])("denies unsafe/incomplete skipped-job evidence %#", changes => {
    const old = prior(); const proof = skippedProof(old); Object.assign(proof.attempts[0], changes); old.ingestionSkippedProof = proof;
    denied(input([record(), old]), "exclusion proof");
  });
  it("denies duplicate attempt/job evidence and a proof attached to an uncompleted run", () => {
    const old = prior({ runAttempt: 2 }); const proof = skippedProof(old); proof.attempts[1] = { ...proof.attempts[0] }; old.ingestionSkippedProof = proof;
    denied(input([record(), old]), "exclusion proof");
    const running = prior({ status: "in_progress", conclusion: null }); running.ingestionSkippedProof = skippedProof(running);
    denied(input([record(), running]), "exclusion proof");
  });
  it("a proven skipped earlier batch does not block a same-day retry; no proof still consumes100", () => {
    const day1 = prior({ createdAt: "2026-10-02T10:13:00Z", startedAt: "2026-10-02T10:13:30Z", updatedAt: "2026-10-02T10:20:00Z" });
    const day2 = prior({ id: 3, conclusion: "skipped", createdAt: "2026-10-04T10:00:00Z", startedAt: "2026-10-04T10:00:00Z", updatedAt: "2026-10-04T10:00:10Z" });
    const day3 = record({ createdAt: "2026-10-04T10:14:00Z", startedAt: "2026-10-04T10:14:00Z", updatedAt: "2026-10-04T10:14:00Z" });
    denied(input([day1, day2, day3], "2026-10-04T10:14:00Z"), "fully reserved");
    day2.ingestionSkippedProof = skippedProof(day2);
    expect(calculateRecoveryRunBudget(input([day1, day2, day3], "2026-10-04T10:14:00Z"))).toMatchObject({ allowed: true, maxRequests: 100 });
  });
});
