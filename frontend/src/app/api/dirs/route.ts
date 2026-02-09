import { readdir } from "fs/promises";
import { resolve } from "path";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const inputPath = (searchParams.get("path") || "").trim();

  if (!inputPath) {
    return Response.json({ error: "path is required" }, { status: 400 });
  }

  const resolved = resolve(inputPath);

  try {
    const entries = await readdir(resolved, { withFileTypes: true });
    const dirs = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => ({
        name: entry.name,
        path: resolve(resolved, entry.name),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return Response.json({ path: resolved, dirs });
  } catch (err: any) {
    return Response.json(
      { error: err?.message || "Failed to read directory" },
      { status: 400 }
    );
  }
}
