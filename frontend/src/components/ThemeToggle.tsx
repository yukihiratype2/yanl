"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type Theme = "light" | "dark" | "system";

const THEME_STORAGE_KEY = "theme";

function getStoredTheme(): Theme | null {
  if (typeof window === "undefined") {
    return null;
  }
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return stored === "light" || stored === "dark" || stored === "system"
    ? stored
    : null;
}

function getSystemTheme(): "light" | "dark" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function resolveTheme(theme: Theme): "light" | "dark" {
  return theme === "system" ? getSystemTheme() : theme;
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  const resolvedTheme = resolveTheme(theme);
  root.classList.toggle("dark", resolvedTheme === "dark");
  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const storedTheme = getStoredTheme();
    const initialTheme = storedTheme ?? "system";
    applyTheme(initialTheme);
    const frame = window.requestAnimationFrame(() => {
      setTheme(initialTheme);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      if (theme === "system") {
        applyTheme("system");
      }
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleChange);
    } else {
      mediaQuery.addListener(handleChange);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener("change", handleChange);
      } else {
        mediaQuery.removeListener(handleChange);
      }
    };
  }, [theme]);

  const handleToggle = () => {
    const nextTheme: Theme =
      theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
    setTheme(nextTheme);
    applyTheme(nextTheme);
  };

  const themeLabel =
    theme === "system" ? "System" : theme === "dark" ? "Dark" : "Light";

  return (
    <Button
      type="button"
      onClick={handleToggle}
      variant="outline"
      size="sm"
      className="w-full justify-between text-xs text-muted-foreground hover:text-foreground"
      aria-label={`Toggle theme (current: ${themeLabel})`}
    >
      <span>Theme</span>
      <span className="flex items-center gap-1.5 text-foreground">
        <span className="text-xs font-semibold">{themeLabel}</span>
        {theme === "dark" ? (
          <Moon className="h-4 w-4" />
        ) : theme === "light" ? (
          <Sun className="h-4 w-4" />
        ) : (
          <Monitor className="h-4 w-4" />
        )}
      </span>
    </Button>
  );
}
