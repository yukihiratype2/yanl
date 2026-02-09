"use client";

import { useState, useEffect, useCallback } from "react";
import { Settings as SettingsIcon, Save, Loader2 } from "lucide-react";
import {
  getSettings,
  updateSettings,
  testQbitConnection,
  testAIConfig,
  getStoredToken,
  setToken,
  getMonitorJobs,
  runMonitorJob,
  type JobStatus,
} from "@/lib/api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getErrorMessage } from "@/lib/errors";
import ApiTokenSection from "./components/ApiTokenSection";
import AiSection from "./components/AiSection";
import EjectTitleSection from "./components/EjectTitleSection";
import JobsSection from "./components/JobsSection";
import LoggingSection from "./components/LoggingSection";
import MediaDirectoriesSection from "./components/MediaDirectoriesSection";
import NotifactionSection, {
  type Notifaction,
  type NotifactionEventType,
} from "./components/NotifactionSection";
import QbitSection from "./components/QbitSection";
import TmdbSection from "./components/TmdbSection";

type PathMapRow = {
  from: string;
  to: string;
};

const NOTIFACTION_EVENT_TYPES: NotifactionEventType[] = [
  "media_released",
  "download_completed",
  "media_moved",
];

function generateNotifactionId(): string {
  return `notifaction-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeNotifactionEvents(value: unknown): NotifactionEventType[] {
  if (!Array.isArray(value)) return [...NOTIFACTION_EVENT_TYPES];
  const events = value
    .filter((entry): entry is NotifactionEventType =>
      NOTIFACTION_EVENT_TYPES.includes(entry as NotifactionEventType)
    )
    .filter((entry, index, arr) => arr.indexOf(entry) === index);
  return events.length > 0 ? events : [...NOTIFACTION_EVENT_TYPES];
}

function normalizeNotifaction(value: unknown): Notifaction | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  const id = typeof item.id === "string" && item.id.trim() ? item.id.trim() : generateNotifactionId();
  const name =
    typeof item.name === "string" && item.name.trim()
      ? item.name.trim()
      : `Notifaction ${id.slice(-4)}`;
  const enabled = item.enabled !== false;
  const events = normalizeNotifactionEvents(item.events);
  const provider = item.provider === "telegram" ? "telegram" : "webhook";
  const config =
    item.config && typeof item.config === "object" && !Array.isArray(item.config)
      ? (item.config as Record<string, unknown>)
      : {};

  if (provider === "telegram") {
    return {
      id,
      name,
      enabled,
      provider: "telegram",
      events,
      config: {
        bot_token:
          typeof config.bot_token === "string" ? config.bot_token.trim() : "",
        chat_id: typeof config.chat_id === "string" ? config.chat_id.trim() : "",
      },
    };
  }

  const headers: Array<{ key: string; value: string }> = [];
  if (Array.isArray(config.headers)) {
    for (const header of config.headers) {
      if (!header || typeof header !== "object" || Array.isArray(header)) continue;
      const row = header as Record<string, unknown>;
      headers.push({
        key: typeof row.key === "string" ? row.key.trim() : "",
        value: typeof row.value === "string" ? row.value.trim() : "",
      });
    }
  } else if (
    config.headers &&
    typeof config.headers === "object" &&
    !Array.isArray(config.headers)
  ) {
    for (const [headerKey, headerValue] of Object.entries(config.headers)) {
      if (typeof headerValue !== "string") continue;
      headers.push({ key: headerKey.trim(), value: headerValue.trim() });
    }
  }

  return {
    id,
    name,
    enabled,
    provider: "webhook",
    events,
    config: {
      url: typeof config.url === "string" ? config.url.trim() : "",
      headers: headers.filter((entry) => entry.key || entry.value),
    },
  };
}

function parseNotifactions(raw?: string): Notifaction[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => normalizeNotifaction(entry))
      .filter((entry): entry is Notifaction => entry !== null);
  } catch {
    return [];
  }
}

function serializeNotifactions(notifactions: Notifaction[]): string {
  const cleaned = notifactions.map((notifaction) => {
    const normalized = normalizeNotifaction(notifaction);
    if (!normalized) return null;
    if (normalized.provider === "telegram") {
      return normalized;
    }
    const headers = normalized.config.headers
      .map((entry) => ({
        key: entry.key.trim(),
        value: entry.value.trim(),
      }))
      .filter((entry) => entry.key && entry.value)
      .reduce<Record<string, string>>((acc, entry) => {
        acc[entry.key] = entry.value;
        return acc;
      }, {});
    return {
      ...normalized,
      config: {
        url: normalized.config.url.trim(),
        headers,
      },
    };
  });
  return JSON.stringify(cleaned.filter((entry) => entry !== null));
}

function parseEjectRules(raw?: string): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry) => typeof entry === "string");
  } catch {
    return [];
  }
}

function parsePathMap(raw?: string): PathMapRow[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => ({
        from: typeof entry?.from === "string" ? entry.from : "",
        to: typeof entry?.to === "string" ? entry.to : "",
      }))
      .filter((entry) => entry.from || entry.to);
  } catch {
    return [];
  }
}

function serializePathMap(rows: PathMapRow[]): string {
  const cleaned = rows
    .map((row) => ({
      from: row.from.trim(),
      to: row.to.trim(),
    }))
    .filter((row) => row.from && row.to);
  return JSON.stringify(cleaned);
}

export default function SettingsPage() {
  const [settings, setSettingsState] = useState<Record<string, string>>({});
  const [token, setTokenState] = useState("");
  const [loading, setLoading] = useState(true);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testingQbit, setTestingQbit] = useState(false);
  const [qbitStatus, setQbitStatus] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [testingAI, setTestingAI] = useState(false);
  const [aiStatus, setAiStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<JobStatus[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [runningJobs, setRunningJobs] = useState<Set<string>>(new Set());
  const [pathMapRows, setPathMapRows] = useState<PathMapRow[]>([]);
  const [ejectRules, setEjectRules] = useState<string[]>([]);
  const [notifactions, setNotifactions] = useState<Notifaction[]>([]);

  const loadJobs = useCallback(async () => {
    try {
      setJobsLoading(true);
      const data = await getMonitorJobs();
      setJobs(data.jobs);
    } catch {
      // silently fail for jobs section
    } finally {
      setJobsLoading(false);
    }
  }, []);

  useEffect(() => {
    const stored = getStoredToken();
    setTokenState(stored);
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      setLoading(true);
      const s = await getSettings();
      setSettingsState(s);
      setPathMapRows(parsePathMap(s.qbit_path_map));
      setEjectRules(parseEjectRules(s.eject_title_rules));
      setNotifactions(parseNotifactions(s.notifactions));
      setError(null);
      setNeedsAuth(false);
      loadJobs();
    } catch (err: unknown) {
      const message = getErrorMessage(err, "Failed to load settings");
      const normalized = message.toLowerCase();
      if (
        message.includes("401") ||
        normalized.includes("invalid token") ||
        normalized.includes("missing authorization")
      ) {
        setNeedsAuth(true);
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }

  function handleChange(key: string, value: string) {
    setSettingsState((prev) => ({ ...prev, [key]: value }));
  }

  function updatePathMapRows(nextRows: PathMapRow[]) {
    setPathMapRows(nextRows);
    handleChange("qbit_path_map", serializePathMap(nextRows));
  }

  function updateEjectRules(nextRules: string[]) {
    setEjectRules(nextRules);
    const cleaned = nextRules.map((rule) => rule.trim()).filter(Boolean);
    handleChange("eject_title_rules", JSON.stringify(cleaned));
  }

  function updateNotifactions(nextNotifactions: Notifaction[]) {
    setNotifactions(nextNotifactions);
    handleChange("notifactions", serializeNotifactions(nextNotifactions));
  }

  function handlePathMapChange(index: number, field: "from" | "to", value: string) {
    updatePathMapRows(
      pathMapRows.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  }

  function handleAddPathMap() {
    updatePathMapRows([...pathMapRows, { from: "", to: "" }]);
  }

  function handleRemovePathMap(index: number) {
    updatePathMapRows(pathMapRows.filter((_, i) => i !== index));
  }

  function handleAddEjectRule() {
    updateEjectRules([...ejectRules, ""]);
  }

  function handleEjectRuleChange(index: number, value: string) {
    updateEjectRules(ejectRules.map((rule, i) => (i === index ? value : rule)));
  }

  function handleRemoveEjectRule(index: number) {
    updateEjectRules(ejectRules.filter((_, i) => i !== index));
  }

  async function handleSave() {
    try {
      setSaving(true);
      await updateSettings(settings);
      setSaveMessage("Settings saved successfully!");
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to save settings"));
    } finally {
      setSaving(false);
    }
  }

  async function handleTestQbit() {
    try {
      setTestingQbit(true);
      setQbitStatus(null);
      const result = await testQbitConnection();
      setQbitStatus({
        ok: result.ok,
        message: result.ok
          ? `Connected! Version: ${result.version}`
          : `Failed: ${result.error}`,
      });
    } catch (err: unknown) {
      setQbitStatus({ ok: false, message: getErrorMessage(err, "Qbit test failed") });
    } finally {
      setTestingQbit(false);
    }
  }

  async function handleTestAI() {
    try {
      setTestingAI(true);
      setAiStatus(null);
      const result = await testAIConfig();
      setAiStatus({ ok: true, message: result.response || "Received response from AI" });
    } catch (err: unknown) {
      setAiStatus({ ok: false, message: getErrorMessage(err, "AI test failed") });
    } finally {
      setTestingAI(false);
    }
  }

  function handleTokenSave() {
    setToken(token);
    loadSettings();
  }

  async function handleRunJob(name: string) {
    try {
      setRunningJobs((prev) => new Set(prev).add(name));
      await runMonitorJob(name);
      // Poll for updated status after a short delay
      setTimeout(() => loadJobs(), 1000);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to run monitor job"));
    } finally {
      setRunningJobs((prev) => {
        const next = new Set(prev);
        next.delete(name);
        return next;
      });
    }
  }

  if (needsAuth && !loading) {
    return (
      <div className="max-w-md mx-auto mt-20">
        <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <SettingsIcon className="w-6 h-6" /> Setup
        </h1>
        <div className="bg-card rounded-xl p-6 border border-border">
          <label className="block text-sm font-medium mb-2">API Token</label>
          <p className="text-xs text-muted-foreground mb-4">
            An API token is required for remote access. Local network access does not require a token.
          </p>
          <Input
            type="text"
            value={token}
            onChange={(e) => setTokenState(e.target.value)}
            placeholder="Your API token"
          />
          <Button
            onClick={handleTokenSave}
            className="mt-4 w-full"
          >
            Connect
          </Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <SettingsIcon className="w-6 h-6" /> Settings
        </h1>
        <Button
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Save Settings
        </Button>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {saveMessage && (
        <Alert className="mb-4 border-success/40 bg-success/10 text-success [&>svg]:text-success">
          <AlertDescription>{saveMessage}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-6">
        <ApiTokenSection
          token={token}
          onTokenChange={setTokenState}
          onTokenSave={handleTokenSave}
        />
        <QbitSection
          settings={settings}
          onChange={handleChange}
          pathMapRows={pathMapRows}
          onPathMapChange={handlePathMapChange}
          onAddPathMap={handleAddPathMap}
          onRemovePathMap={handleRemovePathMap}
          onTestConnection={handleTestQbit}
          testing={testingQbit}
          status={qbitStatus}
        />
        <TmdbSection settings={settings} onChange={handleChange} />
        <AiSection
          settings={settings}
          onChange={handleChange}
          onTest={handleTestAI}
          testing={testingAI}
          status={aiStatus}
        />
        <EjectTitleSection
          rules={ejectRules}
          onAdd={handleAddEjectRule}
          onChange={handleEjectRuleChange}
          onRemove={handleRemoveEjectRule}
        />
        <MediaDirectoriesSection settings={settings} onChange={handleChange} />
        <LoggingSection settings={settings} onChange={handleChange} />
        <NotifactionSection notifactions={notifactions} onChange={updateNotifactions} />
        <JobsSection
          jobs={jobs}
          loading={jobsLoading}
          onRefresh={loadJobs}
          onRunJob={handleRunJob}
          runningJobs={runningJobs}
        />
      </div>
    </div>
  );
}
