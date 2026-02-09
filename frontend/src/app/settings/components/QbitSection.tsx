"use client";

import {
  Download,
  TestTube,
  Loader2,
  Check,
  X,
} from "lucide-react";
import PathPicker from "@/components/PathPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
        <Input
          type="text"
          value={settings.qbit_url || ""}
          onChange={(e) => onChange("qbit_url", e.target.value)}
          placeholder="http://localhost:8080"
        />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Username">
          <Input
            type="text"
            value={settings.qbit_username || ""}
            onChange={(e) => onChange("qbit_username", e.target.value)}
            placeholder="admin"
          />
        </Field>
        <Field label="Password">
          <Input
            type="password"
            value={settings.qbit_password || ""}
            onChange={(e) => onChange("qbit_password", e.target.value)}
            placeholder="••••••••"
          />
        </Field>
      </div>
      <Field label="Tag" sublabel="Applied to every new torrent added by NAS Tools.">
        <Input
          type="text"
          value={settings.qbit_tag || ""}
          onChange={(e) => onChange("qbit_tag", e.target.value)}
          placeholder="nas-tools"
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
                  <Input
                    type="text"
                    value={row.from}
                    onChange={(e) => onPathMapChange(index, "from", e.target.value)}
                    placeholder="/mnt/Media"
                  />
                  <Input
                    type="text"
                    value={row.to}
                    onChange={(e) => onPathMapChange(index, "to", e.target.value)}
                    placeholder="/media/Media"
                  />
                  <Button
                    onClick={() => onRemovePathMap(index)}
                    variant="secondary"
                    size="sm"
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          )}
          <Button
            onClick={onAddPathMap}
            variant="secondary"
            size="sm"
          >
            Add Mapping
          </Button>
        </div>
      </Field>
      <Button
        onClick={onTestConnection}
        disabled={testing}
        variant="secondary"
        className="w-fit"
      >
        {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <TestTube className="w-4 h-4" />}
        Test Connection
      </Button>
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
