import { mkdirSync, renameSync, copyFileSync, existsSync, readdirSync, statSync } from "fs";
import { join, basename, extname } from "path";
import { getSetting } from "../db/settings";

const VIDEO_EXTENSIONS = new Set([
  ".mkv", ".mp4", ".avi", ".wmv", ".flv", ".mov", ".ts", ".m2ts",
]);

export function getMediaDir(mediaType: "anime" | "tv" | "movie"): string {
  const key = `media_dir_${mediaType}`;
  const dir = getSetting(key);
  if (!dir) throw new Error(`Media directory not configured for ${mediaType}`);
  return dir;
}

export function createMediaFolder(
  mediaType: "anime" | "tv" | "movie",
  title: string,
  seasonNumber?: number | null
): string {
  const baseDir = getMediaDir(mediaType);
  let folderPath: string;

  if (mediaType === "movie") {
    folderPath = join(baseDir, sanitizeFolderName(title));
  } else {
    const showDir = join(baseDir, sanitizeFolderName(title));
    if (seasonNumber != null) {
      folderPath = join(showDir, `Season ${String(seasonNumber).padStart(2, "0")}`);
    } else {
      folderPath = showDir;
    }
  }

  mkdirSync(folderPath, { recursive: true });
  return folderPath;
}

export function moveFileToMediaDir(
  sourcePath: string,
  destDir: string,
  newFileName?: string
): string {
  if (!existsSync(sourcePath)) {
    throw new Error(`Source file does not exist: ${sourcePath}`);
  }

  mkdirSync(destDir, { recursive: true });

  const fileName = newFileName || basename(sourcePath);
  const destPath = join(destDir, fileName);

  try {
    // Try rename first (same filesystem, instant)
    renameSync(sourcePath, destPath);
  } catch {
    // Fall back to copy if cross-filesystem
    copyFileSync(sourcePath, destPath);
    // Optionally delete source after copy
  }

  return destPath;
}

export function findVideoFiles(dirPath: string): string[] {
  const results: string[] = [];

  if (!existsSync(dirPath)) return results;

  const stat = statSync(dirPath);
  if (stat.isFile()) {
    if (VIDEO_EXTENSIONS.has(extname(dirPath).toLowerCase())) {
      results.push(dirPath);
    }
    return results;
  }

  const entries = readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name);
    if (entry.isDirectory()) {
      results.push(...findVideoFiles(fullPath));
    } else if (VIDEO_EXTENSIONS.has(extname(entry.name).toLowerCase())) {
      results.push(fullPath);
    }
  }

  return results;
}

function sanitizeFolderName(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
