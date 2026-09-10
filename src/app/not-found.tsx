import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return <div className="mx-auto max-w-lg py-24 text-center"><p className="text-sm font-bold text-primary">404</p><h1 className="mt-3 text-4xl font-bold tracking-tight">This page isn&apos;t here</h1><p className="mt-4 text-muted-foreground">Return to your dashboard and choose one of the main sections.</p><Link href="/" className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"><ArrowLeft aria-hidden="true" className="size-4" />Back to Home</Link></div>;
}
