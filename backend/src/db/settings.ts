import { loadConfig, updateConfigValues, getConfigValue } from "../config";

export interface Setting {
  key: string;
  value: string;
}

export function getSetting(key: string): string | null {
  return getConfigValue(key);
}

export function getAllSettings(): Record<string, string> {
  const config = loadConfig();
  return {
    api_token: config.core.api_token,
    qbit_url: config.qbittorrent.url,
    qbit_username: config.qbittorrent.username,
    qbit_password: config.qbittorrent.password || "",
    tmdb_token: config.tmdb.token,
    media_dir_anime: config.media_dirs.anime,
    media_dir_tv: config.media_dirs.tv,
    media_dir_movie: config.media_dirs.movie,
    ai_api_url: config.ai.api_url,
    ai_api_token: config.ai.api_token,
    ai_model: config.ai.model,
  };
}

export function setSetting(key: string, value: string): void {
  updateConfigValues({ [key]: value });
}

export function setSettings(settings: Record<string, string>): void {
  updateConfigValues(settings);
}
