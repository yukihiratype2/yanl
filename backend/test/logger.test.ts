import { afterAll, describe, expect, it, mock } from "bun:test";
import { modulePath } from "./mockPath";

let lastDestinationArg: any = null;
let destinationCount = 0;

const pinoMock: any = (opts: any, destination: any) => ({
  opts,
  destination,
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
  trace: () => {},
});

pinoMock.destination = (arg: any) => {
  destinationCount += 1;
  lastDestinationArg = arg;
  return {
    ...arg,
    flush: () => {},
    end: () => {},
    destroy: () => {},
  };
};

pinoMock.stdTimeFunctions = { isoTime: () => "" };

mock.module("pino", () => ({
  __esModule: true,
  default: pinoMock,
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
});
