import { getSetting } from "../db/settings";
import {
  reportIntegrationFailure,
  reportIntegrationSuccess,
} from "./integration-health";

const TMDB_BASE_URL = "https://api.themoviedb.org/3";

interface TMDBSearchResult {
  id: number;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date?: string;
  release_date?: string;
  vote_average: number;
  media_type?: string;
}

interface TMDBSearchResponse {
  page: number;
  results: TMDBSearchResult[];
  total_pages: number;
  total_results: number;
}

interface TMDBSeasonDetail {
  id: number;
  season_number: number;
  name: string;
  overview: string;
  poster_path: string | null;
  air_date: string | null;
  episodes: TMDBEpisode[];
}

interface TMDBEpisode {
  id: number;
  episode_number: number;
  name: string;
  overview: string;
  air_date: string | null;
  still_path: string | null;
}

interface TMDBTVDetail {
  id: number;
  name: string;
  original_name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string;
  vote_average: number;
  number_of_seasons: number;
  number_of_episodes: number;
  seasons: {
    id: number;
    season_number: number;
    name: string;
    episode_count: number;
    air_date: string | null;
    poster_path: string | null;
  }[];
  genres: { id: number; name: string }[];
}

interface TMDBMovieDetail {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number;
  genres: { id: number; name: string }[];
}

function getToken(): string {
  const token = getSetting("tmdb_token");
  if (!token) throw new Error("TMDB token not configured");
  return token;
}

async function tmdbFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  try {
    const token = getToken();
    const url = new URL(`${TMDB_BASE_URL}${path}`);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
      }
    }

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.status} ${response.statusText}`);
    }

    reportIntegrationSuccess("tmdb", "Last TMDB API call succeeded");
    return response.json() as Promise<T>;
  } catch (error) {
    reportIntegrationFailure("tmdb", error, "TMDB API call failed");
    throw error;
  }
}

export async function searchMulti(query: string, page = 1): Promise<TMDBSearchResponse> {
  return tmdbFetch<TMDBSearchResponse>("/search/multi", {
    query,
    page: String(page),
    language: "zh-CN",
  });
}

export async function searchTV(query: string, page = 1): Promise<TMDBSearchResponse> {
  return tmdbFetch<TMDBSearchResponse>("/search/tv", {
    query,
    page: String(page),
    language: "zh-CN",
  });
}

export async function searchMovie(query: string, page = 1): Promise<TMDBSearchResponse> {
  return tmdbFetch<TMDBSearchResponse>("/search/movie", {
    query,
    page: String(page),
    language: "zh-CN",
  });
}

export async function getTVDetail(tvId: number): Promise<TMDBTVDetail> {
  return tmdbFetch<TMDBTVDetail>(`/tv/${tvId}`, { language: "zh-CN" });
}

export async function getMovieDetail(movieId: number): Promise<TMDBMovieDetail> {
  return tmdbFetch<TMDBMovieDetail>(`/movie/${movieId}`, { language: "zh-CN" });
}

export async function getSeasonDetail(
  tvId: number,
  seasonNumber: number
): Promise<TMDBSeasonDetail> {
  return tmdbFetch<TMDBSeasonDetail>(`/tv/${tvId}/season/${seasonNumber}`, {
    language: "zh-CN",
  });
}

export async function getAiringToday(page = 1): Promise<TMDBSearchResponse> {
  return tmdbFetch<TMDBSearchResponse>("/tv/airing_today", {
    page: String(page),
    language: "zh-CN",
  });
}
