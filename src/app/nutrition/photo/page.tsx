import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { loadLibrary } from "@/lib/library/repository";
import { loadPhotoDrafts } from "@/lib/nutrition/photo-repository";
import { parseAnalysis } from "@/lib/ai/meal-vision";
import { PhotoUpload } from "@/components/nutrition/photo-upload";
import { PhotoReview } from "@/components/nutrition/photo-review";
export const maxDuration = 90;
export default async function PhotoPage({ searchParams }: { searchParams: Promise<{ draft?: string }> }) {
  const query = await searchParams;
  let library;
  let loaded;
  try { library = await loadLibrary(); loaded = await loadPhotoDrafts(query.draft); } catch { /* Render a recoverable error below. */ }
  if (library?.status === "unauthenticated") redirect("/sign-in?next=/nutrition/photo");
  if (library?.status !== "ready" || !loaded) return <section className="rounded-3xl bg-card p-8" role="alert"><h1 className="text-2xl font-bold">Photo logging needs attention</h1><p className="mt-3">Check your connection and Sprint 7 migration. The selected draft may also be unavailable.</p><Link href="/nutrition/photo" className="mt-5 inline-block text-primary underline">Try again</Link><Link href="/nutrition" className="ml-5 text-primary underline">Use quick logging</Link></section>;
  const { draft, drafts, imageUrl } = loaded;
  let analysis;
  if (draft?.status === "ready") {
    try { analysis = parseAnalysis(draft.result, { foods: library.foods, utensils: library.utensils }); } catch { /* Do not render invalid stored provider data. */ }
  }
  return <div className="mx-auto max-w-4xl space-y-7">
    <div className="flex flex-wrap justify-between gap-3"><h1 className="text-3xl font-bold">Photo → Review → Confirm</h1><Link href="/nutrition" className="text-primary underline">Back to Nutrition</Link></div>
    {!draft ? <PhotoUpload requestId={crypto.randomUUID()} utensils={library.utensils}/> : <>
      {imageUrl ? <Image unoptimized src={imageUrl} alt="Your uploaded meal for review" width={800} height={500} className="max-h-96 w-full rounded-3xl object-contain bg-muted"/> : <p role="alert">Photo unavailable. Refresh to retry.</p>}
      {draft.meal_id ? <p className="rounded-2xl bg-card p-6">This meal is already saved. <Link href="/nutrition" className="text-primary underline">Open your journal</Link>.</p> : analysis ? <PhotoReview key={draft.id} draftId={draft.id} analysis={analysis} foods={library.foods} utensils={library.utensils} calibrations={library.calibrations}/> : <p role="status" className="rounded-2xl bg-card p-6">{draft.status === "processing" ? "Analysis is processing or was interrupted. Reload this review to check; reloading does not call AI again. If it remains unavailable, start a new attempt below (another charge may apply)." : "This analysis could not be completed. No meal was saved. Start a new attempt or use quick logging."}</p>}
      <Link href="/nutrition/photo" className="inline-block text-primary underline">Start another photo</Link>
    </>}
    {drafts.length ? <section className="space-y-3"><h2 className="text-xl font-bold">Recent analyses</h2><ul className="space-y-2">{drafts.map(d => <li key={d.id}><Link href={`/nutrition/photo?draft=${d.id}`} className="text-sm text-primary underline">{d.created_at.slice(0,16).replace("T"," ")} UTC · {d.meal_id ? "Saved meal" : d.status}</Link></li>)}</ul><p className="text-xs text-muted-foreground">Opening an existing result does not run AI again.</p></section> : null}
  </div>;
}
