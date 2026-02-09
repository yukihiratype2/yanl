"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getSettings,
  updateSettings,
  testQbitConnection,
  testAIConfig,
  getStoredToken,
  setToken as persistToken,
} from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import type {
  Notifaction,
  NotifactionEventType,
} from "../components/NotifactionSection";

type PathMapRow = {
  from: string;
  to: string;
};

type StatusMessage = { ok: boolean; message: string } | null;

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

export function useSettingsForm() {
  const [settings, setSettingsState] = useState<Record<string, string>>({});
  const [token, setTokenState] = useState("");
  const [loading, setLoading] = useState(true);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testingQbit, setTestingQbit] = useState(false);
  const [qbitStatus, setQbitStatus] = useState<StatusMessage>(null);
  const [testingAI, setTestingAI] = useState(false);
  const [aiStatus, setAiStatus] = useState<StatusMessage>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pathMapRows, setPathMapRows] = useState<PathMapRow[]>([]);
  const [ejectRules, setEjectRules] = useState<string[]>([]);
  const [notifactions, setNotifactions] = useState<Notifaction[]>([]);

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      const loaded = await getSettings();
      setSettingsState(loaded);
      setPathMapRows(parsePathMap(loaded.qbit_path_map));
      setEjectRules(parseEjectRules(loaded.eject_title_rules));
      setNotifactions(parseNotifactions(loaded.notifactions));
      setError(null);
      setNeedsAuth(false);
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
  }, []);

  useEffect(() => {
    setTokenState(getStoredToken());
    void loadSettings();
  }, [loadSettings]);

  const handleChange = useCallback((key: string, value: string) => {
    setSettingsState((prev) => ({ ...prev, [key]: value }));
  }, []);

  const updatePathMapRows = useCallback(
    (nextRows: PathMapRow[]) => {
      setPathMapRows(nextRows);
      handleChange("qbit_path_map", serializePathMap(nextRows));
    },
    [handleChange]
  );

  const updateEjectRules = useCallback(
    (nextRules: string[]) => {
      setEjectRules(nextRules);
      const cleaned = nextRules.map((rule) => rule.trim()).filter(Boolean);
      handleChange("eject_title_rules", JSON.stringify(cleaned));
    },
    [handleChange]
  );

  const updateNotifactions = useCallback(
    (nextNotifactions: Notifaction[]) => {
      setNotifactions(nextNotifactions);
      handleChange("notifactions", serializeNotifactions(nextNotifactions));
    },
    [handleChange]
  );

  const handlePathMapChange = useCallback(
    (index: number, field: "from" | "to", value: string) => {
      updatePathMapRows(
        pathMapRows.map((row, i) => (i === index ? { ...row, [field]: value } : row))
      );
    },
    [pathMapRows, updatePathMapRows]
  );

  const handleAddPathMap = useCallback(() => {
    updatePathMapRows([...pathMapRows, { from: "", to: "" }]);
  }, [pathMapRows, updatePathMapRows]);

  const handleRemovePathMap = useCallback(
    (index: number) => {
      updatePathMapRows(pathMapRows.filter((_, i) => i !== index));
    },
    [pathMapRows, updatePathMapRows]
  );

  const handleAddEjectRule = useCallback(() => {
    updateEjectRules([...ejectRules, ""]);
  }, [ejectRules, updateEjectRules]);

  const handleEjectRuleChange = useCallback(
    (index: number, value: string) => {
      updateEjectRules(ejectRules.map((rule, i) => (i === index ? value : rule)));
    },
    [ejectRules, updateEjectRules]
  );

  const handleRemoveEjectRule = useCallback(
    (index: number) => {
      updateEjectRules(ejectRules.filter((_, i) => i !== index));
    },
    [ejectRules, updateEjectRules]
  );

  const handleSave = useCallback(async () => {
    try {
      setSaving(true);
      await updateSettings(settings);
      setError(null);
      setSaveMessage("Settings saved successfully!");
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to save settings"));
    } finally {
      setSaving(false);
    }
  }, [settings]);

  const handleTestQbit = useCallback(async () => {
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
  }, []);

  const handleTestAI = useCallback(async () => {
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
  }, []);

  const handleTokenSave = useCallback(() => {
    persistToken(token);
    void loadSettings();
  }, [loadSettings, token]);

  return {
    settings,
    token,
    loading,
    needsAuth,
    saving,
    testingQbit,
    qbitStatus,
    testingAI,
    aiStatus,
    saveMessage,
    error,
    pathMapRows,
    ejectRules,
    notifactions,
    setTokenState,
    handleChange,
    handlePathMapChange,
    handleAddPathMap,
    handleRemovePathMap,
    handleAddEjectRule,
    handleEjectRuleChange,
    handleRemoveEjectRule,
    updateNotifactions,
    handleSave,
    handleTestQbit,
    handleTestAI,
    handleTokenSave,
  };
}
