"use client";

import type { ReactNode } from "react";
import { Settings as SettingsIcon, Save, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import SettingsRouteNav, { type SettingsRouteKey } from "./SettingsRouteNav";

type Props = {
  activeRoute: SettingsRouteKey;
  saving: boolean;
  saveDisabled?: boolean;
  error: string | null;
  saveMessage: string | null;
  onSave: () => void;
  children: ReactNode;
};

export default function SettingsShell({
  activeRoute,
  saving,
  saveDisabled = false,
  error,
  saveMessage,
  onSave,
  children,
}: Props) {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <SettingsIcon className="w-6 h-6" /> Settings
        </h1>
        <Button
          onClick={onSave}
          disabled={saving || saveDisabled}
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Save Settings
        </Button>
      </div>

      <SettingsRouteNav activeRoute={activeRoute} />

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {saveMessage && (
        <Alert className="mb-4 border-success/40 bg-success/10 text-success [&>svg]:text-success">
          <AlertDescription>{saveMessage}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-6">{children}</div>
    </div>
  );
}
