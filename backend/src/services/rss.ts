import { XMLParser } from "fast-xml-parser";
import { parseTorrentTitles, type AITitleParse } from "./ai";
import { getSetting } from "../db/settings";
import {
  reportIntegrationFailure,
  reportIntegrationSuccess,
} from "./integration-health";
import { logger } from "./logger";

export interface RSSItem {
  title: string;
  link: string;
  pubDate?: string;
  description?: string;
  guid?: string;
  guidIsPermaLink?: boolean;
  author?: string;
  category?: string;
  categoryDomain?: string;
  enclosure?: {
    url?: string;
    type?: string;
    length?: string;
  };
  torrent?: {
    link?: string;
    contentLength?: string;
    pubDate?: string;
  };
  ai?: AITitleParse;
  source: string;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
});

export async function fetchMikanRSS(keyword: string): Promise<RSSItem[]> {
  const url = `https://mikanani.me/RSS/Search?searchstr=${encodeURIComponent(keyword)}`;
  try {
    logger.debug({ keyword, url }, "Mikan RSS search query");
    const response = await fetch(url);
    if (!response.ok) {
      logger.warn({ status: response.status }, "Mikan RSS fetch failed");
      reportIntegrationFailure("mikan", `HTTP ${response.status}`, "Mikan RSS call failed");
      return [];
    }
    const xml = await response.text();
    reportIntegrationSuccess("mikan", "Last Mikan RSS call succeeded");
    return parseRSS(xml, "mikan");
  } catch (error) {
    reportIntegrationFailure("mikan", error, "Mikan RSS call failed");
    logger.error({ err: error }, "Mikan RSS fetch error");
    return [];
  }
}

export async function fetchDmhyRSS(keyword: string): Promise<RSSItem[]> {
  const url = `https://share.dmhy.org/topics/rss/rss.xml?keyword=${encodeURIComponent(keyword)}`;
  try {
    logger.debug({ keyword, url }, "DMHY RSS search query");
    const response = await fetch(url);
    if (!response.ok) {
      logger.warn({ status: response.status }, "DMHY RSS fetch failed");
      reportIntegrationFailure("dmhy", `HTTP ${response.status}`, "DMHY RSS call failed");
      return [];
    }
    const xml = await response.text();
    reportIntegrationSuccess("dmhy", "Last DMHY RSS call succeeded");
    return parseRSS(xml, "dmhy");
  } catch (error) {
    reportIntegrationFailure("dmhy", error, "DMHY RSS call failed");
    logger.error({ err: error }, "DMHY RSS fetch error");
    return [];
  }
}

export async function testMikanRSSConnection(): Promise<{
  ok: boolean;
  error?: string;
}> {
  const url = "https://mikanani.me/RSS/Bangumi";
  try {
    const response = await fetch(url);
    if (!response.ok) {
      reportIntegrationFailure("mikan", `HTTP ${response.status}`, "Mikan RSS call failed");
      return { ok: false, error: `HTTP ${response.status}` };
    }
    const xml = await response.text();
    const items = parseRSS(xml, "mikan");
    if (items.length === 0) {
      reportIntegrationFailure("mikan", "No feed items returned", "Mikan RSS call failed");
      return { ok: false, error: "No feed items returned" };
    }
    reportIntegrationSuccess("mikan", "Last Mikan RSS call succeeded");
    return { ok: true };
  } catch (error: any) {
    reportIntegrationFailure("mikan", error, "Mikan RSS call failed");
    return { ok: false, error: error?.message || "Mikan RSS connection failed" };
  }
}

export async function testDmhyRSSConnection(): Promise<{
  ok: boolean;
  error?: string;
}> {
  const url = "https://share.dmhy.org/topics/rss/rss.xml";
  try {
    const response = await fetch(url);
    if (!response.ok) {
      reportIntegrationFailure("dmhy", `HTTP ${response.status}`, "DMHY RSS call failed");
      return { ok: false, error: `HTTP ${response.status}` };
    }
    const xml = await response.text();
    const items = parseRSS(xml, "dmhy");
    if (items.length === 0) {
      reportIntegrationFailure("dmhy", "No feed items returned", "DMHY RSS call failed");
      return { ok: false, error: "No feed items returned" };
    }
    reportIntegrationSuccess("dmhy", "Last DMHY RSS call succeeded");
    return { ok: true };
  } catch (error: any) {
    reportIntegrationFailure("dmhy", error, "DMHY RSS call failed");
    return { ok: false, error: error?.message || "DMHY RSS connection failed" };
  }
}

