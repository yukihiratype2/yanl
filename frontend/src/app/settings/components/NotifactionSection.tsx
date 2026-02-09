"use client";

import { Bell, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Field, Section } from "./Section";
import StyledSelect from "./StyledSelect";

export type NotifactionEventType =
  | "media_released"
  | "download_completed"
  | "media_moved";

export type NotifactionProvider = "webhook" | "telegram";

export type NotifactionHeader = {
  key: string;
  value: string;
};

type NotifactionBase = {
  id: string;
  name: string;
  enabled: boolean;
  events: NotifactionEventType[];
};

export type WebhookNotifaction = NotifactionBase & {
  provider: "webhook";
  config: {
    url: string;
    headers: NotifactionHeader[];
  };
};

export type TelegramNotifaction = NotifactionBase & {
  provider: "telegram";
  config: {
    bot_token: string;
    chat_id: string;
  };
};

export type Notifaction = WebhookNotifaction | TelegramNotifaction;

type Props = {
  notifactions: Notifaction[];
  onChange: (next: Notifaction[]) => void;
};

const EVENT_OPTIONS: Array<{ key: NotifactionEventType; label: string }> = [
  { key: "media_released", label: "Media Released" },
  { key: "download_completed", label: "Download Completed" },
  { key: "media_moved", label: "Media Moved" },
];

const DEFAULT_EVENTS: NotifactionEventType[] = EVENT_OPTIONS.map((event) => event.key);

