export function makeJsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
}

export function makeTextResponse(text: string, init?: ResponseInit): Response {
  return new Response(text, {
    status: init?.status ?? 200,
    headers: {
      "Content-Type": "text/plain",
      ...(init?.headers || {}),
    },
  });
}

export type FetchCall = {
  input: RequestInfo;
  init?: RequestInit;
};

export function mockFetch(
  handler: (input: RequestInfo, init?: RequestInit) => Promise<Response> | Response
) {
  const calls: FetchCall[] = [];
  const fetchImpl = async (input: RequestInfo, init?: RequestInit) => {
    calls.push({ input, init });
    return handler(input, init);
  };
  globalThis.fetch = fetchImpl as typeof fetch;
  return { calls };
}

export function makeLogger() {
  const calls: Array<{ level: string; args: any[] }> = [];
  const mk = (level: string) => (...args: any[]) => {
    calls.push({ level, args });
  };
  return {
    logger: {
      info: mk("info"),
      warn: mk("warn"),
      error: mk("error"),
      debug: mk("debug"),
      trace: mk("trace"),
    },
    calls,
  };
}
