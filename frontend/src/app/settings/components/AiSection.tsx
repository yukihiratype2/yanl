"use client";

import { Brain, Play, Loader2, Check, X } from "lucide-react";
import { Field, Section } from "./Section";

type SettingsMap = Record<string, string>;

type StatusMessage = { ok: boolean; message: string } | null;

type Props = {
  settings: SettingsMap;
  onChange: (key: string, value: string) => void;
  onTest: () => void;
  testing: boolean;
  status: StatusMessage;
};

export default function AiSection({ settings, onChange, onTest, testing, status }: Props) {
  return (
    <Section title="AI Configuration" icon={<Brain className="w-5 h-5" />}>
      <Field label="API URL" sublabel="OpenAI-compatible API endpoint">
        <input
          type="text"
          value={settings.ai_api_url || ""}
          onChange={(e) => onChange("ai_api_url", e.target.value)}
          placeholder="https://api.openai.com/v1"
          className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </Field>
      <Field label="API Token">
        <input
          type="password"
          value={settings.ai_api_token || ""}
          onChange={(e) => onChange("ai_api_token", e.target.value)}
          placeholder="sk-..."
          className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </Field>
      <Field label="Model">
        <input
          type="text"
          value={settings.ai_model || ""}
          onChange={(e) => onChange("ai_model", e.target.value)}
          placeholder="gpt-4o-mini"
          className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </Field>
      <div className="flex flex-col gap-2">
        <button
          onClick={onTest}
          disabled={testing}
          className="flex items-center gap-2 px-3 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm hover:opacity-90 disabled:opacity-50"
        >
          {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          Test AI Configuration
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
      </div>
    </Section>
  );
}
