import { parseTorrentTitles } from "../services/ai";
import { logger } from "../services/logger";

const defaultTitles = [
  "[北宇治字幕组] 葬送的芙莉莲 / Sousou no Frieren [31][WebRip][1080p][HEVC_AAC][简繁日内封]",
  "[Skymoon-Raws] 葬送的芙莉莲 第二季 / Sousou no Frieren 2nd Season - 04 [ViuTV][WEB-DL][CHT][1080p][AVC AAC]",
  "[LoliHouse] Fate/strange Fake - 05 [WebRip 1080p HEVC-10bit AAC][简繁内封字幕] [655.1MB]",
  "[黒ネズミたち] 蓝色管弦乐 第二季 / Ao no Orchestra 2nd Season - 15 (Baha 1920x1080 AVC AAC MP4) [343.9 MB] [复制磁连]",
  "[SweetSub&LoliHouse] 蓦然回首 / Look Back (Movie)[WebRip 1080p HEVC-10bit AAC EAC3][简繁日内封字幕] [1.24 GB] [复制磁连]",
  "[LoliHouse] 吉伊卡哇 一期 / Chiikawa [001-257 合集][WebRip 1080p HEVC-10bit AAC][繁中外挂字幕] [11.6GB] [复制磁连]",
  "【喵萌奶茶屋】★10月新番★[乱马 1/2 2024年版 / Ranma ½ / Ranma 1/2 (2024)][24][1080p][简日双语][招募翻译] [526.5MB] [复制磁连]",
  "[PoM&WM]BanG Dream!It's MyGO!!!!![11][Webrip][1080p][CHS_JAP][x265 HEVC-10bit AAC] [533.4MB]",
  "【喵萌Production】★07月新番★[BanG Dream! It’s MyGO!!!!!][01-13][720p][繁日双语][招募翻译] [2.0GB]",
  "[Billion Meta Lab] 反转·血色百合 Omagoto [05][1080P][HEVC-10bit][CHS&CHT&JP][检索：因为被以“就凭你也想打倒魔王吗”这样的理由逐出了勇者的队伍，所以想在王都自由自在地生活]",
  "[ANi] Chained Soldier S02 / 魔都精兵的奴隸 第二季 - 05 [1080P][Baha][WEB-DL][AAC AVC][CHT][MP4]"
];

export async function runAITest(args: string[] = process.argv.slice(2)) {
  const titles = args.length > 0 ? args : defaultTitles;

  logger.info({ count: titles.length }, "AI test start");
  const result = await parseTorrentTitles(titles);
  if (!result) {
    logger.error("AI test failed or AI config missing");
    process.exitCode = 1;
    return;
  }

  logger.info({ result }, "AI test result");
  console.log(JSON.stringify(result, null, 2));
}

if (import.meta.main) {
  runAITest().catch((err) => {
    logger.error({ err }, "AI test crashed");
    process.exitCode = 1;
  });
}
