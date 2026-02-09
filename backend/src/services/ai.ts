import { loadConfig } from "../config";
import {
  reportIntegrationFailure,
  reportIntegrationSuccess,
} from "./integration-health";
import { logger } from "./logger";

const CHAT_COMPLETIONS_PATH = "/chat/completions";

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export interface AITitleParse {
  englishTitle?: string;
  chineseTitle?: string;
  resolution?: string;
  subTeam?: string;
  format?: string;
  size?: string;
  episodeNumber?: number;
  seasonNumber?: number;
  subtitleLanguage?: string;
}

function buildChatEndpoint(baseUrl: string): string {
  if (!baseUrl) return baseUrl;
  return baseUrl.replace(/\/+$/, "") + CHAT_COMPLETIONS_PATH;
}

async function callChatCompletion(
  configUrl: string,
  apiToken: string,
  messages: ChatMessage[],
  model: string,
  temperature: number
): Promise<string | null> {
  const endpoint = buildChatEndpoint(configUrl);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiToken}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
      }),
    });

    if (!response.ok) {
      throw new Error(`AI API failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    reportIntegrationSuccess("ai", "Last AI API call succeeded");
    return data.choices?.[0]?.message?.content?.trim() ?? null;
  } catch (error) {
    reportIntegrationFailure("ai", error, "AI API call failed");
    throw error;
  }
}

export async function testAIConfig(): Promise<string | null> {
  const config = loadConfig();
  if (!config.ai.api_url || !config.ai.api_token) {
    throw new Error("AI API URL or token is not configured");
  }

  const testMessages: ChatMessage[] = [
    { role: "system", content: "You are a helpful assistant." },
    { role: "user", content: "Test" },
  ];

  return callChatCompletion(
    config.ai.api_url,
    config.ai.api_token,
    testMessages,
    config.ai.model || "gpt-3.5-turbo",
    0
  );
}

export async function parseTorrentTitles(
  titles: string[]
): Promise<AITitleParse[] | null> {
  const config = loadConfig();
  if (!config.ai.api_url || !config.ai.api_token) {
    logger.warn("AI config missing. Skipping AI parsing.");
    return null;
  }

  if (titles.length === 0) return [];

  const systemPrompt = `
You are a parser for release titles from anime RSS feeds.
For each title, extract the following fields when available:
- englishTitle
- chineseTitle
- resolution
- subTeam
- format
- size
- episodeNumber
- seasonNumber
- subtitleLanguage

Return ONLY a JSON array with the same length and order as the input.
Use null for fields you cannot determine.
Return episodeNumber and seasonNumber as numbers (not strings).
No markdown, no extra text.

Example response for 2 titles:
[
  {
    "englishTitle": "Frieren: Beyond Journey's End",
    "chineseTitle": "葬送的芙莉莲",
    "resolution": "1080p",
    "subTeam": "Lilith-Raws",
    "format": "WEB-DL",
    "size": "1.4GB",
    "episodeNumber": 12,
    "seasonNumber": 1,
    "subtitleLanguage": "CHS"
  },
  {
    "englishTitle": null,
    "chineseTitle": "迷宫饭",
    "resolution": "720p",
    "subTeam": null,
    "format": "HEVC",
    "size": null,
    "episodeNumber": null,
    "seasonNumber": null,
    "subtitleLanguage": null
  }
]
`;

  try {
    const content = await callChatCompletion(
      config.ai.api_url,
      config.ai.api_token,
      [
        { role: "system", content: systemPrompt.trim() },
        { role: "user", content: JSON.stringify(titles) },
      ],
      config.ai.model || "gpt-3.5-turbo",
      0
    );

    if (!content) return null;

    const jsonString = content.replace(/```json\n?|\n?```/g, "").trim();
    const parsed = JSON.parse(jsonString);
    if (!Array.isArray(parsed)) return null;
    return parsed as AITitleParse[];
  } catch (error) {
    logger.error({ err: error }, "Error parsing titles with AI");
    return null;
  }
}
