"use client";

import { useEffect, useRef, useState } from "react";
import { FolderOpen, Loader2, X } from "lucide-react";
import { listDirectories, type DirEntry } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getErrorMessage, isAbortError } from "@/lib/errors";

export type PathPickerProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
};

export default function PathPicker({
  value,
  onChange,
  placeholder,
  disabled,
}: PathPickerProps) {
  const [open, setOpen] = useState(false);
  const [dirs, setDirs] = useState<DirEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!open) return;

    const path = value.trim();
    if (!path) {
      setDirs([]);
      setError(null);
      setLoading(false);
      return;
    }

    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
    }
    abortRef.current?.abort();

    debounceRef.current = window.setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      setError(null);
      try {
        const data = await listDirectories(path, controller.signal);
        setDirs(data.dirs);
      } catch (err: unknown) {
        if (!isAbortError(err)) {
          setDirs([]);
          setError(getErrorMessage(err, "Failed to load directories"));
        }
      } finally {
        setLoading(false);
      }
    }, 150);

    return () => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
      }
      abortRef.current?.abort();
    };
  }, [value, open]);

  function handlePick(nextPath: string) {
    onChange(nextPath);
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <Input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          placeholder={placeholder}
          disabled={disabled}
          className="bg-background"
        />
        {value && !disabled && (
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={() => onChange("")}
            title="Clear"
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-md border bg-popover shadow-md">
          <div className="flex items-center justify-between border-b px-3 py-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <FolderOpen className="w-3 h-3" />
              Directories
            </span>
            {loading && <Loader2 className="w-3 h-3 animate-spin" />}
          </div>

          {error && (
            <div className="px-3 py-2 text-xs text-destructive">{error}</div>
          )}

          {!error && !loading && dirs.length === 0 && value.trim() && (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              No subdirectories found.
            </div>
          )}

          <div className="max-h-56 overflow-auto">
            {dirs.map((dir) => (
              <Button
                key={dir.path}
                type="button"
                variant="ghost"
                size="sm"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handlePick(dir.path)}
                className="h-auto w-full justify-start rounded-none px-3 py-2 text-left text-sm"
                title={dir.path}
              >
                {dir.name}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
