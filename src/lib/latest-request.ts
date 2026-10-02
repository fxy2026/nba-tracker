/** Cancels superseded requests and guards asynchronous body parsing too. */
export function createLatestRequestGate() {
  let active: AbortController | null = null;
  return {
    begin() {
      active?.abort();
      const controller = new AbortController();
      active = controller;
      return {
        signal: controller.signal,
        isCurrent: () => active === controller && !controller.signal.aborted,
      };
    },
    cancel() {
      active?.abort();
      active = null;
    },
  };
}
