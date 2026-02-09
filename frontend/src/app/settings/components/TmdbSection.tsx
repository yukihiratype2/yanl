"use client";

import { Film } from "lucide-react";
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
        <input
          type="password"
          value={settings.tmdb_token || ""}
          onChange={(e) => onChange("tmdb_token", e.target.value)}
          placeholder="eyJhbGciOiJIUzI1NiJ9..."
          className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </Field>
    </Section>
  );
}
