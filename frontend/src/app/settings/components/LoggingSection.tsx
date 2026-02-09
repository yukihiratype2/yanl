"use client";

import { AlertCircle } from "lucide-react";
import PathPicker from "@/components/PathPicker";
import { Field, Section } from "./Section";
import StyledSelect from "./StyledSelect";

type SettingsMap = Record<string, string>;

type Props = {
  settings: SettingsMap;
  onChange: (key: string, value: string) => void;
};

export default function LoggingSection({ settings, onChange }: Props) {
  const logLevel = settings.log_level || "warn";

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
        <StyledSelect
          value={logLevel}
          onChange={(value) => onChange("log_level", value)}
          options={[
            {
              value: "trace",
              label: "trace",
              description: "Most verbose. Includes detailed diagnostics and request internals.",
            },
            {
              value: "debug",
              label: "debug",
              description: "Useful for troubleshooting behavior without full trace noise.",
            },
            {
              value: "info",
              label: "info",
              description: "Operational milestones and normal service activity.",
            },
            {
              value: "warn",
              label: "warn",
              description: "Potential issues worth attention (recommended default).",
            },
            {
              value: "error",
              label: "error",
              description: "Only failures that impact functionality.",
            },
            {
              value: "fatal",
              label: "fatal",
              description: "Critical failures right before shutdown or crash conditions.",
            },
          ]}
        />
      </Field>
    </Section>
  );
}
