/** Small, local request helpers. Credentials are never written to browser storage. */
export class AdminRequestError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "AdminRequestError";
  }
}

export async function readAdminResponse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new AdminRequestError(
      body && typeof body.error === "string" ? body.error : `Request failed (${response.status})`,
      response.status,
    );
  }
  if (!body || typeof body !== "object") throw new AdminRequestError("Invalid server response", response.status);
  return body as T;
}

/** Aborting alone isn't enough: an already-resolved response may still complete. */
export function createLatestRequest() {
  let active: AbortController | null = null;
  return {
    begin() {
      active?.abort();
      active = new AbortController();
      return active;
    },
    current(request: AbortController) {
      return active === request && !request.signal.aborted;
    },
    cancel() {
      active?.abort();
      active = null;
    },
  };
}

export const ADMIN_REQUEST_TIMEOUT_MS = 8_000;

/** Bound the complete transport, including the response body, not only headers. */
export async function fetchAdmin(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  let rejectInterrupted!: (reason: unknown) => void;
  const interruption = new Promise<never>((_, reject) => { rejectInterrupted = reject; });
  const cancel = () => {
    const reason = init.signal?.reason ?? new DOMException("Request cancelled", "AbortError");
    controller.abort(reason);
    rejectInterrupted(reason);
  };
  init.signal?.addEventListener("abort", cancel, { once: true });
  const timer = setTimeout(() => {
    const error = new AdminRequestError("Request timed out. Please try again.", 408);
    controller.abort(error); rejectInterrupted(error);
  }, ADMIN_REQUEST_TIMEOUT_MS);
  if (init.signal?.aborted) cancel();
  try {
    return await Promise.race([
      (async () => {
        const response = await fetch(input, { ...init, signal: controller.signal });
        const body = await response.arrayBuffer();
        return new Response([204, 205, 304].includes(response.status) ? null : body, {
          status: response.status, statusText: response.statusText, headers: response.headers,
        });
      })(),
      interruption,
    ]);
  } finally {
    clearTimeout(timer);
    init.signal?.removeEventListener("abort", cancel);
  }
}

export function adminErrorText(error: unknown, zh: boolean, fallback: string): string {
  if (error instanceof AdminRequestError && error.status === 408) return zh ? "请求超时，请重试。" : error.message;
  if (error instanceof Error && !(error instanceof TypeError)) return error.message;
  return fallback;
}