function generateNotifactionId(): string {
  return `notifaction-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function createDefaultNotifaction(): Notifaction {
  return {
    id: generateNotifactionId(),
    name: "New Notifaction",
    enabled: true,
    provider: "webhook",
    events: [...DEFAULT_EVENTS],
    config: {
      url: "",
      headers: [],
    },
  };
}

export default function NotifactionSection({ notifactions, onChange }: Props) {
  function updateAt(index: number, updater: (prev: Notifaction) => Notifaction) {
    onChange(
      notifactions.map((notifaction, currentIndex) =>
        currentIndex === index ? updater(notifaction) : notifaction
      )
    );
  }

  function handleAdd() {
    onChange([...notifactions, createDefaultNotifaction()]);
  }

  function handleRemove(index: number) {
    onChange(notifactions.filter((_, currentIndex) => currentIndex !== index));
  }

  function handleProviderChange(index: number, provider: NotifactionProvider) {
    updateAt(index, (notifaction) => {
      if (provider === notifaction.provider) return notifaction;
      if (provider === "telegram") {
        return {
          ...notifaction,
          provider: "telegram",
          config: {
            bot_token: "",
            chat_id: "",
          },
        };
      }
      return {
        ...notifaction,
        provider: "webhook",
        config: {
          url: "",
          headers: [],
        },
      };
    });
  }

  function toggleEvent(
    notifaction: Notifaction,
    event: NotifactionEventType
  ): NotifactionEventType[] {
    if (notifaction.events.includes(event)) {
      return notifaction.events.filter((entry) => entry !== event);
    }
    return [...notifaction.events, event];
  }

  return (
    <Section title="Notifaction" icon={<Bell className="w-5 h-5" />}>
      <p className="text-xs text-muted-foreground">
        Configure where and when notifactions are sent.
      </p>
      <div className="space-y-4">
        {notifactions.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No notifactions yet. Add one to start sending messages.
          </p>
        ) : (
          notifactions.map((notifaction, index) => (
            <div
              key={notifaction.id}
              className="rounded-lg border border-border bg-background p-4 space-y-4"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">Notifaction {index + 1}</p>
                <Button
                  onClick={() => handleRemove(index)}
                  variant="secondary"
                  size="sm"
                  className="h-7 gap-1 px-2 text-xs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Remove
                </Button>
              </div>

              <Field label="Name">
                <Input
                  type="text"
                  value={notifaction.name}
                  onChange={(e) =>
                    updateAt(index, (prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="My Notifaction"
                />
              </Field>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Provider">
                  <StyledSelect
                    value={notifaction.provider}
                    onChange={(value) =>
                      handleProviderChange(index, value as NotifactionProvider)
                    }
                    options={[
                      {
                        value: "webhook",
                        label: "Webhook",
                        description:
                          "POST JSON payloads to your endpoint, with optional custom headers.",
                      },
                      {
                        value: "telegram",
                        label: "Telegram",
                        description:
                          "Send Bot API messages directly to a configured chat ID.",
                      },
                    ]}
                  />
                </Field>
                <Field label="Enabled">
                  <label className="inline-flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={notifaction.enabled}
                      onCheckedChange={(checked) =>
                        updateAt(index, (prev) => ({ ...prev, enabled: checked === true }))
                      }
                    />
                    Send this notifaction
                  </label>
                </Field>
              </div>

              <Field label="Event Types">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {EVENT_OPTIONS.map((event) => (
                    <label
                      key={event.key}
                      className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"
                    >
                      <Checkbox
                        checked={notifaction.events.includes(event.key)}
                        onCheckedChange={() =>
                          updateAt(index, (prev) => ({
                            ...prev,
                            events: toggleEvent(prev, event.key),
                          }))
                        }
                      />
                      {event.label}
                    </label>
                  ))}
                </div>
              </Field>

              {notifaction.provider === "webhook" ? (
                <div className="space-y-3">
                  <Field label="Webhook URL">
                    <Input
                      type="text"
                      value={notifaction.config.url}
                      onChange={(e) =>
                        updateAt(index, (prev) =>
                          prev.provider === "webhook"
                            ? {
                                ...prev,
                                config: { ...prev.config, url: e.target.value },
                              }
                            : prev
                        )
                      }
                      placeholder="https://example.com/webhook"
                    />
                  </Field>

                  <Field label="Headers" sublabel="Optional request headers.">
                    <div className="space-y-2">
                      {notifaction.config.headers.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          No headers configured.
                        </p>
                      ) : (
                        notifaction.config.headers.map((header, headerIndex) => (
                          <div
                            key={`${notifaction.id}-header-${headerIndex}`}
                            className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2"
                          >
                            <Input
                              type="text"
                              value={header.key}
                              onChange={(e) =>
                                updateAt(index, (prev) =>
                                  prev.provider === "webhook"
                                    ? {
                                        ...prev,
                                        config: {
                                          ...prev.config,
                                          headers: prev.config.headers.map((entry, idx) =>
                                            idx === headerIndex
                                              ? { ...entry, key: e.target.value }
                                              : entry
                                          ),
                                        },
                                      }
                                    : prev
                                )
                              }
                              placeholder="Authorization"
                            />
                            <Input
                              type="text"
                              value={header.value}
                              onChange={(e) =>
                                updateAt(index, (prev) =>
                                  prev.provider === "webhook"
                                    ? {
                                        ...prev,
                                        config: {
                                          ...prev.config,
                                          headers: prev.config.headers.map((entry, idx) =>
                                            idx === headerIndex
                                              ? { ...entry, value: e.target.value }
                                              : entry
                                          ),
                                        },
                                      }
                                    : prev
                                )
                              }
                              placeholder="Bearer token"
                            />
                            <Button
                              onClick={() =>
                                updateAt(index, (prev) =>
                                  prev.provider === "webhook"
                                    ? {
                                        ...prev,
                                        config: {
                                          ...prev.config,
                                          headers: prev.config.headers.filter(
                                            (_, idx) => idx !== headerIndex
                                          ),
                                        },
                                      }
                                    : prev
                                  )
                              }
                              variant="secondary"
                              size="sm"
                            >
                              Remove
                            </Button>
                          </div>
                        ))
                      )}
                      <Button
                        onClick={() =>
                          updateAt(index, (prev) =>
                            prev.provider === "webhook"
                              ? {
                                  ...prev,
                                  config: {
                                    ...prev.config,
                                    headers: [...prev.config.headers, { key: "", value: "" }],
                                  },
                                }
                            : prev
                          )
                        }
                        variant="secondary"
                        size="sm"
                      >
                        Add Header
                      </Button>
                    </div>
                  </Field>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Bot Token">
                    <Input
                      type="password"
                      value={notifaction.config.bot_token}
                      onChange={(e) =>
                        updateAt(index, (prev) =>
                          prev.provider === "telegram"
                            ? {
                                ...prev,
                                config: { ...prev.config, bot_token: e.target.value },
                              }
                            : prev
                        )
                      }
                      placeholder="123456:ABC..."
                    />
                  </Field>
                  <Field label="Chat ID">
                    <Input
                      type="text"
                      value={notifaction.config.chat_id}
                      onChange={(e) =>
                        updateAt(index, (prev) =>
                          prev.provider === "telegram"
                            ? {
                                ...prev,
                                config: { ...prev.config, chat_id: e.target.value },
                              }
                            : prev
                        )
                      }
                      placeholder="-1001234567890"
                    />
                  </Field>
                </div>
              )}
            </div>
          ))
        )}

        <Button
          onClick={handleAdd}
          variant="secondary"
          size="sm"
        >
          <Plus className="w-4 h-4" />
          Add Notifaction
        </Button>
      </div>
    </Section>
  );
}
