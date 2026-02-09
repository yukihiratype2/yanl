"use client";

import { AlertCircle } from "lucide-react";
import PathPicker from "@/components/PathPicker";
import { Field, Section } from "./Section";

type SettingsMap = Record<string, string>;

type Props = {
  settings: SettingsMap;
  onChange: (key: string, value: string) => void;
};

export default function LoggingSection({ settings, onChange }: Props) {
  return (
    <Section title="Logging" icon={<AlertCircle className="w-5 h-5" />}>
      <Field label="Log Directory" sublabel="Where backend logs are written (backend.log).">
        <PathPicker
          value={settings.log_dir || ""}
          onChange={(value) => onChange("log_dir", value)}
          placeholder="/path/to/log"
        />
      </Field>
      <Field label="Log Level" sublabel="HTTP access logs are emitted at trace level.">
        <select
          value={settings.log_level || "warn"}
          onChange={(e) => onChange("log_level", e.target.value)}
          className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="trace">trace</option>
          <option value="debug">debug</option>
          <option value="info">info</option>
          <option value="warn">warn</option>
          <option value="error">error</option>
          <option value="fatal">fatal</option>
        </select>
      </Field>
    </Section>
  );
}
