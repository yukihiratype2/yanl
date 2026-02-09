"use client";

import { FolderOpen } from "lucide-react";
import PathPicker from "@/components/PathPicker";
import { Field, Section } from "./Section";

type SettingsMap = Record<string, string>;

type Props = {
  settings: SettingsMap;
  onChange: (key: string, value: string) => void;
};

export default function MediaDirectoriesSection({ settings, onChange }: Props) {
  return (
    <Section title="Media Directories" icon={<FolderOpen className="w-5 h-5" />}>
      <Field label="Anime Directory">
        <PathPicker
          value={settings.media_dir_anime || ""}
          onChange={(value) => onChange("media_dir_anime", value)}
          placeholder="/media/anime"
        />
      </Field>
      <Field label="TV Shows Directory">
        <PathPicker
          value={settings.media_dir_tv || ""}
          onChange={(value) => onChange("media_dir_tv", value)}
          placeholder="/media/tv"
        />
      </Field>
      <Field label="Movies Directory">
        <PathPicker
          value={settings.media_dir_movie || ""}
          onChange={(value) => onChange("media_dir_movie", value)}
          placeholder="/media/movies"
        />
      </Field>
    </Section>
  );
}
