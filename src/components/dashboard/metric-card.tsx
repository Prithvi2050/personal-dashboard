import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export function MetricCard({ href, label, value, detail, progress, accent }: { href: string; label: string; value: string; detail: string; progress: number; accent: "blue" | "cyan" }) {
  return (
    <Link href={href} className="group rounded-3xl bg-card p-6 shadow-sm ring-1 ring-border/80 transition duration-200 hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
      <div className="flex items-start justify-between"><p className="font-semibold text-muted-foreground">{label}</p><ArrowUpRight aria-hidden="true" className="size-5 text-muted-foreground transition group-hover:text-primary" /></div>
      <p className="mt-8 text-3xl font-bold tracking-tight">{value}</p>
      <p className="mt-2 text-sm text-muted-foreground">{detail}</p>
      <Progress value={progress} aria-label={`${label} progress`} className={cn("mt-6", accent === "cyan" && "[&_[data-slot=progress-indicator]]:bg-cyan-500")} />
    </Link>
  );
}
