"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const items = [
  { href: "/drive", label: "My Drive", icon: "📁" },
  { href: "/recent", label: "Recent", icon: "🕐" },
  { href: "/shared", label: "Shared", icon: "🔗" },
  { href: "/account", label: "Account", icon: "👤" },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950 sm:flex">
      <Link href="/drive" className="mb-6 flex items-center gap-2 text-lg font-bold">
        <span className="inline-block h-6 w-6 rounded-md bg-brand-500" />
        {process.env.NEXT_PUBLIC_APP_NAME || "PersonalDrive"}
      </Link>
      <nav className="flex flex-col gap-1">
        {items.map((it) => {
          const active = pathname === it.href || pathname.startsWith(it.href + "/");
          return (
            <Link
              key={it.href}
              href={it.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                active
                  ? "bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-200"
                  : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
              )}
            >
              <span>{it.icon}</span>
              {it.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
