"use client";

import type { ReactNode } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";

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
    <Card className="py-0">
      <CardHeader className="gap-0 border-b py-4">
        <CardTitle className="flex items-center gap-2 text-base">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 py-5">{children}</CardContent>
    </Card>
  );
}

export function Field({ label, sublabel, children }: FieldProps) {
  return (
    <div>
      <Label className="mb-1">{label}</Label>
      {sublabel && <p className="text-xs text-muted-foreground mb-2">{sublabel}</p>}
      {children}
    </div>
  );
}
