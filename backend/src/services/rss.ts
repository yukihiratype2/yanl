import { XMLParser } from "fast-xml-parser";
import { parseTorrentTitles, type AITitleParse } from "./ai";
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
    const response = await fetch(url);
    if (!response.ok) {
    logger.warn({ status: response.status }, "Mikan RSS fetch failed");
      return [];
    }
    const xml = await response.text();
    return parseRSS(xml, "mikan");
  } catch (error) {
    logger.error({ err: error }, "Mikan RSS fetch error");
    return [];
  }
}

export async function fetchDmhyRSS(keyword: string): Promise<RSSItem[]> {
  const url = `https://share.dmhy.org/topics/rss/rss.xml?keyword=${encodeURIComponent(keyword)}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
    logger.warn({ status: response.status }, "DMHY RSS fetch failed");
      return [];
    }
    const xml = await response.text();
    return parseRSS(xml, "dmhy");
  } catch (error) {
    logger.error({ err: error }, "DMHY RSS fetch error");
    return [];
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

export async function searchTorrents(keyword: string): Promise<RSSItem[]> {
  const [mikanResults, dmhyResults] = await Promise.all([
    fetchMikanRSS(keyword),
    fetchDmhyRSS(keyword),
  ]);
  const results = [...mikanResults, ...dmhyResults];
  const titles = results.map((item) => item.title);
  const aiParsed = await parseTorrentTitles(titles);
  if (aiParsed && aiParsed.length > 0) {
    return results.map((item, index) => ({
      ...item,
      ai: aiParsed[index] || undefined,
    }));
  }
  return results;
}
