import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

const MAX_PASSWORD_BYTES = 4096;

/** Preserve the existing shared-password contract without exposing its length. */
export function adminPasswordMatches(value: unknown): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || typeof value !== "string" || !value || Buffer.byteLength(value, "utf8") > MAX_PASSWORD_BYTES) return false;
  const digest = (text: string) => createHash("sha256").update(text, "utf8").digest();
  return timingSafeEqual(digest(value), digest(expected));
}

export function isAdminRequest(request: Request): boolean {
  return adminPasswordMatches(request.headers.get("x-admin-password"));
}

export function privateAdminJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0", "X-Robots-Tag": "noindex" },
  });
}

type JsonResult =
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; status: number; error: string };

/** Bound actual streamed bytes and elapsed time, including unfinished bodies. */
export async function readAdminJson(request: Request, limit = 8192): Promise<JsonResult> {
  const invalid = { ok: false, status: 400, error: "Invalid request body" } as const;
  const oversized = { ok: false, status: 413, error: "Request body too large" } as const;
  const expired = { ok: false, status: 408, error: "Request body interrupted or timed out" } as const;
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    return { ok: false, status: 415, error: "JSON content type required" };
  }
  const declared = request.headers.get("content-length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > limit)) return oversized;
  if (request.headers.get("content-encoding")) return { ok: false, status: 415, error: "Encoded request body not supported" };
  if (!request.body) return invalid;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout>;
  let onAbort: () => void = () => {};
  const deadline = new Promise<never>((_, reject) => {
    const stop = () => {
      stopped = true;
      // Reject before cancellation can complete a pending read with done:true.
      reject(new Error("Request interrupted"));
      void reader.cancel().catch(() => undefined);
    };
    onAbort = stop;
    timer = setTimeout(stop, 2000);
    if (request.signal.aborted) stop();
    else request.signal.addEventListener("abort", onAbort, { once: true });
  });
  try {
    while (true) {
      const chunk = await Promise.race([reader.read(), deadline]);
      if (stopped || request.signal.aborted) return expired;
      if (chunk.done) break;
      length += chunk.value.byteLength;
      if (length > limit) {
        void reader.cancel().catch(() => undefined);
        return oversized;
      }
      chunks.push(chunk.value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const value: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (!value || typeof value !== "object" || Array.isArray(value)) return invalid;
    return { ok: true, value: value as Record<string, unknown> };
  } catch {
    return stopped || request.signal.aborted ? expired : invalid;
  } finally {
    clearTimeout(timer!);
    request.signal.removeEventListener("abort", onAbort);
    reader.releaseLock();
  }
}
