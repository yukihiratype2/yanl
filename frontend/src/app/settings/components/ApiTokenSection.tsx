"use client";

import { Settings as SettingsIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
          <Input
            type="text"
            value={token}
            onChange={(e) => onTokenChange(e.target.value)}
            className="flex-1"
          />
          <Button
            onClick={onTokenSave}
            variant="secondary"
            size="sm"
          >
            Update
          </Button>
        </div>
      </Field>
    </Section>
  );
}
