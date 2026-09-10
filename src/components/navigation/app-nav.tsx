"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BriefcaseBusiness, Home, Newspaper, Settings, Utensils } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: "Home", icon: Home },
  { href: "/nutrition", label: "Nutrition", icon: Utensils },
  { href: "/spending", label: "Spending", icon: BriefcaseBusiness },
  { href: "/briefing", label: "Briefing", icon: Newspaper },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppNav({ variant }: { variant: "desktop" | "mobile" }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary navigation" className={cn(variant === "desktop" ? "hidden rounded-full border border-white/80 bg-white/75 p-1.5 shadow-lg shadow-slate-900/5 backdrop-blur-xl md:flex" : "fixed inset-x-3 bottom-3 z-50 flex justify-around rounded-3xl border border-white/80 bg-white/90 p-2 shadow-2xl shadow-slate-900/15 backdrop-blur-xl md:hidden")}>
      {items.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link key={href} href={href} aria-current={active ? "page" : undefined} className={cn("flex items-center justify-center gap-2 rounded-full font-semibold transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary", variant === "desktop" ? "px-4 py-2.5 text-sm" : "min-w-14 flex-col px-2 py-1.5 text-[0.7rem]", active ? "bg-primary text-primary-foreground shadow-md shadow-primary/20" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground")}>
            <Icon aria-hidden="true" className={variant === "desktop" ? "size-4" : "size-5"} />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
