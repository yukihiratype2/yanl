"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type SelectOption = {
  value: string;
  label: string;
  description?: string;
};

type Props = {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  showDescription?: boolean;
  className?: string;
};

export default function StyledSelect({
  value,
  options,
  onChange,
  disabled = false,
  showDescription = true,
  className = "",
}: Props) {
  const selectedOption = options.find((option) => option.value === value) || null;

  return (
    <div className="space-y-2">
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className={`w-full ${className}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {showDescription && selectedOption?.description && (
        <p className="text-xs text-muted-foreground">{selectedOption.description}</p>
      )}
    </div>
  );
}
