import type { ReactNode } from "react";
import Link from "next/link";
import { Activity } from "lucide-react";
import { AppNav } from "@/components/navigation/app-nav";
import { AuthStatus } from "@/components/auth/auth-status";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen pb-24 md:pb-10">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 pt-6 md:px-8 md:pt-8">
        <Link href="/" className="flex items-center gap-3 rounded-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary" aria-label="Personal Dashboard home">
          <span className="grid size-10 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20"><Activity aria-hidden="true" className="size-5" /></span>
          <span className="hidden text-sm font-bold tracking-tight sm:block">Personal Dashboard</span>
        </Link>
        <div className="flex items-center gap-3">
          <AppNav variant="desktop" />
          <AuthStatus />
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-5 py-10 md:px-8 md:py-14">{children}</main>
      <AppNav variant="mobile" />
    </div>
  );
}
