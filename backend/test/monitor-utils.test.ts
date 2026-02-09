import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const utils = await import(
  `../src/services/monitor/utils?test=monitor-utils-${Date.now()}-${Math.random()}`
);

describe("monitor/utils", () => {
  it("parses magnet hashes", () => {
    expect(utils.parseMagnetHash("magnet:?xt=urn:btih:ABC")).toBe("abc");
    expect(utils.parseMagnetHash("http://example")).toBeNull();
  });

  it("builds filenames", () => {
    expect(utils.buildEpisodeFilename("Show", 1, 2, "file.mkv")).toBe(
      "Show - S01E02.mkv"
    );
    expect(utils.buildMovieFilename("Movie", "file.mp4")).toBe("Movie.mp4");
  });

  it("selects primary video file", () => {
    const dir = mkdtempSync(join(tmpdir(), "monitor-utils-"));
    const videoPath = join(dir, "video.mkv");

    try {
      writeFileSync(videoPath, "test");
      expect(utils.selectPrimaryVideoFile(dir)).toBe(videoPath);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
