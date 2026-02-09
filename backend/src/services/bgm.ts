import {
  reportIntegrationFailure,
  reportIntegrationSuccess,
} from "./integration-health";
import { logger } from "./logger";
const BGM_BASE_URL = "https://api.bgm.tv/v0";

export interface BGMSubject {
  id: number;
  name: string;
  name_cn: string;
  summary: string;
  date?: string;
  eps?: number;
  total_episodes?: number;
  rating?: {
    score: number;
  };
  images?: {
    large?: string;
    common?: string;
    medium?: string;
    small?: string;
    grid?: string;
  };
}

export interface BGMSearchResponse {
  total: number;
  limit: number;
  offset: number;
  data: BGMSubject[];
}

export interface BGMEpisode {
  id: number;
  type: number;
  name: string;
  name_cn: string;
  sort: number;
  ep?: number;
  airdate?: string;
  desc?: string;
  duration?: string;
}

export interface BGMSearchEpisodesResponse {
  total: number;
  limit: number;
  offset: number;
  data: BGMEpisode[];
}

async function bgmFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const start = Date.now();
  try {
    const method = (options?.method || "GET").toString().toUpperCase();
    logger.debug(
      {
        op: "integration.bgm.request",
        provider: "bgm",
        path,
        method,
      },
      "Bangumi API request"
    );
    const response = await fetch(`${BGM_BASE_URL}${path}`, {
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "nas-tools",
      },
      ...options,
    });

    if (!response.ok) {
      logger.warn(
        {
          op: "integration.bgm.response_error",
          provider: "bgm",
          path,
          method,
          status: response.status,
          durationMs: Date.now() - start,
        },
        "Bangumi API response was not OK"
      );
      throw new Error(`BGM API error: ${response.status} ${response.statusText}`);
    }

    logger.debug(
      {
        op: "integration.bgm.response",
        provider: "bgm",
        path,
        method,
        status: response.status,
        durationMs: Date.now() - start,
      },
      "Bangumi API response received"
    );
    reportIntegrationSuccess("bgm", "Last Bangumi API call succeeded");
    return response.json() as Promise<T>;
  } catch (error) {
    logger.error(
      {
        op: "integration.bgm.request_error",
        provider: "bgm",
        path,
        method: (options?.method || "GET").toString().toUpperCase(),
        durationMs: Date.now() - start,
        err: error,
      },
      "Bangumi API request failed"
    );
    reportIntegrationFailure("bgm", error, "Bangumi API call failed");
    throw error;
  }
}

export async function searchSubjects(
  keyword: string,
  options: { limit?: number; offset?: number; types?: number[] } = {}
): Promise<BGMSearchResponse> {
  const limit = options.limit ?? 20;
  const offset = options.offset ?? 0;
  const types = options.types ?? [2];
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });

  return bgmFetch<BGMSearchResponse>(`/search/subjects?${params.toString()}`, {
    method: "POST",
    body: JSON.stringify({
      keyword,
      sort: "match",
      filter: {
        type: types,
        nsfw: false,
      },
    }),
  });
}

export async function getEpisodes(
  subjectId: number,
  options: { limit?: number; offset?: number; type?: number } = {}
): Promise<BGMSearchEpisodesResponse> {
  const limit = options.limit ?? 100;
  const offset = options.offset ?? 0;
  const params = new URLSearchParams({
    subject_id: String(subjectId),
    limit: String(limit),
    offset: String(offset),
  });
  if (options.type != null) params.set("type", String(options.type));
  return bgmFetch<BGMSearchEpisodesResponse>(`/episodes?${params.toString()}`);
}

export async function getAllEpisodes(
  subjectId: number,
  options: { type?: number } = {}
): Promise<BGMEpisode[]> {
  const limit = 100;
  let offset = 0;
  const all: BGMEpisode[] = [];
  for (;;) {
    const res = await getEpisodes(subjectId, { limit, offset, type: options.type });
    all.push(...res.data);
    offset += res.limit;
    if (offset >= res.total || res.data.length === 0) break;
  }
  return all;
}

export async function getSubjectDetail(id: number): Promise<BGMSubject> {
  return bgmFetch<BGMSubject>(`/subjects/${id}`);
}
