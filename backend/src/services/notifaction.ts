import {
  loadConfig,
  type NotifactionConfig,
  type NotifactionEventType,
} from "../config";
import {
  reportIntegrationFailure,
  reportIntegrationSuccess,
} from "./integration-health";
import { logger } from "./logger";

const DELIVERY_TIMEOUT_MS = 10_000;

export interface NotifactionEventPayload {
  type: NotifactionEventType;
  occurred_at?: string;
  subscription: {
    id: number;
    title: string;
    media_type: string;
    source: string;
    source_id: number;
    season_number: number | null;
  };
  data?: Record<string, unknown>;
}

type DeliveredNotifactionEvent = {
  type: NotifactionEventType;
  occurred_at: string;
  subscription: NotifactionEventPayload["subscription"];
  data: Record<string, unknown>;
};

function withDefaults(event: NotifactionEventPayload): DeliveredNotifactionEvent {
  return {
    type: event.type,
    occurred_at: event.occurred_at || new Date().toISOString(),
    subscription: event.subscription,
    data: event.data || {},
  };
}

async function fetchWithTimeout(
  url: string,
  init: Omit<RequestInit, "signal">,
  timeoutMs: number = DELIVERY_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function toTextValue(value: unknown): string {
  if (value == null) return "";
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function toTelegramMessage(event: DeliveredNotifactionEvent): string {
  const lines = [
    "NAS Tools Notifaction",
    `Event: ${event.type}`,
    `Title: ${event.subscription.title}`,
    `Media Type: ${event.subscription.media_type}`,
    `Occurred At: ${event.occurred_at}`,
  ];
  for (const [key, value] of Object.entries(event.data)) {
    const text = toTextValue(value);
    if (!text) continue;
    lines.push(`${key}: ${text}`);
  }
  return lines.join("\n");
}

async function sendWebhookNotifaction(
  notifaction: Extract<NotifactionConfig, { provider: "webhook" }>,
  event: DeliveredNotifactionEvent
): Promise<void> {
  const url = notifaction.config.url.trim();
  if (!url) {
    throw new Error("Webhook URL is empty");
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...notifaction.config.headers,
  };

  const response = await fetchWithTimeout(url, {
    method: "POST",
    headers,
    body: JSON.stringify(event),
  });

  if (!response.ok) {
    throw new Error(`Webhook request failed: HTTP ${response.status}`);
  }
}

async function sendTelegramNotifaction(
  notifaction: Extract<NotifactionConfig, { provider: "telegram" }>,
  event: DeliveredNotifactionEvent
): Promise<void> {
  const botToken = notifaction.config.bot_token.trim();
  const chatId = notifaction.config.chat_id.trim();
  if (!botToken || !chatId) {
    throw new Error("Telegram bot token or chat id is empty");
  }

  const response = await fetchWithTimeout(
    `https://api.telegram.org/bot${botToken}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        chat_id: chatId,
        text: toTelegramMessage(event),
      }).toString(),
    }
  );

  const result = await response
    .json()
    .catch(() => null) as { ok?: boolean; description?: string } | null;
  if (!response.ok || result?.ok === false) {
    throw new Error(
      `Telegram request failed: HTTP ${response.status}${
        result?.description ? ` (${result.description})` : ""
      }`
    );
  }
}

async function dispatchNotifaction(
  notifaction: NotifactionConfig,
  event: DeliveredNotifactionEvent
): Promise<void> {
  if (notifaction.provider === "telegram") {
    return sendTelegramNotifaction(notifaction, event);
  }
  return sendWebhookNotifaction(notifaction, event);
}

export function emitNotifactionEvent(event: NotifactionEventPayload): void {
  const deliveredEvent = withDefaults(event);
  const notifactions = loadConfig().notifactions.filter(
    (notifaction) =>
      notifaction.enabled && notifaction.events.includes(deliveredEvent.type)
  );
  if (notifactions.length === 0) return;

  void (async () => {
    const results = await Promise.allSettled(
      notifactions.map((notifaction) =>
        dispatchNotifaction(notifaction, deliveredEvent)
      )
    );

    const failed = results.filter((result) => result.status === "rejected");
    if (failed.length > 0) {
      const reasons = failed
        .slice(0, 2)
        .map((result) =>
          result.status === "rejected"
            ? (result.reason instanceof Error ? result.reason.message : String(result.reason))
            : ""
        )
        .filter(Boolean);
      reportIntegrationFailure(
        "notifaction",
        reasons.join("; "),
        `Notification delivery failed (${failed.length}/${results.length})`
      );
    } else {
      reportIntegrationSuccess(
        "notifaction",
        `Last notification delivery succeeded (${results.length}/${results.length})`
      );
    }

    for (const [index, result] of results.entries()) {
      const notifaction = notifactions[index];
      if (!notifaction) continue;
      if (result.status === "fulfilled") {
        logger.info(
          {
            notifactionId: notifaction.id,
            notifactionName: notifaction.name,
            event: deliveredEvent.type,
          },
          "Notifaction delivered"
        );
      } else {
        logger.warn(
          {
            notifactionId: notifaction.id,
            notifactionName: notifaction.name,
            event: deliveredEvent.type,
            err: result.reason,
          },
          "Notifaction delivery failed"
        );
      }
    }
  })();
}
