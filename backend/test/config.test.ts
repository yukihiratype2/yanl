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

  it("updates notifactions with normalized provider config", async () => {
    const configModule = await import("../src/config?test=notifactions");
    configModule.loadConfig();
    configModule.updateConfigValues({
      notifactions: JSON.stringify([
        {
          id: "n1",
          name: "Webhook",
          enabled: true,
          provider: "webhook",
          events: ["media_released", "invalid"],
          config: {
            url: "https://example.com/hook",
            headers: {
              Authorization: "Bearer token",
            },
          },
        },
        {
          id: "n2",
          name: "Telegram",
          enabled: true,
          provider: "telegram",
          events: ["download_completed"],
          config: {
            bot_token: "123:abc",
            chat_id: "-10001",
          },
        },
      ]),
    });
    const updated = configModule.loadConfig();
    expect(updated.notifactions.length).toBe(2);
    expect(updated.notifactions[0]?.provider).toBe("webhook");
    expect(updated.notifactions[0]?.events).toEqual(["media_released"]);
    expect(updated.notifactions[1]?.provider).toBe("telegram");
  });
});
