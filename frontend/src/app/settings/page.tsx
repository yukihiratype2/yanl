"use client";

import { Loader2 } from "lucide-react";
import ApiTokenSection from "./components/ApiTokenSection";
import EjectTitleSection from "./components/EjectTitleSection";
import LoggingSection from "./components/LoggingSection";
import MediaDirectoriesSection from "./components/MediaDirectoriesSection";
import SettingsAuthCard from "./components/SettingsAuthCard";
import SettingsShell from "./components/SettingsShell";
import { useSharedSettingsForm } from "./hooks/SettingsFormContext";

export default function SettingsPage() {
  const {
    settings,
    token,
    loading,
    needsAuth,
    saving,
    saveMessage,
    error,
    ejectRules,
    setTokenState,
    handleChange,
    handleAddEjectRule,
    handleEjectRuleChange,
    handleRemoveEjectRule,
    handleSave,
    handleTokenSave,
  } = useSharedSettingsForm();

  if (needsAuth && !loading) {
    return (
      <SettingsAuthCard
        token={token}
        onTokenChange={setTokenState}
        onTokenSave={handleTokenSave}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <SettingsShell
      activeRoute="general"
      saving={saving}
      error={error}
      saveMessage={saveMessage}
      onSave={handleSave}
    >
      <ApiTokenSection
        token={token}
        onTokenChange={setTokenState}
        onTokenSave={handleTokenSave}
      />
      <MediaDirectoriesSection settings={settings} onChange={handleChange} />
      <EjectTitleSection
        rules={ejectRules}
        onAdd={handleAddEjectRule}
        onChange={handleEjectRuleChange}
        onRemove={handleRemoveEjectRule}
      />
      <LoggingSection settings={settings} onChange={handleChange} />
    </SettingsShell>
  );
}
