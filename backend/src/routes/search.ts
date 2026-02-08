import { Hono } from "hono";
import * as tmdb from "../services/tmdb";

const searchRoutes = new Hono();

// Search media (multi search)
searchRoutes.get("/", async (c) => {
  const query = c.req.query("q");
  const page = parseInt(c.req.query("page") || "1");
  const type = c.req.query("type"); // tv, movie, or undefined for multi

  if (!query) {
    return c.json({ error: "Missing query parameter 'q'" }, 400);
  }

  try {
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
    return c.json(results);
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
