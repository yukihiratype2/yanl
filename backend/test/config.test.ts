import { describe, expect, it, mock } from "bun:test";

let fileContent = "";
let hasFile = false;

mock.module("fs", () => ({
  existsSync: () => hasFile,
  readFileSync: () => fileContent,
  writeFileSync: (_path: string, content: string) => {
    fileContent = content;
    hasFile = true;
  },
  mkdirSync: () => {},
}));

describe("config", () => {
  it("creates default config when missing", async () => {
    hasFile = false;
    fileContent = "";
    const cfg = (await import("../src/config?test=missing")).loadConfig();
    expect(cfg.core.api_token.length).toBe(32);
    expect(hasFile).toBe(true);
  });

  it("updates eject title rules with valid JSON", async () => {
    const configModule = await import("../src/config?test=update");
    const cfg = configModule.loadConfig();
    const before = cfg.rss.eject_title_rules.length;
    configModule.updateConfigValues({
      eject_title_rules: JSON.stringify(["TEST", "  ", 123]),
    });
    const updated = configModule.loadConfig();
    expect(updated.rss.eject_title_rules).toEqual(["TEST"]);
    expect(updated.rss.eject_title_rules.length).not.toBe(before);
  });
});
