export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { getErrorMessage } from "@/lib/errors";

const BGM_SUBJECT_BASE = "https://api.bgm.tv/v0/subjects";

export async function GET(
  _request: Request,
  context: { params: { id: string } | Promise<{ id: string }> }
) {
  const { id } = await context.params;

  if (!id || Number.isNaN(Number(id))) {
    return Response.json({ error: "Invalid subject id" }, { status: 400 });
  }

  try {
    const response = await fetch(`${BGM_SUBJECT_BASE}/${id}`, {
      headers: {
        Accept: "application/json",
        "User-Agent": "nas-tools",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return Response.json(
        { error: `BGM API error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return Response.json(data);
  } catch (err: unknown) {
    return Response.json(
      { error: getErrorMessage(err, "Failed to fetch BGM subject") },
      { status: 500 }
    );
  }
}
