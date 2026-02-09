import { existsSync } from "fs";

export function modulePath(relativePath: string): string {
  const basePath = new URL(relativePath, import.meta.url).pathname;
  if (basePath.endsWith(".ts")) return basePath;
  const withTs = `${basePath}.ts`;
  if (existsSync(withTs)) return withTs;
  const indexTs = `${basePath}/index.ts`;
  if (existsSync(indexTs)) return indexTs;
  return basePath;
}
