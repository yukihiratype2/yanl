import { XMLParser } from "fast-xml-parser";

export interface RSSItem {
  title: string;
  link: string;
  pubDate?: string;
  description?: string;
  enclosure?: {
    url: string;
    type: string;
    length: string;
  };
  size?: string;
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
      console.error(`Mikan RSS fetch failed: ${response.status}`);
      return [];
    }
    const xml = await response.text();
    return parseRSS(xml, "mikan");
  } catch (error) {
    console.error("Mikan RSS fetch error:", error);
    return [];
  }
}

export async function fetchDmhyRSS(keyword: string): Promise<RSSItem[]> {
  const url = `https://share.dmhy.org/topics/rss/rss.xml?keyword=${encodeURIComponent(keyword)}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`DMHY RSS fetch failed: ${response.status}`);
      return [];
    }
    const xml = await response.text();
    return parseRSS(xml, "dmhy");
  } catch (error) {
    console.error("DMHY RSS fetch error:", error);
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
            url: item.enclosure["@_url"] || item.enclosure.url || "",
            type: item.enclosure["@_type"] || item.enclosure.type || "",
            length: item.enclosure["@_length"] || item.enclosure.length || "",
          }
        : undefined;

      return {
        title: item.title || "",
        link: enclosure?.url || item.link || "",
        pubDate: item.pubDate || "",
        description: item.description || "",
        enclosure,
        source,
      } as RSSItem;
    });
  } catch (error) {
    console.error(`RSS parse error for ${source}:`, error);
    return [];
  }
}

export async function searchTorrents(keyword: string): Promise<RSSItem[]> {
  const [mikanResults, dmhyResults] = await Promise.all([
    fetchMikanRSS(keyword),
    fetchDmhyRSS(keyword),
  ]);
  return [...mikanResults, ...dmhyResults];
}
