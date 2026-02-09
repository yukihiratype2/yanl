"use client";

import type { ReactNode } from "react";

type SectionProps = {
  title: string;
  icon: ReactNode;
  children: ReactNode;
};

type FieldProps = {
  label: string;
  sublabel?: string;
  children: ReactNode;
};

export function Section({ title, icon, children }: SectionProps) {
  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
        {icon}
        {title}
      </h2>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

export function Field({ label, sublabel, children }: FieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      {sublabel && <p className="text-xs text-muted-foreground mb-2">{sublabel}</p>}
      {children}
    </div>
  );
}
