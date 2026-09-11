"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { Globe2, Target, Wallet, LoaderCircle } from "lucide-react";
import { saveSettings } from "@/app/settings/actions";
import type { SettingsValues, SaveState, NumberField } from "@/lib/settings/validation";

const initialState: SaveState = { status: "idle", message: "" };
const inputStyle = "mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-primary aria-invalid:border-destructive disabled:opacity-60";
const goalFields: { name: NumberField; label: string; unit: string; optional?: boolean }[] = [
  { name: "daily_calorie_goal", label: "Daily calorie goal", unit: "kcal" },
  { name: "daily_protein_goal", label: "Daily protein goal", unit: "g" },
  { name: "daily_carbs_goal", label: "Daily carbohydrate goal", unit: "g", optional: true },
  { name: "daily_fat_goal", label: "Daily fat goal", unit: "g", optional: true },
];
export function SettingsForm({ initialValues, timezones, onboarding = false }: { initialValues: SettingsValues; timezones: string[]; onboarding?: boolean }) {
  const [state, action, pending] = useActionState(saveSettings, initialState);
  const [values, setValues] = useState(() => Object.fromEntries(Object.entries(initialValues).map(([key, value]) => [key, value === null ? "" : String(value)])));
  const [edited, setEdited] = useState(false);
  function change(name: string, value: string) { setValues((previous) => ({ ...previous, [name]: value })); setEdited(true); }
  function numberInput(name: NumberField, label: string, unit: string, optional = false) {
    const error = state.errors?.[name];
    return <div key={name}>
      <label htmlFor={name} className="text-sm font-semibold">{label} <span className="font-normal text-muted-foreground">({unit}){optional ? " · optional" : ""}</span></label>
      <input id={name} name={name} type="number" inputMode="decimal" min={name === "daily_calorie_goal" || name === "daily_protein_goal" ? "0.01" : "0"} max="1000000000" step="0.01" required={!optional} value={values[name]} onChange={(event) => change(name, event.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? name + "-error" : undefined} className={inputStyle} />
      {error ? <p id={name + "-error"} className="mt-2 text-sm text-destructive">{error}</p> : null}
    </div>;
  }
  return <form action={action} onSubmit={() => setEdited(false)} className="space-y-6">
    <input type="hidden" name="intent" value={onboarding ? "onboarding" : "settings"} />
    <fieldset disabled={pending} className="space-y-6">
      <section className="rounded-3xl bg-card p-6 shadow-sm ring-1 ring-border/80 sm:p-8" aria-labelledby="nutrition-settings">
        <h2 id="nutrition-settings" className="flex items-center gap-3 text-lg font-bold"><Target className="size-5 text-primary" aria-hidden="true" /> Nutrition goals</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Choose your own daily targets. Leave optional goals blank if you do not track them.</p>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">{goalFields.map(({ name, label, unit, optional }) => numberInput(name, label, unit, optional))}</div>
      </section>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl bg-card p-6 shadow-sm ring-1 ring-border/80 sm:p-8" aria-labelledby="budget-settings">
          <h2 id="budget-settings" className="flex items-center gap-3 text-lg font-bold"><Wallet className="size-5 text-primary" aria-hidden="true" /> Monthly spending</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">One monthly budget across all categories. You can change it later.</p>
          <div className="mt-6">{numberInput("monthly_spending_budget", "Monthly budget", "INR")}</div>
        </section>
        <section className="rounded-3xl bg-card p-6 shadow-sm ring-1 ring-border/80 sm:p-8" aria-labelledby="timezone-settings">
          <h2 id="timezone-settings" className="flex items-center gap-3 text-lg font-bold"><Globe2 className="size-5 text-primary" aria-hidden="true" /> Your day</h2>
          <p id="timezone-help" className="mt-2 text-sm leading-6 text-muted-foreground">Your timezone defines when each day starts and ends.</p>
          <div className="mt-6"><label htmlFor="timezone" className="text-sm font-semibold">Timezone</label>
            <select id="timezone" name="timezone" value={values.timezone} onChange={(event) => change("timezone", event.target.value)} aria-invalid={Boolean(state.errors?.timezone)} aria-describedby={state.errors?.timezone ? "timezone-help timezone-error" : "timezone-help"} className={inputStyle}>
              {timezones.map((timezone) => <option key={timezone} value={timezone}>{timezone.replaceAll("_", " ")}</option>)}
            </select>
            {state.errors?.timezone ? <p id="timezone-error" className="mt-2 text-sm text-destructive">{state.errors.timezone}</p> : null}
          </div>
        </section>
      </div>
    </fieldset>
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <p role={state.status === "error" ? "alert" : "status"} aria-live="polite" className={state.status === "error" ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
        {pending ? "Saving your preferences…" : edited ? "You have unsaved changes." : state.message || "Your preferences are private to your account."}
      </p>
      <div className="flex shrink-0 items-center gap-4">
        {onboarding ? <Link href="/" className="rounded text-sm font-semibold text-muted-foreground underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-primary">Set up later</Link> : null}
        <button type="submit" disabled={pending} className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary disabled:opacity-60">
          {pending ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : null}{pending ? "Saving…" : onboarding ? "Save & open Home" : "Save settings"}
        </button>
      </div>
    </div>
  </form>;
}
