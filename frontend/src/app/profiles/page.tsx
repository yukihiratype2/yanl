"use client";

import { useState, useEffect } from "react";
import {
  SlidersHorizontal,
  Plus,
  Pencil,
  Trash2,
  X,
  Save,
  Loader2,
  Monitor,
  Film,
  HardDrive,
  Cpu,
  Tag,
  Ban,
} from "lucide-react";
import {
  getProfiles,
  createProfile,
  updateProfile,
  deleteProfile,
  type Profile,
  type ProfileInput,
} from "@/lib/api";

const RESOLUTION_OPTIONS = ["2160p", "1080p", "720p", "480p"];
const QUALITY_OPTIONS = ["bluray", "remux", "webdl", "webrip", "hdtv", "dvdrip", "cam"];
const FORMAT_OPTIONS = ["mkv", "mp4", "avi", "wmv"];
const ENCODER_OPTIONS = ["x265", "x264", "av1", "hevc", "h264", "vp9", "mpeg4"];

function parseJsonArray(value: string | null): string[] {
  if (!value) return [];
  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
}

const emptyForm: ProfileInput = {
  name: "",
  description: "",
  resolutions: [],
  qualities: [],
  formats: [],
  encoders: [],
  min_size_mb: null,
  max_size_mb: null,
  preferred_keywords: [],
  excluded_keywords: [],
};

function profileToForm(profile: Profile): ProfileInput {
  return {
    name: profile.name,
    description: profile.description || "",
    resolutions: parseJsonArray(profile.resolutions),
    qualities: parseJsonArray(profile.qualities),
    formats: parseJsonArray(profile.formats),
    encoders: parseJsonArray(profile.encoders),
    min_size_mb: profile.min_size_mb,
    max_size_mb: profile.max_size_mb,
    preferred_keywords: parseJsonArray(profile.preferred_keywords),
    excluded_keywords: parseJsonArray(profile.excluded_keywords),
  };
}

function TagInput({
  value,
  onChange,
  placeholder,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
}) {
  const [input, setInput] = useState("");

  const addTag = () => {
    const trimmed = input.trim().toLowerCase();
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
    }
    setInput("");
  };

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-1.5">
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-md"
          >
            {tag}
            <button
              type="button"
              onClick={() => onChange(value.filter((t) => t !== tag))}
              className="hover:text-destructive"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            addTag();
          }
        }}
        onBlur={addTag}
        placeholder={placeholder}
        className="w-full px-3 py-1.5 bg-secondary border border-border rounded-lg text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
      />
    </div>
  );
}

