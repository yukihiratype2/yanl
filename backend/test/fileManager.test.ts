import { describe, expect, it, mock } from "bun:test";

mock.restore();
import { mkdtempSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { tmpdir } from "os";
import { join } from "path";
import { modulePath } from "./mockPath";

const baseDir = mkdtempSync(join(tmpdir(), "nas-tools-test-"));

const settingsMock = () => ({
  getSetting: (key: string) => {
    if (key === "media_dir_anime") return join(baseDir, "anime");
    if (key === "media_dir_tv") return join(baseDir, "tv");
    if (key === "media_dir_movie") return join(baseDir, "movie");
    return "";
  },
  getAllSettings: () => ({}),
  setSettings: () => {},
  setSetting: () => {},
});
mock.module(modulePath("../src/db/settings"), settingsMock);
mock.module("../db/settings", settingsMock);

const fm = await import("../src/services/fileManager?test=fileManager");

describe("services/fileManager", () => {
  it("creates folders and moves files", () => {
    const sourceDir = join(baseDir, "downloads");
    const sourceFile = join(sourceDir, "video.mkv");
    mkdirSync(sourceDir, { recursive: true });
    writeFileSync(sourceFile, "data", "utf-8");

    const destDir = fm.createMediaFolder("tv", "My Show", 1);
    const destFile = fm.moveFileToMediaDir(sourceFile, destDir, "S01E01.mkv");

    expect(existsSync(destFile)).toBe(true);
  });

  it("finds video files", () => {
    const folder = join(baseDir, "scan");
    const file = join(folder, "clip.mp4");
    mkdirSync(folder, { recursive: true });
    writeFileSync(file, "data", "utf-8");

    const found = fm.findVideoFiles(folder);
    expect(found.length).toBe(1);
    expect(found[0]).toBe(file);
  });

  it("prevents deleting outside media dir", () => {
    expect(() => fm.deleteMediaFolder("movie", "/tmp")).toThrow();
  });
});
