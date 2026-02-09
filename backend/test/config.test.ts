import { describe, expect, it } from "bun:test";
import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtempSync } from "node:fs";

describe("config", () => {
  it("creates default config when missing", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "nas-tools-config-"));
    const configPath = join(tempDir, "config.yaml");
    process.env.NAS_TOOLS_CONFIG_PATH = configPath;
    const cfg = (await import("../src/config?test=missing")).loadConfig();
    expect(cfg.core.api_token.length).toBe(32);
    expect(existsSync(configPath)).toBe(true);
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("updates eject title rules with valid JSON", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "nas-tools-config-"));
    const configPath = join(tempDir, "config.yaml");
    process.env.NAS_TOOLS_CONFIG_PATH = configPath;
    const configModule = await import("../src/config?test=update");
    const cfg = configModule.loadConfig();
    const before = cfg.rss.eject_title_rules.length;
    configModule.updateConfigValues({
      eject_title_rules: JSON.stringify(["TEST", "  ", 123]),
    });
    const updated = configModule.loadConfig();
    expect(updated.rss.eject_title_rules).toEqual(["TEST"]);
    expect(updated.rss.eject_title_rules.length).not.toBe(before);
    rmSync(tempDir, { recursive: true, force: true });
  });
});
