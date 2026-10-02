import { RECOVERY_DAILY_LIMIT } from "./recovery-run-budget";
/** Bounded single-job transport. Global admission belongs to the verified run
 * ledger; this counter alone is NOT a cross-instance/provider-account quota. */
export interface ProviderFetchResult {
  ok: boolean;
  requestedMatchId: string;
  httpStatus?: number;
  body?: unknown;
  reason?: string;
  retrievedAt?: string;
}
export function createRecoveryProviderClient(options: {
  apiKey: string;
  maxRequests: number;
  expiresAt: string;
  now?: () => number;
  fetcher?: typeof fetch;
}) {
  const now = options.now ?? Date.now, fetcher = options.fetcher ?? fetch;
  const started = now(), dayEnd = Date.parse(options.expiresAt);
  const max = options.maxRequests;
  let requests = 0, stopped = false;
  const enabled = !!options.apiKey.trim();
  if (!Number.isSafeInteger(max) || max < 0 || max > RECOVERY_DAILY_LIMIT || !Number.isFinite(dayEnd) || dayEnd <= started || dayEnd > Date.UTC(new Date(started).getUTCFullYear(),new Date(started).getUTCMonth(),new Date(started).getUTCDate()+1)) throw new Error("Invalid bounded provider allowance");
  const deadline = Math.min(dayEnd,started+120_000);
  return {
    get requestsMade() {return requests;},
    get enabled() {return enabled;},
    async getStats(matchId: string): Promise<ProviderFetchResult> {
      return request(`/v1/stored/matches/${matchId}/stats`,matchId,/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(matchId));
    },
    async getMatches(date: string): Promise<ProviderFetchResult> {
      const valid=/^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(Date.parse(date))&&new Date(date).toISOString().slice(0,10)===date;
      return request(`/v1/stored/matches?sport=basketball&date=${date}&limit=100`,date,valid);
    },
  };
  async function request(path: string, matchId: string, validId: boolean): Promise<ProviderFetchResult> {
      const failure=(reason:string,httpStatus?:number):ProviderFetchResult=>({ok:false,requestedMatchId:matchId,reason,...(httpStatus===undefined?{}:{httpStatus})});
      if (!enabled) return failure("not-configured");
      if (!validId) return failure("invalid-match-id");
      if(stopped||requests>=max||now()>=deadline)return failure("budget-or-deadline-exhausted");
      // Reserve before any network step, including failed/uncertain requests.
      requests++;
      const controller=new AbortController();
      const timer=setTimeout(()=>controller.abort(),Math.min(8_000,deadline-now()));
      let abortListener=()=>{};
      const aborted=new Promise<never>((_resolve,reject)=>{abortListener=()=>reject(new Error('deadline'));controller.signal.addEventListener('abort',abortListener,{once:true});});
      try {
        const work=(async()=>{
          const response=await fetcher(`https://api.bigballsdata.com${path}`,{
            headers:{'x-api-key':options.apiKey,Accept:'application/json'},redirect:'error',signal:controller.signal,
          });
          if(response.status!==200){stopped=true;return failure('provider-unavailable',response.status);}
          const length=response.headers.get('content-length');
          if(length&&Number(length)>2_000_000){stopped=true;return failure('response-too-large');}
          const text=await response.text();
          if(controller.signal.aborted||now()>=deadline){stopped=true;return failure('deadline-exhausted');}
          if(text.length>2_000_000){stopped=true;return failure('response-too-large');}
          const body:unknown=JSON.parse(text);
          const remaining=response.headers.get('x-ratelimit-remaining');
          if(remaining!==null&&/^\d+$/.test(remaining)&&Number(remaining)===0)stopped=true;
          return {ok:true,requestedMatchId:matchId,httpStatus:200,body,retrievedAt:new Date(now()).toISOString()} satisfies ProviderFetchResult;
        })();
        return await Promise.race([work,aborted]);
      } catch {
        stopped=true;
        // Never expose exception text, headers, keys or upstream error bodies.
        return failure('provider-request-failed');
      } finally {
        clearTimeout(timer);controller.signal.removeEventListener('abort',abortListener);
      }
  }
}
