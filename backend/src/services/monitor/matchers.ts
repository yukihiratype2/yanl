import type { Profile, Subscription, Episode } from "../../db/models";
import type * as rss from "../rss";
import type { ParsedTitle } from "./utils";

function parseProfileList(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.map((entry) => String(entry).trim()).filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

function normalizeToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function textMatchesAny(list: string[], text: string, normalizedText: string): boolean {
  if (list.length === 0) return true;
  for (const entry of list) {
    const entryLower = entry.toLowerCase();
    if (entryLower && text.includes(entryLower)) return true;
    const entryNorm = normalizeToken(entry);
    if (entryNorm && normalizedText.includes(entryNorm)) return true;
  }
  return false;
}

function parseSizeToMb(item: rss.RSSItem): number | null {
  const sizeText = item.ai?.size;
  if (sizeText) {
    const match = sizeText
      .toLowerCase()
      .replace(/,/g, "")
      .match(/([\d.]+)\s*(tb|tib|gb|gib|mb|mib|kb|kib)/);
    if (match) {
      const value = Number(match[1]);
      if (!Number.isNaN(value)) {
        const unit = match[2];
        if (unit === "tb" || unit === "tib") return value * 1024 * 1024;
        if (unit === "gb" || unit === "gib") return value * 1024;
        if (unit === "mb" || unit === "mib") return value;
        if (unit === "kb" || unit === "kib") return value / 1024;
      }
    }
  }

  const byteText = item.torrent?.contentLength || item.enclosure?.length || "";
  const bytes = Number(byteText);
  if (!Number.isNaN(bytes) && bytes > 0) {
    return bytes / (1024 * 1024);
  }
  return null;
}

export function isTitleMatch(subTitle: string, parseResult?: ParsedTitle | null): boolean {
  if (!parseResult) return false;
  const subTitleLower = subTitle.toLowerCase();
  const english = parseResult.englishTitle?.toLowerCase() || "";
  const chinese = parseResult.chineseTitle?.toLowerCase() || "";
  return (
    english.includes(subTitleLower) ||
    chinese.includes(subTitleLower) ||
    subTitleLower.includes(english) ||
    subTitleLower.includes(chinese)
  );
}

export function matchesEpisodeSeason(
  sub: Subscription,
  ep: Episode,
  parseResult?: rss.RSSItem["ai"] | null
): { ok: boolean; reason?: string } {
  if (!parseResult || parseResult.episodeNumber == null) {
    return { ok: false, reason: "episode_unknown" };
  }

  if (parseResult.episodeNumber !== ep.episode_number) {
    return { ok: false, reason: "episode_miss" };
  }

  if (
    sub.season_number != null &&
    parseResult.seasonNumber != null &&
    parseResult.seasonNumber !== sub.season_number
  ) {
    return { ok: false, reason: "season_miss" };
  }

  return { ok: true };
}

export function matchesProfile(
  item: rss.RSSItem,
  profile: Profile | null
): { ok: boolean; reason?: string } {
  if (!profile) return { ok: true };

  const resolutions = parseProfileList(profile.resolutions);
  const qualities = parseProfileList(profile.qualities);
  const formats = parseProfileList(profile.formats);
  const encoders = parseProfileList(profile.encoders);
  const preferredKeywords = parseProfileList(profile.preferred_keywords);
  const excludedKeywords = parseProfileList(profile.excluded_keywords);

  const title = item.title || "";
  const titleLower = title.toLowerCase();
  const titleNormalized = normalizeToken(title);
  const aiResolution = (item.ai?.resolution || "").toLowerCase();
  const aiFormat = (item.ai?.format || "").toLowerCase();
  const aiText = [aiResolution, aiFormat, item.ai?.subTeam, item.ai?.subtitleLanguage]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (excludedKeywords.length > 0) {
    for (const keyword of excludedKeywords) {
      const keywordLower = keyword.toLowerCase();
      if (!keywordLower) continue;
      if (titleLower.includes(keywordLower) || aiText.includes(keywordLower)) {
        return { ok: false, reason: `excluded_keyword:${keywordLower}` };
      }
    }
  }

  if (preferredKeywords.length > 0) {
    let matchedPreferred = false;
    for (const keyword of preferredKeywords) {
      const keywordLower = keyword.toLowerCase();
      if (!keywordLower) continue;
      if (titleLower.includes(keywordLower) || aiText.includes(keywordLower)) {
        matchedPreferred = true;
        break;
      }
    }
    if (!matchedPreferred) return { ok: false, reason: "preferred_keyword_miss" };
  }

  if (resolutions.length > 0) {
    const resolutionMatch =
      textMatchesAny(resolutions, titleLower, titleNormalized) ||
      textMatchesAny(resolutions, aiResolution, normalizeToken(aiResolution));
    if (!resolutionMatch) return { ok: false, reason: "resolution_miss" };
  }

  if (qualities.length > 0) {
    const qualityMatch =
      textMatchesAny(qualities, titleLower, titleNormalized) ||
      textMatchesAny(qualities, aiFormat, normalizeToken(aiFormat));
    if (!qualityMatch) return { ok: false, reason: "quality_miss" };
  }

  if (formats.length > 0) {
    const formatMatch =
      textMatchesAny(formats, titleLower, titleNormalized) ||
      textMatchesAny(formats, aiFormat, normalizeToken(aiFormat));
    if (!formatMatch) return { ok: false, reason: "format_miss" };
  }

  if (encoders.length > 0) {
    const encoderMatch =
      textMatchesAny(encoders, titleLower, titleNormalized) ||
      textMatchesAny(encoders, aiFormat, normalizeToken(aiFormat));
    if (!encoderMatch) return { ok: false, reason: "encoder_miss" };
  }

  if (profile.min_size_mb != null || profile.max_size_mb != null) {
    const sizeMb = parseSizeToMb(item);
    if (sizeMb != null) {
      if (profile.min_size_mb != null && sizeMb < profile.min_size_mb) {
        return { ok: false, reason: "min_size_mb" };
      }
      if (profile.max_size_mb != null && sizeMb > profile.max_size_mb) {
        return { ok: false, reason: "max_size_mb" };
      }
    }
  }

  return { ok: true };
}
