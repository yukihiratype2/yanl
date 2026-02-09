"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

export type SettingsRouteKey = "general" | "integrations";

type Props = {
  activeRoute: SettingsRouteKey;
};

const ROUTES: Array<{ key: SettingsRouteKey; href: string; label: string }> = [
  { key: "general", href: "/settings", label: "General" },
  { key: "integrations", href: "/settings/integrations", label: "Integrations" },
];

export default function SettingsRouteNav({ activeRoute }: Props) {
  return (
    <div className="mb-6 inline-flex rounded-lg border border-border bg-card p-1">
      {ROUTES.map((route) => (
        <Link
          key={route.href}
          href={route.href}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            activeRoute === route.key
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {route.label}
        </Link>
      ))}
    </div>
  );
}
