import { describe, expect, it, mock } from "bun:test";
import { modulePath } from "./mockPath";

mock.module(modulePath("../src/services/fileManager"), () => ({
  findVideoFiles: () => ["/tmp/video.mkv"],
}));

const utils = await import("../src/services/monitor/utils?test=monitor-utils");

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
    expect(utils.selectPrimaryVideoFile("/tmp")).toBe("/tmp/video.mkv");
  });
});
