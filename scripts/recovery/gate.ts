import { appendFileSync } from "node:fs";
import { readRecoveryRunLedger, RECOVERY_REPOSITORY } from "../../src/lib/recovery-github-ledger";
import { readConnectionLedger } from "../../src/lib/recovery-connection-ledger";
import { calculateRecoveryRunBudget } from "../../src/lib/recovery-run-budget";

async function main() {
  const output = process.env.GITHUB_OUTPUT;
  if (!output) throw new Error("GitHub output destination is required");
  const skip = () => { appendFileSync(output,"allowed=false\n"); console.log("Recovery skipped: quota evidence unavailable or allowance reserved."); };
  const repository = process.env.GITHUB_REPOSITORY;
  const token = process.env.GITHUB_TOKEN;
  const id=Number(process.env.GITHUB_RUN_ID),runAttempt=Number(process.env.GITHUB_RUN_ATTEMPT);
  if(repository!==RECOVERY_REPOSITORY||!token||!Number.isSafeInteger(id)||id<1||!Number.isSafeInteger(runAttempt)||runAttempt!==1){skip();return;}
  const get = async(path:string):Promise<unknown>=>{
    if(!path.startsWith(`/repos/${RECOVERY_REPOSITORY}/actions/`))throw new Error("Invalid ledger route");
    const response=await fetch(`https://api.github.com${path}`,{headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2026-03-10'},redirect:'error',signal:AbortSignal.timeout(8000)});
    if(!response.ok)throw new Error('GitHub ledger unavailable');
    return response.json();
  };
  const evidence=await readRecoveryRunLedger(get,{id,runAttempt},new Date().toISOString());
  if(!evidence.ok){skip();return;}
  const mode=process.env.RECOVERY_MODE;
  if(!['verify','backfill'].includes(mode??'')){skip();return;}
  const connection=await readConnectionLedger(get,new Date().toISOString());
  if(!connection.ok){skip();return;}
  if(mode==='backfill'&&!evidence.providerVerified&&!connection.verified){console.log('Backfill waits for a successful verify-only operator run.');skip();return;}
  const finishedAt=new Date().toISOString();
  if(finishedAt.slice(0,10)!==evidence.input.now.slice(0,10)){skip();return;}
  // Metadata can update while pages are being read; assess timestamps against
  // the completed read, without allowing a UTC-day rollover mid-admission.
  const allowance=calculateRecoveryRunBudget({...evidence.input,now:finishedAt});
  if(!allowance.allowed){skip();return;}
  const maxRequests=allowance.maxRequests-connection.reservedRequests;
  if(maxRequests<1){skip();return;}
  // This file contains only public bounds, never tokens or provider responses.
  appendFileSync(output,`allowed=true\nmax_requests=${maxRequests}\nexpires_at=${allowance.expiresAt}\n`);
  console.log(`UTC-day job allowance: ${maxRequests}; expires ${allowance.expiresAt}.`);
}
void main().catch(()=>{console.error("Quota gate failed safely; provider requests were not started.");process.exitCode=1;});
