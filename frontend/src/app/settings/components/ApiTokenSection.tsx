"use client";

import { Settings as SettingsIcon } from "lucide-react";
import { Field, Section } from "./Section";

type Props = {
  token: string;
  onTokenChange: (value: string) => void;
  onTokenSave: () => void;
};

export default function ApiTokenSection({ token, onTokenChange, onTokenSave }: Props) {
  return (
    <Section title="API Token" icon={<SettingsIcon className="w-5 h-5" />}>
      <Field
        label="Token"
        sublabel="Used for frontend-backend authentication (Optional for local network)."
      >
        <div className="flex gap-2">
          <input
            type="text"
            value={token}
            onChange={(e) => onTokenChange(e.target.value)}
            className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            onClick={onTokenSave}
            className="px-3 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm hover:opacity-90"
          >
            Update
          </button>
        </div>
      </Field>
    </Section>
  );
}
