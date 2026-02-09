"use client";

import {
  Download,
  TestTube,
  Loader2,
  Check,
  X,
} from "lucide-react";
import PathPicker from "@/components/PathPicker";
import { Field, Section } from "./Section";

type SettingsMap = Record<string, string>;

type PathMapRow = {
  from: string;
  to: string;
};

type StatusMessage = { ok: boolean; message: string } | null;

type Props = {
  settings: SettingsMap;
  onChange: (key: string, value: string) => void;
  pathMapRows: PathMapRow[];
  onPathMapChange: (index: number, field: "from" | "to", value: string) => void;
  onAddPathMap: () => void;
  onRemovePathMap: (index: number) => void;
  onTestConnection: () => void;
  testing: boolean;
  status: StatusMessage;
};

export default function QbitSection({
  settings,
  onChange,
  pathMapRows,
  onPathMapChange,
  onAddPathMap,
  onRemovePathMap,
  onTestConnection,
  testing,
  status,
}: Props) {
  return (
    <Section title="Download Client (qBittorrent)" icon={<Download className="w-5 h-5" />}>
      <Field label="URL">
        <input
          type="text"
          value={settings.qbit_url || ""}
          onChange={(e) => onChange("qbit_url", e.target.value)}
          placeholder="http://localhost:8080"
          className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Username">
          <input
            type="text"
            value={settings.qbit_username || ""}
            onChange={(e) => onChange("qbit_username", e.target.value)}
            placeholder="admin"
            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </Field>
        <Field label="Password">
          <input
            type="password"
            value={settings.qbit_password || ""}
            onChange={(e) => onChange("qbit_password", e.target.value)}
            placeholder="••••••••"
            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </Field>
      </div>
      <Field label="Tag" sublabel="Applied to every new torrent added by NAS Tools.">
        <input
          type="text"
          value={settings.qbit_tag || ""}
          onChange={(e) => onChange("qbit_tag", e.target.value)}
          placeholder="nas-tools"
          className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </Field>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label="Anime Download Dir" sublabel="qBittorrent save path for anime.">
          <PathPicker
            value={settings.qbit_download_dir_anime || ""}
            onChange={(value) => onChange("qbit_download_dir_anime", value)}
            placeholder="/downloads/anime"
          />
        </Field>
        <Field label="TV Download Dir" sublabel="qBittorrent save path for TV.">
          <PathPicker
            value={settings.qbit_download_dir_tv || ""}
            onChange={(value) => onChange("qbit_download_dir_tv", value)}
            placeholder="/downloads/tv"
          />
        </Field>
        <Field label="Movie Download Dir" sublabel="qBittorrent save path for movies.">
          <PathPicker
            value={settings.qbit_download_dir_movie || ""}
            onChange={(value) => onChange("qbit_download_dir_movie", value)}
            placeholder="/downloads/movies"
          />
        </Field>
      </div>
      <Field
        label="Folder Map (qBittorrent -> NAS Tools)"
        sublabel="Map qBittorrent paths to NAS Tools paths when scanning completed downloads."
      >
        <div className="space-y-3">
          {pathMapRows.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No path mappings yet. Add one if qBittorrent and NAS Tools use different mount
              points.
            </p>
          ) : (
            <div className="space-y-2">
              {pathMapRows.map((row, index) => (
                <div
                  key={`${row.from}-${row.to}-${index}`}
                  className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2"
                >
                  <input
                    type="text"
                    value={row.from}
                    onChange={(e) => onPathMapChange(index, "from", e.target.value)}
                    placeholder="/mnt/Media"
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <input
                    type="text"
                    value={row.to}
                    onChange={(e) => onPathMapChange(index, "to", e.target.value)}
                    placeholder="/media/Media"
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <button
                    onClick={() => onRemovePathMap(index)}
                    className="px-3 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm hover:opacity-90"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
          <button
            onClick={onAddPathMap}
            className="px-3 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm hover:opacity-90"
          >
            Add Mapping
          </button>
        </div>
      </Field>
      <button
        onClick={onTestConnection}
        disabled={testing}
        className="flex items-center gap-2 px-3 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm hover:opacity-90 disabled:opacity-50"
      >
        {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <TestTube className="w-4 h-4" />}
        Test Connection
      </button>
      {status && (
        <div
          className={`flex items-center gap-2 text-sm ${
            status.ok ? "text-success" : "text-destructive"
          }`}
        >
          {status.ok ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
          {status.message}
        </div>
      )}
    </Section>
  );
}
