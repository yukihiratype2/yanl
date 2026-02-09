"use client";

import type { ReactNode } from "react";
import { createContext, useContext } from "react";
import { useSettingsForm } from "./useSettingsForm";

type SettingsFormState = ReturnType<typeof useSettingsForm>;

const SettingsFormContext = createContext<SettingsFormState | null>(null);

export function SettingsFormProvider({ children }: { children: ReactNode }) {
  const value = useSettingsForm();
  return (
    <SettingsFormContext.Provider value={value}>
      {children}
    </SettingsFormContext.Provider>
  );
}

export function useSharedSettingsForm(): SettingsFormState {
  const context = useContext(SettingsFormContext);
  if (!context) {
    throw new Error("useSharedSettingsForm must be used within SettingsFormProvider");
  }
  return context;
}
