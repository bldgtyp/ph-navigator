import { createDeferred, type Deferred } from "../../../../test-utils/async";

export type CapturedTransportRequest<TRequest, TResponse> = {
  request: TRequest;
  response: Deferred<TResponse>;
};

export function createControllableTransport<TRequest, TResponse>() {
  const requests: CapturedTransportRequest<TRequest, TResponse>[] = [];
  const transport = (request: TRequest): Promise<TResponse> => {
    const response = createDeferred<TResponse>();
    requests.push({ request, response });
    return response.promise;
  };
  return { requests, transport };
}

export function dispatchBurst<TOp>(ops: readonly TOp[], dispatch: (op: TOp) => Promise<void>) {
  return ops.map((op) => dispatch(op));
}

export async function expectNoUnhandledRejections(run: () => Promise<void>): Promise<void> {
  const reasons: unknown[] = [];
  const onUnhandled = (event: PromiseRejectionEvent) => {
    reasons.push(event.reason);
    event.preventDefault();
  };
  window.addEventListener("unhandledrejection", onUnhandled);
  try {
    await run();
    await Promise.resolve();
  } finally {
    window.removeEventListener("unhandledrejection", onUnhandled);
  }
  if (reasons.length > 0) throw new Error(`Observed ${reasons.length} unhandled rejection(s).`);
}
