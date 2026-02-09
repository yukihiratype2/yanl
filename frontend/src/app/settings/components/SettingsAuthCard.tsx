"use client";

import { Settings as SettingsIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  token: string;
  onTokenChange: (value: string) => void;
  onTokenSave: () => void;
};

export default function SettingsAuthCard({ token, onTokenChange, onTokenSave }: Props) {
  return (
    <div className="max-w-md mx-auto mt-20">
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <SettingsIcon className="w-6 h-6" /> Setup
      </h1>
      <div className="bg-card rounded-xl p-6 border border-border">
        <label className="block text-sm font-medium mb-2">API Token</label>
        <p className="text-xs text-muted-foreground mb-4">
          An API token is required for remote access. Local network access does not require a token.
        </p>
        <Input
          type="text"
          value={token}
          onChange={(e) => onTokenChange(e.target.value)}
          placeholder="Your API token"
        />
        <Button
          onClick={onTokenSave}
          className="mt-4 w-full"
        >
          Connect
        </Button>
      </div>
    </div>
  );
}
