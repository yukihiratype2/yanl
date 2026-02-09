"use client";

import { Film } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Field, Section } from "./Section";

type SettingsMap = Record<string, string>;

type Props = {
  settings: SettingsMap;
  onChange: (key: string, value: string) => void;
};

export default function TmdbSection({ settings, onChange }: Props) {
  return (
    <Section title="TMDB" icon={<Film className="w-5 h-5" />}>
      <Field label="API Token (Bearer)" sublabel="Get your token from themoviedb.org">
        <Input
          type="password"
          value={settings.tmdb_token || ""}
          onChange={(e) => onChange("tmdb_token", e.target.value)}
          placeholder="eyJhbGciOiJIUzI1NiJ9..."
        />
      </Field>
    </Section>
  );
}
