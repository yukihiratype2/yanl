import { Hono } from "hono";
import {
  getAllProfiles,
  getProfileById,
  createProfile,
  updateProfile,
  deleteProfile,
  setDefaultProfile,
  type Profile,
} from "../db/models";

const profileRoutes = new Hono();

// List all profiles
profileRoutes.get("/", (c) => {
  const profiles = getAllProfiles();
  return c.json(profiles);
});

// Get a single profile
profileRoutes.get("/:id", (c) => {
  const id = parseInt(c.req.param("id"));
  const profile = getProfileById(id);
  if (!profile) {
    return c.json({ error: "Profile not found" }, 404);
  }
  return c.json(profile);
});

// Create a profile
profileRoutes.post("/", async (c) => {
  const body = await c.req.json<{
    name: string;
    description?: string;
    resolutions?: string[];
    qualities?: string[];
    formats?: string[];
    encoders?: string[];
    min_size_mb?: number;
    max_size_mb?: number;
    preferred_keywords?: string[];
    excluded_keywords?: string[];
    is_default?: boolean;
  }>();

  if (!body.name || !body.name.trim()) {
    return c.json({ error: "Profile name is required" }, 400);
  }

  try {
    const profile = createProfile({
      name: body.name.trim(),
      description: body.description || null,
      resolutions: body.resolutions ? JSON.stringify(body.resolutions) : null,
      qualities: body.qualities ? JSON.stringify(body.qualities) : null,
      formats: body.formats ? JSON.stringify(body.formats) : null,
      encoders: body.encoders ? JSON.stringify(body.encoders) : null,
      min_size_mb: body.min_size_mb ?? null,
      max_size_mb: body.max_size_mb ?? null,
      preferred_keywords: body.preferred_keywords
        ? JSON.stringify(body.preferred_keywords)
        : null,
      excluded_keywords: body.excluded_keywords
        ? JSON.stringify(body.excluded_keywords)
        : null,
      is_default: body.is_default ? 1 : 0,
    });
    if (body.is_default) {
      setDefaultProfile(profile.id);
      return c.json(getProfileById(profile.id), 201);
    }
    return c.json(profile, 201);
  } catch (err: any) {
    if (err.message?.includes("UNIQUE constraint")) {
      return c.json({ error: "A profile with this name already exists" }, 409);
    }
    throw err;
  }
});

// Update a profile
profileRoutes.put("/:id", async (c) => {
  const id = parseInt(c.req.param("id"));
  const existing = getProfileById(id);
  if (!existing) {
    return c.json({ error: "Profile not found" }, 404);
  }

  const body = await c.req.json<{
    name?: string;
    description?: string;
    resolutions?: string[];
    qualities?: string[];
    formats?: string[];
    encoders?: string[];
    min_size_mb?: number | null;
    max_size_mb?: number | null;
    preferred_keywords?: string[];
    excluded_keywords?: string[];
    is_default?: boolean;
  }>();

  const data: Partial<Profile> = {};
  if (body.name !== undefined) data.name = body.name.trim();
  if (body.description !== undefined) data.description = body.description;
  if (body.resolutions !== undefined)
    data.resolutions = JSON.stringify(body.resolutions);
  if (body.qualities !== undefined)
    data.qualities = JSON.stringify(body.qualities);
  if (body.formats !== undefined) data.formats = JSON.stringify(body.formats);
  if (body.encoders !== undefined)
    data.encoders = JSON.stringify(body.encoders);
  if (body.min_size_mb !== undefined) data.min_size_mb = body.min_size_mb;
  if (body.max_size_mb !== undefined) data.max_size_mb = body.max_size_mb;
  if (body.preferred_keywords !== undefined)
    data.preferred_keywords = JSON.stringify(body.preferred_keywords);
  if (body.excluded_keywords !== undefined)
    data.excluded_keywords = JSON.stringify(body.excluded_keywords);
  if (body.is_default === false) data.is_default = 0;

  try {
    if (body.is_default === true) {
      setDefaultProfile(id);
    }
    updateProfile(id, data);
    return c.json(getProfileById(id));
  } catch (err: any) {
    if (err.message?.includes("UNIQUE constraint")) {
      return c.json({ error: "A profile with this name already exists" }, 409);
    }
    throw err;
  }
});

// Delete a profile
profileRoutes.delete("/:id", (c) => {
  const id = parseInt(c.req.param("id"));
  const existing = getProfileById(id);
  if (!existing) {
    return c.json({ error: "Profile not found" }, 404);
  }
  deleteProfile(id);
  return c.json({ success: true });
});

export default profileRoutes;
