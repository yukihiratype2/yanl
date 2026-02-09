import type { ReactNode } from "react";
import { SettingsFormProvider } from "./hooks/SettingsFormContext";

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return <SettingsFormProvider>{children}</SettingsFormProvider>;
}
