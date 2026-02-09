"use client";

import { useEffect, useRef, useState } from "react";
import { FolderOpen, Loader2, X } from "lucide-react";
import { listDirectories, type DirEntry } from "@/lib/api";

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
      } catch (err: any) {
        if (err?.name !== "AbortError") {
          setDirs([]);
          setError(err?.message || "Failed to load directories");
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
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60"
        />
        {value && !disabled && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground transition-colors"
            title="Clear"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-2 border border-border rounded-lg bg-background shadow-lg z-20">
          <div className="flex items-center justify-between px-3 py-2 text-xs text-muted-foreground border-b border-border">
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
              <button
                key={dir.path}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handlePick(dir.path)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                title={dir.path}
              >
                {dir.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