function parseRSS(xml: string, source: string): RSSItem[] {
  // TODO: Implement more sophisticated RSS parsing with episode matching
  try {
    const parsed = parser.parse(xml);
    const channel = parsed?.rss?.channel;
    if (!channel) return [];

    let items = channel.item;
    if (!items) return [];
    if (!Array.isArray(items)) items = [items];

    return items.map((item: any) => {
      const enclosure = item.enclosure
        ? {
            url: item.enclosure["@_url"] || item.enclosure.url,
            type: item.enclosure["@_type"] || item.enclosure.type,
            length: item.enclosure["@_length"] || item.enclosure.length,
          }
        : undefined;

      const torrent = item.torrent
        ? {
            link: item.torrent.link,
            contentLength: item.torrent.contentLength,
            pubDate: item.torrent.pubDate,
          }
        : undefined;

      const guidIsPermaLink =
        item.guid && typeof item.guid === "object"
          ? item.guid["@_isPermaLink"] === "true"
          : undefined;

      const guidValue =
        item.guid && typeof item.guid === "object" ? item.guid["#text"] : item.guid;

      const pubDate = item.pubDate || torrent?.pubDate || "";
      const link = enclosure?.url || item.link || "";

      return {
        title: item.title || "",
        link,
        pubDate,
        description: item.description || "",
        guid: guidValue || undefined,
        guidIsPermaLink,
        author: item.author || undefined,
        category:
          item.category && typeof item.category === "object"
            ? item.category["#text"]
            : item.category,
        categoryDomain:
          item.category && typeof item.category === "object"
            ? item.category["@_domain"]
            : undefined,
        enclosure,
        torrent,
        source,
      } as RSSItem;
    });
  } catch (error) {
    logger.error({ err: error, source }, "RSS parse error");
    return [];
  }
}

export async function searchTorrents(
  keyword: string,
  options?: {
    season?: number | string | null;
    episode?: number | string | null;
  }
): Promise<RSSItem[]> {
  const seasonValue = options?.season;
  const seasonNumber =
    seasonValue === null || seasonValue === undefined || seasonValue === ""
      ? null
      : Number(seasonValue);
  const seasonPart =
    seasonNumber && !Number.isNaN(seasonNumber) && seasonNumber > 1
      ? `S${seasonNumber}`
      : "";
  const episodeValue = options?.episode;
  const episodeNumber =
    episodeValue === null || episodeValue === undefined || episodeValue === ""
      ? null
      : Number(episodeValue);
  const episodePart =
    episodeNumber !== null && !Number.isNaN(episodeNumber)
      ? String(episodeNumber).padStart(2, "0")
      : episodeValue
        ? String(episodeValue)
        : "";
  const query = [keyword, seasonPart, episodePart].filter(Boolean).join(" ");
  const [mikanResults, dmhyResults] = await Promise.all([
    fetchMikanRSS(query),
    fetchDmhyRSS(query),
  ]);
  const results = [...mikanResults, ...dmhyResults];
  const filteredResults = applyEjectTitleRules(results);
  const titles = filteredResults.map((item) => item.title);
  const aiParsed = await parseTorrentTitles(titles);
  if (aiParsed && aiParsed.length > 0) {
    return filteredResults.map((item, index) => ({
      ...item,
      ai: aiParsed[index] || undefined,
    }));
  }
  return filteredResults;
}

function loadEjectTitleRules(): string[] {
  const raw = getSetting("eject_title_rules");
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((rule) => typeof rule === "string");
  } catch {
    return [];
  }
}

function applyEjectTitleRules(items: RSSItem[]): RSSItem[] {
  const rules = loadEjectTitleRules();
  if (rules.length === 0) return items;

  const matchers = rules
    .map((rule) => {
      try {
        return { rule, regex: new RegExp(rule) };
      } catch (error) {
        logger.warn({ rule, err: error }, "Invalid eject title rule");
        return null;
      }
    })
    .filter((entry): entry is { rule: string; regex: RegExp } => Boolean(entry));

  if (matchers.length === 0) return items;

  return items.filter((item) => {
    for (const matcher of matchers) {
      if (matcher.regex.test(item.title)) {
        logger.info(
          { title: item.title, rule: matcher.rule, source: item.source },
          "RSS title ejected by rule"
        );
        return false;
      }
    }
    return true;
  });
}
