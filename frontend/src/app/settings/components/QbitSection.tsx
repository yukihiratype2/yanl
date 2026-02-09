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
import type {
  QbitPathMapSanityCheck,
  QbitPathMapSanityResult,
} from "@/lib/api";
import { Field, Section } from "./Section";

type SettingsMap = Record<string, string>;

type PathMapRow = {
  id: string;
  from: string;
  to: string;
};

type PathMapRowError = {
  row?: string;
  from?: string;
  to?: string;
};

type StatusMessage = { ok: boolean; message: string } | null;

type Props = {
  settings: SettingsMap;
  onChange: (key: string, value: string) => void;
  pathMapRows: PathMapRow[];
  pathMapErrors: Record<string, PathMapRowError>;
  onPathMapChange: (index: number, field: "from" | "to", value: string) => void;
  onAddPathMap: () => void;
  onRemovePathMap: (index: number) => void;
  onTestConnection: () => void;
  testing: boolean;
  status: StatusMessage;
  onTestPathMapSanity: () => void;
  testingPathMapSanity: boolean;
  pathMapSanityStatus: QbitPathMapSanityResult | null;
};

function getPathMapCheckStatusClass(status: QbitPathMapSanityCheck["status"]): string {
  if (status === "pass") return "text-success";
  if (status === "warn") return "text-yellow-600";
  return "text-destructive";
}

function formatPathMapCheckScope(check: QbitPathMapSanityCheck): string {
  if (check.scope === "download_dir") {
    return check.mediaType ? `download_dir:${check.mediaType}` : "download_dir";
  }
  return check.torrentName
    ? `torrent:${check.torrentName}`
    : check.torrentHash
      ? `torrent:${check.torrentHash}`
      : "torrent";
}

export default function QbitSection({
  settings,
  onChange,
  pathMapRows,
  pathMapErrors,
  onPathMapChange,
  onAddPathMap,
  onRemovePathMap,
  onTestConnection,
  testing,
  status,
  onTestPathMapSanity,
  testingPathMapSanity,
  pathMapSanityStatus,
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
                  key={row.id}
                  className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2"
                >
                  <div>
                    <Input
                      type="text"
                      value={row.from}
                      onChange={(e) => onPathMapChange(index, "from", e.target.value)}
                      placeholder="/mnt/Media"
                    />
                    {pathMapErrors[row.id]?.from && (
                      <p className="mt-1 text-xs text-destructive">{pathMapErrors[row.id]?.from}</p>
                    )}
                  </div>
                  <div>
                    <Input
                      type="text"
                      value={row.to}
                      onChange={(e) => onPathMapChange(index, "to", e.target.value)}
                      placeholder="/media/Media"
                    />
                    {pathMapErrors[row.id]?.to && (
                      <p className="mt-1 text-xs text-destructive">{pathMapErrors[row.id]?.to}</p>
                    )}
                  </div>
                  <div>
                    <Button
                      onClick={() => onRemovePathMap(index)}
                      variant="secondary"
                      size="sm"
                    >
                      Remove
                    </Button>
                    {pathMapErrors[row.id]?.row && (
                      <p className="mt-1 text-xs text-destructive">{pathMapErrors[row.id]?.row}</p>
                    )}
                  </div>
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
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={onTestConnection}
          disabled={testing}
          variant="secondary"
          className="w-fit"
        >
          {testing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <TestTube className="w-4 h-4" />
          )}
          Test Connection
        </Button>
        <Button
          onClick={onTestPathMapSanity}
          disabled={testingPathMapSanity}
          variant="secondary"
          className="w-fit"
        >
          {testingPathMapSanity ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Check className="w-4 h-4" />
          )}
          Sanity Check Folder Map
        </Button>
      </div>
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
      {pathMapSanityStatus && (
        <div className="space-y-2 rounded-md border p-3 text-sm">
          <div
            className={
              pathMapSanityStatus.ok
                ? "text-success"
                : pathMapSanityStatus.error
                  ? "text-destructive"
                  : "text-yellow-600"
            }
          >
            {pathMapSanityStatus.message}
            {pathMapSanityStatus.error ? ` ${pathMapSanityStatus.error}` : ""}
          </div>
          <p className="text-xs text-muted-foreground">
            Dirs checked: {pathMapSanityStatus.summary.checkedDirs} | Torrents checked:{" "}
            {pathMapSanityStatus.summary.checkedTorrents} | Pass:{" "}
            {pathMapSanityStatus.summary.passCount} | Warn:{" "}
            {pathMapSanityStatus.summary.warnCount} | Fail:{" "}
            {pathMapSanityStatus.summary.failCount}
          </p>
          {pathMapSanityStatus.checks.length > 0 && (
            <div className="max-h-56 space-y-2 overflow-auto rounded border p-2 text-xs">
              {pathMapSanityStatus.checks.map((check, index) => (
                <div key={`${check.scope}-${check.torrentHash || check.mediaType || index}`}>
                  <div className={getPathMapCheckStatusClass(check.status)}>
                    {check.status.toUpperCase()} {formatPathMapCheckScope(check)} {check.reason}
                  </div>
                  <div className="text-muted-foreground">source: {check.sourcePath || "-"}</div>
                  <div className="text-muted-foreground">mapped: {check.mappedPath || "-"}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Section>
  );
}
