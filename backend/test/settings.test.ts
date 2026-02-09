import { describe, expect, it, mock } from "bun:test";

mock.restore();
import { modulePath } from "./mockPath";

const store = {
  core: { api_token: "token" },
  rss: { eject_title_rules: ["rule"] },
  log: { dir: "/tmp/log", level: "info" },
  qbittorrent: {
    url: "http://localhost:8080",
    username: "admin",
    password: "pass",
    tag: "nas",
    download_dirs: { anime: "/a", tv: "/t", movie: "/m" },
    path_map: [{ from: "/remote", to: "/local" }],
  },
  tmdb: { token: "tmdb" },
  media_dirs: { anime: "/ma", tv: "/mt", movie: "/mm" },
  ai: { api_url: "http://ai", api_token: "ai", model: "m" },
  notifactions: [
    {
      id: "n1",
      name: "Webhook",
      enabled: true,
      provider: "webhook",
      events: ["media_released"],
      config: { url: "https://example.com", headers: {} },
    },
  ],
};

mock.module(modulePath("../src/config"), () => ({
  loadConfig: () => store,
  updateConfigValues: (updates: Record<string, string>) => {
    Object.assign(store.core, {
      api_token: updates.api_token ?? store.core.api_token,
    });
    if (updates.notifactions) {
      store.notifactions = JSON.parse(updates.notifactions);
    }
  },
  getConfigValue: (key: string) => {
    if (key === "api_token") return store.core.api_token;
    if (key === "notifactions") return JSON.stringify(store.notifactions);
    return "";
  },
}));

const settings = await import("../src/db/settings?test=settings");

describe("db/settings", () => {
  it("lists settings", () => {
    const all = settings.getAllSettings();
    expect(all.qbit_url).toBe("http://localhost:8080");
    expect(all.media_dir_movie).toBe("/mm");
    const parsedNotifactions = JSON.parse(all.notifactions || "[]");
    expect(parsedNotifactions.length).toBe(1);
  });

  it("sets a setting", () => {
    settings.setSetting("api_token", "new");
    expect(settings.getSetting("api_token")).toBe("new");
  });
});
