import { afterAll, describe, expect, it, mock } from "bun:test";
import { modulePath } from "./mockPath";

let lastDestinationArg: any = null;
let destinationCount = 0;
let lastPinoOptions: any = null;

const pinoMock: any = (opts: any, destination: any) => ({
  opts,
  destination,
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
  trace: () => {},
});

const pinoFactory: any = (opts: any, destination: any) => {
  lastPinoOptions = opts;
  return pinoMock(opts, destination);
};

pinoFactory.destination = (arg: any) => {
  destinationCount += 1;
  lastDestinationArg = arg;
  return {
    ...arg,
    flush: () => {},
    end: () => {},
    destroy: () => {},
  };
};

pinoFactory.stdTimeFunctions = { isoTime: () => "" };

mock.module("pino", () => ({
  __esModule: true,
  default: pinoFactory,
}));

mock.module(modulePath("../src/config"), () => ({
  loadConfig: () => ({ log: { dir: "/tmp/log", level: "debug" } }),
}));

afterAll(() => {
  mock.restore();
});

const loggerModule = await import("../src/services/logger?test=logger");

describe("services/logger", () => {
  it("builds a logger and can reconfigure", () => {
    expect(loggerModule.logger).toBeTruthy();
    const before = destinationCount;
    loggerModule.reconfigureLogger();
    expect(destinationCount).toBeGreaterThan(before);
    expect(lastDestinationArg.dest).toContain("backend.log");
  });

  it("creates request IDs and masks tokens", () => {
    const incoming = "req-incoming-12345678";
    expect(loggerModule.createRequestId(incoming)).toBe(incoming);
    expect(loggerModule.createRequestId("bad")).toStartWith("req-");
    expect(loggerModule.maskToken("abcdef123456")).toBe("********3456");
    expect(loggerModule.maskToken("")).toBe("(empty)");
  });

  it("wires mixin context and redact paths", () => {
    expect(Array.isArray(lastPinoOptions.redact.paths)).toBe(true);
    expect(lastPinoOptions.redact.paths).toContain("token");
    expect(lastPinoOptions.redact.paths).toContain("password");

    const withContext = loggerModule.withLogContext({ requestId: "req-test-12345678" }, () =>
      lastPinoOptions.mixin()
    );
    expect(withContext.service).toBe("nas-tools-backend");
    expect(withContext.requestId).toBe("req-test-12345678");

    const withoutContext = lastPinoOptions.mixin();
    expect(withoutContext.service).toBe("nas-tools-backend");
    expect(withoutContext.requestId).toBeUndefined();
  });
});
