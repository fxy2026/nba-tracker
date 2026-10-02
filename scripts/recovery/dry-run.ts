import { readFileSync, writeFileSync, renameSync } from "node:fs";
import { dryRunRecovery, type RecoveryCapture } from "../../src/lib/recovery-dry-run";

// Compile this isolated offline CLI with the installed TypeScript compiler.
// It intentionally has no HTTP client, credential/environment lookup or job.
const args = process.argv.slice(2);
const allowed = new Set(["--manifest", "--captures", "--verified", "--output"]);
const options = new Map<string,string>();
for (let i=0;i<args.length;i+=2) {
  if (!allowed.has(args[i]) || !args[i+1] || options.has(args[i])) throw new Error("Invalid arguments");
  options.set(args[i],args[i+1]);
}
for (const key of allowed) if (!options.has(key)) throw new Error(`Missing ${key}`);
const read = (key:string):unknown => JSON.parse(readFileSync(options.get(key)!,"utf8"));
const rawCaptures=read("--captures"), verified=read("--verified");
if (!Array.isArray(rawCaptures) || !Array.isArray(verified) || !verified.every(id=>typeof id==="string")) throw new Error("Invalid input files");
if (!rawCaptures.every(c=>c && typeof c==="object" && typeof c.nbaGameId==="string" && typeof c.requestedMatchId==="string" && typeof c.retrievedAt==="string" && Number.isInteger(c.httpStatus) && "body" in c)) throw new Error("Invalid capture envelope");
const result = dryRunRecovery(read("--manifest"),rawCaptures as RecoveryCapture[],new Set(verified));
const output=options.get("--output")!;
const temporary=`${output}.tmp-${process.pid}`;
writeFileSync(temporary,JSON.stringify(result,null,2)+"\n",{flag:"wx"});
renameSync(temporary,output);
// Summaries only: never dump raw responses, player data or request headers.
process.stdout.write(JSON.stringify({mode:result.mode,networkRequests:0,accepted:result.accepted.length,rejected:result.rejected.length,preservedVerified:result.preservedVerified.length})+"\n");
