import { Hono } from "hono";
import * as tmdb from "../services/tmdb";
import * as bgm from "../services/bgm";

const searchRoutes = new Hono();

// Search media (multi search)
searchRoutes.get("/", async (c) => {
  const query = c.req.query("q");
  const page = parseInt(c.req.query("page") || "1");
  const type = c.req.query("type"); // tv, movie, or undefined for multi
  const source = (c.req.query("source") || "tvdb").toLowerCase();

  if (!query) {
    return c.json({ error: "Missing query parameter 'q'" }, 400);
  }

  try {
    if (source === "bgm") {
      const limit = 20;
      const offset = (page - 1) * limit;
      const bgmRes = await bgm.searchSubjects(query, { limit, offset, types: [2, 6] });
      const totalPages = bgmRes.limit > 0 ? Math.ceil(bgmRes.total / bgmRes.limit) : 1;
      return c.json({
        page,
        results: bgmRes.data.map((item) => ({
          id: item.id,
          title: item.name_cn || item.name,
          name: item.name_cn || item.name,
          original_name: item.name,
          overview: item.summary || "",
          poster_path: item.images?.medium ?? item.images?.small ?? null,
          backdrop_path: item.images?.large ?? null,
          first_air_date: item.date ?? null,
          vote_average: item.rating?.score ?? 0,
          media_type: "tv",
          source: "bgm",
        })),
        total_pages: totalPages,
        total_results: bgmRes.total,
      });
    }

    let results;
    switch (type) {
      case "tv":
        results = await tmdb.searchTV(query, page);
        break;
      case "movie":
        results = await tmdb.searchMovie(query, page);
        break;
      default:
        results = await tmdb.searchMulti(query, page);
        break;
    }
    return c.json({
      ...results,
      results: results.results.map((item) => ({
        ...item,
        source: "tvdb",
      })),
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Get TV show details
searchRoutes.get("/tv/:id", async (c) => {
  const id = parseInt(c.req.param("id"));
  try {
    const detail = await tmdb.getTVDetail(id);
    return c.json(detail);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Get movie details
searchRoutes.get("/movie/:id", async (c) => {
  const id = parseInt(c.req.param("id"));
  try {
    const detail = await tmdb.getMovieDetail(id);
    return c.json(detail);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Get TV season details
searchRoutes.get("/tv/:id/season/:season", async (c) => {
  const tvId = parseInt(c.req.param("id"));
  const seasonNumber = parseInt(c.req.param("season"));
  try {
    const detail = await tmdb.getSeasonDetail(tvId, seasonNumber);
    return c.json(detail);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

export default searchRoutes;
