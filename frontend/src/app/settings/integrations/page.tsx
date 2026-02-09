"use client";

import { Loader2 } from "lucide-react";
import AiSection from "../components/AiSection";
import NotifactionSection from "../components/NotifactionSection";
import QbitSection from "../components/QbitSection";
import SettingsAuthCard from "../components/SettingsAuthCard";
import SettingsShell from "../components/SettingsShell";
import TmdbSection from "../components/TmdbSection";
import { useSharedSettingsForm } from "../hooks/SettingsFormContext";

export default function SettingsIntegrationsPage() {
  const {
    settings,
    token,
    loading,
    needsAuth,
    saving,
    testingQbit,
    qbitStatus,
    testingAI,
    aiStatus,
    saveMessage,
    error,
    pathMapRows,
    pathMapErrors,
    hasPathMapValidationError,
    notifactions,
    setTokenState,
    handleChange,
    handlePathMapChange,
    handleAddPathMap,
    handleRemovePathMap,
    updateNotifactions,
    handleSave,
    handleTestQbit,
    handleTestAI,
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
      activeRoute="integrations"
      saving={saving}
      saveDisabled={hasPathMapValidationError}
      error={error}
      saveMessage={saveMessage}
      onSave={handleSave}
    >
      <QbitSection
        settings={settings}
        onChange={handleChange}
        pathMapRows={pathMapRows}
        pathMapErrors={pathMapErrors}
        onPathMapChange={handlePathMapChange}
        onAddPathMap={handleAddPathMap}
        onRemovePathMap={handleRemovePathMap}
        onTestConnection={handleTestQbit}
        testing={testingQbit}
        status={qbitStatus}
      />
      <TmdbSection settings={settings} onChange={handleChange} />
      <AiSection
        settings={settings}
        onChange={handleChange}
        onTest={handleTestAI}
        testing={testingAI}
        status={aiStatus}
      />
      <NotifactionSection notifactions={notifactions} onChange={updateNotifactions} />
    </SettingsShell>
  );
}
