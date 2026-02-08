import { parse, stringify } from "yaml";
import { join } from "path";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";

export interface Config {
  core: {
    api_token: string;
  };
  rss: {
    eject_title_rules: string[];
  };
  log: {
    dir: string;
    level: string;
  };
  qbittorrent: {
    url: string;
    username: string;
    password?: string;
    tag: string;
    download_dirs: {
      anime: string;
      tv: string;
      movie: string;
    };
    path_map: Array<{
      from: string;
      to: string;
    }>;
  };
  tmdb: {
    token: string;
  };
  media_dirs: {
    anime: string;
    tv: string;
    movie: string;
  };
  ai: {
    api_url: string;
    api_token: string;
    model: string;
  };
}

const CONFIG_PATH = join(import.meta.dir, "..", "..", "data", "config.yaml");

function generateToken(): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

const DEFAULT_CONFIG: Config = {
  core: {
    api_token: "", // Will be generated if empty or missing
  },
  rss: {
    eject_title_rules: ["720[Pp]", "合集", "特别篇"],
  },
  log: {
    // Defaults to `${process.cwd()}/log`.
    dir: join(process.cwd(), "log"),
    level: "warn",
  },
  qbittorrent: {
    url: "http://localhost:8080",
    username: "admin",
    password: "",
    tag: "nas-tools",
    download_dirs: {
      anime: "",
      tv: "",
      movie: "",
    },
    path_map: [],
  },
  tmdb: {
    token: "",
  },
  media_dirs: {
    anime: "/media/anime",
    tv: "/media/tv",
    movie: "/media/movies",
  },
  ai: {
    api_url: "",
    api_token: "",
    model: "",
  },
};

let currentConfig: Config | null = null;

export function loadConfig(): Config {
  if (currentConfig) return currentConfig;

  try {
    if (!existsSync(CONFIG_PATH)) {
      // Ensure directory exists
      mkdirSync(join(CONFIG_PATH, ".."), { recursive: true });
      
      const initialConfig = { ...DEFAULT_CONFIG };
      initialConfig.core.api_token = generateToken();
      saveConfig(initialConfig);
      return initialConfig;
    }

    const fileContent = readFileSync(CONFIG_PATH, "utf-8");
    const parsed = parse(fileContent) as Partial<Config>;
    
    // Merge with defaults to ensure all keys exist
    currentConfig = {
      core: { ...DEFAULT_CONFIG.core, ...parsed.core },
      rss: {
        ...DEFAULT_CONFIG.rss,
        ...parsed.rss,
        eject_title_rules: Array.isArray(parsed.rss?.eject_title_rules)
          ? parsed.rss?.eject_title_rules || []
          : DEFAULT_CONFIG.rss.eject_title_rules,
      },
      log: { ...DEFAULT_CONFIG.log, ...parsed.log },
      qbittorrent: {
        ...DEFAULT_CONFIG.qbittorrent,
        ...parsed.qbittorrent,
        download_dirs: {
          ...DEFAULT_CONFIG.qbittorrent.download_dirs,
          ...parsed.qbittorrent?.download_dirs,
        },
        path_map: Array.isArray(parsed.qbittorrent?.path_map)
          ? parsed.qbittorrent?.path_map || []
          : DEFAULT_CONFIG.qbittorrent.path_map,
      },
      tmdb: { ...DEFAULT_CONFIG.tmdb, ...parsed.tmdb },
      media_dirs: { ...DEFAULT_CONFIG.media_dirs, ...parsed.media_dirs },
      ai: { ...DEFAULT_CONFIG.ai, ...parsed.ai },
    };

    return currentConfig;
  } catch (error) {
    console.error("Failed to load config:", error);
    // Fallback to defaults in case of error
    return { ...DEFAULT_CONFIG, core: { api_token: generateToken() } };
  }
}

export function saveConfig(config: Config): void {
  try {
    const yamlString = stringify(config);
    writeFileSync(CONFIG_PATH, yamlString, "utf-8");
    currentConfig = config;
  } catch (error) {
    console.error("Failed to save config:", error);
  }
}

// Adapter for legacy flat-key access
export function getConfigValue(key: string): string {
  const config = loadConfig();
  switch (key) {
    case "api_token": return config.core.api_token;
    case "eject_title_rules":
      return JSON.stringify(config.rss.eject_title_rules || []);
    case "log_dir": return config.log.dir;
    case "log_level": return config.log.level;
    case "qbit_url": return config.qbittorrent.url;
    case "qbit_username": return config.qbittorrent.username;
    case "qbit_password": return config.qbittorrent.password || "";
    case "qbit_tag": return config.qbittorrent.tag;
    case "qbit_download_dir_anime": return config.qbittorrent.download_dirs.anime;
    case "qbit_download_dir_tv": return config.qbittorrent.download_dirs.tv;
    case "qbit_download_dir_movie": return config.qbittorrent.download_dirs.movie;
    case "qbit_path_map": return JSON.stringify(config.qbittorrent.path_map || []);
    case "tmdb_token": return config.tmdb.token;
    case "media_dir_anime": return config.media_dirs.anime;
    case "media_dir_tv": return config.media_dirs.tv;
    case "media_dir_movie": return config.media_dirs.movie;
    case "ai_api_url": return config.ai.api_url;
    case "ai_api_token": return config.ai.api_token;
    case "ai_model": return config.ai.model;
    default: return "";
  }
}

export function updateConfigValues(updates: Record<string, string>): void {
  const config = { ...loadConfig() };

  for (const [key, value] of Object.entries(updates)) {
    switch (key) {
      case "api_token": config.core.api_token = value; break;
      case "eject_title_rules":
        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed)) {
            config.rss.eject_title_rules = parsed
              .filter((entry) => typeof entry === "string")
              .map((entry) => entry.trim())
              .filter(Boolean);
          }
        } catch {
          // Ignore invalid JSON, keep existing rules
        }
        break;
      case "log_dir": config.log.dir = value; break;
      case "log_level": config.log.level = value; break;
      case "qbit_url": config.qbittorrent.url = value; break;
      case "qbit_username": config.qbittorrent.username = value; break;
      case "qbit_password": config.qbittorrent.password = value; break;
      case "qbit_tag": config.qbittorrent.tag = value; break;
      case "qbit_download_dir_anime": config.qbittorrent.download_dirs.anime = value; break;
      case "qbit_download_dir_tv": config.qbittorrent.download_dirs.tv = value; break;
      case "qbit_download_dir_movie": config.qbittorrent.download_dirs.movie = value; break;
      case "qbit_path_map":
        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed)) {
            config.qbittorrent.path_map = parsed
              .map((entry) => ({
                from: typeof entry?.from === "string" ? entry.from : "",
                to: typeof entry?.to === "string" ? entry.to : "",
              }))
              .filter((entry) => entry.from && entry.to);
          }
        } catch {
          // Ignore invalid JSON, keep existing map
        }
        break;
      case "tmdb_token": config.tmdb.token = value; break;
      case "media_dir_anime": config.media_dirs.anime = value; break;
      case "media_dir_tv": config.media_dirs.tv = value; break;
      case "media_dir_movie": config.media_dirs.movie = value; break;
      case "ai_api_url": config.ai.api_url = value; break;
      case "ai_api_token": config.ai.api_token = value; break;
      case "ai_model": config.ai.model = value; break;
    }
  }

  saveConfig(config);
}
