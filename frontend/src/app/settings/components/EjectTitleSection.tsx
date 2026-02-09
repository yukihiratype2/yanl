"use client";

import { Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, Section } from "./Section";

type Props = {
  rules: string[];
  onAdd: () => void;
  onChange: (index: number, value: string) => void;
  onRemove: (index: number) => void;
};

export default function EjectTitleSection({ rules, onAdd, onChange, onRemove }: Props) {
  return (
    <Section title="Eject Title" icon={<Filter className="w-5 h-5" />}>
      <Field
        label="Regex Rules"
        sublabel="RSS titles matching any rule are removed before AI parsing. Use JS regex without slashes."
      >
        <div className="space-y-3">
          {rules.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No eject rules yet. Add one to filter out unwanted titles.
            </p>
          ) : (
            <div className="space-y-2">
              {rules.map((rule, index) => (
                <div
                  key={`${rule}-${index}`}
                  className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2"
                >
                  <Input
                    type="text"
                    value={rule}
                    onChange={(e) => onChange(index, e.target.value)}
                    placeholder="720[Pp]"
                  />
                  <Button
                    onClick={() => onRemove(index)}
                    variant="secondary"
                    size="sm"
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          )}
          <Button
            onClick={onAdd}
            variant="secondary"
            size="sm"
          >
            Add Rule
          </Button>
        </div>
      </Field>
    </Section>
  );
}
