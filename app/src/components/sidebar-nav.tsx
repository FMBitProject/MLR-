"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileStack,
  BookCheck,
  ScrollText,
  Settings,
} from "lucide-react";
import clsx from "clsx";

const ICONS = {
  dashboard: LayoutDashboard,
  submissions: FileStack,
  claims: BookCheck,
  audit: ScrollText,
  settings: Settings,
} as const;

export type NavItem = {
  key: keyof typeof ICONS;
  href: string;
  label: string;
  badge?: number;
};

export function SidebarNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        const Icon = ICONS[item.key];
        const active =
          pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            className={clsx(
              "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition",
              active
                ? "bg-white/10 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.08)]"
                : "text-slate-400 hover:bg-white/5 hover:text-slate-100",
            )}
          >
            <Icon
              className={clsx(
                "size-[18px] transition",
                active ? "text-brand-300" : "text-slate-500 group-hover:text-slate-300",
              )}
            />
            <span className="flex-1">{item.label}</span>
            {item.badge ? (
              <span className="rounded-full bg-brand-500/20 px-2 py-0.5 text-[11px] font-semibold text-brand-300 ring-1 ring-inset ring-brand-400/30">
                {item.badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
