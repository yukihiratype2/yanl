export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 1800;
import { getErrorMessage } from "@/lib/errors";

const BGM_CALENDAR_URL = "https://api.bgm.tv/calendar";

export async function GET() {
  try {
    const response = await fetch(BGM_CALENDAR_URL, {
      headers: {
        Accept: "application/json",
        "User-Agent": "nas-tools",
      },
      next: { revalidate: 1800 },
    });

    if (!response.ok) {
      return Response.json(
        { error: `BGM API error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return Response.json(data, {
      headers: {
        "Cache-Control": "public, max-age=1800, s-maxage=1800",
      },
    });
  } catch (err: unknown) {
    return Response.json(
      { error: getErrorMessage(err, "Failed to fetch BGM calendar") },
      { status: 500 }
    );
  }
}