function MultiSelect({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const toggle = (opt: string) => {
    if (value.includes(opt)) {
      onChange(value.filter((v) => v !== opt));
    } else {
      onChange([...value, opt]);
    }
  };

  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => toggle(opt)}
          className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
            value.includes(opt)
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-secondary text-muted-foreground border-border hover:border-primary/50"
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

export default function ProfilesPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ProfileInput>({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [settingDefaultId, setSettingDefaultId] = useState<number | null>(null);

  useEffect(() => {
    loadProfiles();
  }, []);

  async function loadProfiles() {
    try {
      setLoading(true);
      const data = await getProfiles();
      setProfiles(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setForm({ ...emptyForm });
    setEditingId(null);
    setShowForm(true);
    setError(null);
  }

  function openEdit(profile: Profile) {
    setForm(profileToForm(profile));
    setEditingId(profile.id);
    setShowForm(true);
    setError(null);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setError(null);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      setError("Profile name is required");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      if (editingId) {
        await updateProfile(editingId, form);
      } else {
        await createProfile(form);
      }
      closeForm();
      await loadProfiles();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteProfile(id);
      setDeleteConfirm(null);
      await loadProfiles();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleSetDefault(id: number) {
    try {
      setSettingDefaultId(id);
      await updateProfile(id, { is_default: true });
      await loadProfiles();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSettingDefaultId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <SlidersHorizontal className="w-7 h-7 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Profiles</h1>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          New Profile
        </button>
      </div>

      <p className="text-muted-foreground text-sm">
        Profiles define quality constraints for media downloads — resolution,
        quality, format, encoder, file size, and keyword filters.
      </p>

      {error && !showForm && (
        <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="text-lg font-semibold text-foreground">
                {editingId ? "Edit Profile" : "Create Profile"}
              </h2>
              <button
                onClick={closeForm}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-5">
              {error && (
                <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. HD Quality, 4K Remux"
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Description
                </label>
                <textarea
                  value={form.description || ""}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  placeholder="Optional description of this profile"
                  rows={2}
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                />
              </div>

              {/* Resolution */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-foreground mb-2">
                  <Monitor className="w-4 h-4" />
                  Resolutions
                </label>
                <MultiSelect
                  options={RESOLUTION_OPTIONS}
                  value={form.resolutions || []}
                  onChange={(v) => setForm({ ...form, resolutions: v })}
                />
              </div>

              {/* Quality */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-foreground mb-2">
                  <Film className="w-4 h-4" />
                  Qualities
                </label>
                <MultiSelect
                  options={QUALITY_OPTIONS}
                  value={form.qualities || []}
                  onChange={(v) => setForm({ ...form, qualities: v })}
                />
              </div>

              {/* Format */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-foreground mb-2">
                  <HardDrive className="w-4 h-4" />
                  Formats
                </label>
                <MultiSelect
                  options={FORMAT_OPTIONS}
                  value={form.formats || []}
                  onChange={(v) => setForm({ ...form, formats: v })}
                />
              </div>

              {/* Encoder */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-foreground mb-2">
                  <Cpu className="w-4 h-4" />
                  Encoders
                </label>
                <MultiSelect
                  options={ENCODER_OPTIONS}
                  value={form.encoders || []}
                  onChange={(v) => setForm({ ...form, encoders: v })}
                />
              </div>

              {/* File Size */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  File Size (MB)
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">
                      Minimum
                    </label>
                    <input
                      type="number"
                      value={form.min_size_mb ?? ""}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          min_size_mb: e.target.value
                            ? Number(e.target.value)
                            : null,
                        })
                      }
                      placeholder="No minimum"
                      className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">
                      Maximum
                    </label>
                    <input
                      type="number"
                      value={form.max_size_mb ?? ""}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          max_size_mb: e.target.value
                            ? Number(e.target.value)
                            : null,
                        })
                      }
                      placeholder="No maximum"
                      className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>
                </div>
              </div>

              {/* Preferred Keywords */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-foreground mb-2">
                  <Tag className="w-4 h-4" />
                  Preferred Keywords
                </label>
                <p className="text-xs text-muted-foreground mb-1.5">
                  Torrents containing these keywords will be prioritized. Press
                  Enter to add.
                </p>
                <TagInput
                  value={form.preferred_keywords || []}
                  onChange={(v) =>
                    setForm({ ...form, preferred_keywords: v })
                  }
                  placeholder="Add keyword..."
                />
              </div>

              {/* Excluded Keywords */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-foreground mb-2">
                  <Ban className="w-4 h-4" />
                  Excluded Keywords
                </label>
                <p className="text-xs text-muted-foreground mb-1.5">
                  Torrents containing these keywords will be skipped. Press
                  Enter to add.
                </p>
                <TagInput
                  value={form.excluded_keywords || []}
                  onChange={(v) =>
                    setForm({ ...form, excluded_keywords: v })
                  }
                  placeholder="Add keyword..."
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-5 border-t border-border">
              <button
                onClick={closeForm}
                className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {editingId ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profiles List */}
      {profiles.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border rounded-xl">
          <SlidersHorizontal className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <h3 className="text-lg font-medium text-foreground mb-1">
            No profiles yet
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Create a profile to define quality constraints for your downloads.
          </p>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Create Profile
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {profiles.map((profile) => (
            <div
              key={profile.id}
              className="bg-card border border-border rounded-xl p-5"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold text-foreground">
                      {profile.name}
                    </h3>
                    {profile.is_default === 1 && (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-primary/15 text-primary">
                        Default
                      </span>
                    )}
                  </div>
                  {profile.description && (
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {profile.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {profile.is_default !== 1 && (
                    <button
                      onClick={() => handleSetDefault(profile.id)}
                      disabled={settingDefaultId === profile.id}
                      className="px-2.5 py-1.5 text-xs bg-secondary text-secondary-foreground rounded-lg hover:opacity-90 disabled:opacity-50"
                      title="Set as default profile"
                    >
                      {settingDefaultId === profile.id ? "Setting..." : "Set Default"}
                    </button>
                  )}
                  <button
                    onClick={() => openEdit(profile)}
                    className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
                    title="Edit profile"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  {deleteConfirm === profile.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDelete(profile.id)}
                        className="px-2 py-1 text-xs bg-destructive text-destructive-foreground rounded"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        className="px-2 py-1 text-xs bg-secondary text-muted-foreground rounded"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirm(profile.id)}
                      className="p-2 text-muted-foreground hover:text-destructive hover:bg-secondary rounded-lg transition-colors"
                      title="Delete profile"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                {parseJsonArray(profile.resolutions).length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <Monitor className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Resolution:</span>
                    <span className="text-foreground">
                      {parseJsonArray(profile.resolutions).join(", ")}
                    </span>
                  </div>
                )}
                {parseJsonArray(profile.qualities).length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <Film className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Quality:</span>
                    <span className="text-foreground">
                      {parseJsonArray(profile.qualities).join(", ")}
                    </span>
                  </div>
                )}
                {parseJsonArray(profile.formats).length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <HardDrive className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Format:</span>
                    <span className="text-foreground">
                      {parseJsonArray(profile.formats).join(", ")}
                    </span>
                  </div>
                )}
                {parseJsonArray(profile.encoders).length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Encoder:</span>
                    <span className="text-foreground">
                      {parseJsonArray(profile.encoders).join(", ")}
                    </span>
                  </div>
                )}
                {(profile.min_size_mb != null ||
                  profile.max_size_mb != null) && (
                  <div className="flex items-center gap-1.5">
                    <HardDrive className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Size:</span>
                    <span className="text-foreground">
                      {profile.min_size_mb != null
                        ? `${profile.min_size_mb} MB`
                        : "any"}{" "}
                      –{" "}
                      {profile.max_size_mb != null
                        ? `${profile.max_size_mb} MB`
                        : "any"}
                    </span>
                  </div>
                )}
              </div>

              {(parseJsonArray(profile.preferred_keywords).length > 0 ||
                parseJsonArray(profile.excluded_keywords).length > 0) && (
                <div className="flex flex-wrap gap-x-6 gap-y-2 mt-2 text-sm">
                  {parseJsonArray(profile.preferred_keywords).length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-green-500" />
                      <span className="text-muted-foreground">Preferred:</span>
                      <span className="text-foreground">
                        {parseJsonArray(profile.preferred_keywords).join(", ")}
                      </span>
                    </div>
                  )}
                  {parseJsonArray(profile.excluded_keywords).length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <Ban className="w-3.5 h-3.5 text-destructive" />
                      <span className="text-muted-foreground">Excluded:</span>
                      <span className="text-foreground">
                        {parseJsonArray(profile.excluded_keywords).join(", ")}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
