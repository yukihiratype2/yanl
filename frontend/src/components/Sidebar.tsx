"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Tv,
  BookMarked,
  CalendarDays,
  Settings,
  Clapperboard,
  SlidersHorizontal,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

const navItems = [
  { href: "/", label: "Media List", icon: Tv },
  { href: "/subscriptions", label: "Subscriptions", icon: BookMarked },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/profiles", label: "Profiles", icon: SlidersHorizontal },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 bg-card border-r border-border flex flex-col shrink-0">
      <div className="p-4 border-b border-border">
        <Link href="/" className="flex items-center gap-2">
          <Clapperboard className="w-7 h-7 text-primary" />
          <span className="text-lg font-bold text-foreground">NAS Tools</span>
        </Link>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-border space-y-3">
        <ThemeToggle />
        <div className="text-xs text-muted-foreground">NAS Tools v1.0</div>
      </div>
    </aside>
  );
}
