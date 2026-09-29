import "server-only";
import { createClient } from "@/lib/supabase/server";
import { fixtureEmails, followupFixtures, fixtureSender, prepareFixtures, parseCorrection, SpendingError } from "./model";

async function session() {
  const client = await createClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new SpendingError("Sign in again to review transactions.");
  return client;
}
export async function loadReview() {
  const client = await session();
  const [transactions, rules] = await Promise.all([
    client.from("transactions").select("*", { count: "exact" }).eq("source_mode", "fixture").order("transaction_time", { ascending: false }).limit(100),
    client.from("merchant_rules").select("*", { count: "exact" }).eq("source_mode", "fixture").order("merchant_key").limit(100),
  ]);
  if (transactions.error || rules.error || (transactions.count ?? 0) > 100 || (rules.count ?? 0) > 100) throw new SpendingError("Review could not load completely. Check your connection and the Sprint 10 migration.");
  return { transactions: transactions.data ?? [], rules: rules.data ?? [] };
}
export async function changeReview(form: FormData) {
  const client = await session();
  const operation = form.get("operation");
  if (operation === "import") {
    if (form.get("consent") !== "yes") throw new SpendingError("Approve the synthetic fixture sender before importing.");
    const batch = form.get("batch");
    if (batch !== "initial" && batch !== "followup") throw new SpendingError("Unknown fixture batch.");
    const rules = await client.from("merchant_rules").select("*").eq("source_mode", "fixture");
    if (rules.error) throw new SpendingError("Could not load merchant rules. Check the Sprint 10 migration.");
    const prepared = await prepareFixtures(batch === "initial" ? fixtureEmails : followupFixtures, [fixtureSender], rules.data);
    const result = await client.rpc("import_fixture_transactions", { p_items: prepared.items });
    if (result.error) throw new SpendingError("Fixture import failed. Check your connection and Sprint 10 migration; retrying is safe.");
    return `${result.data} synthetic transactions added; ${prepared.items.length - result.data + prepared.duplicates} duplicates skipped; ${prepared.rejected} unsupported or unapproved messages rejected.`;
  }
  if (operation === "correct") {
    const value = parseCorrection(form);
    const result = await client.rpc("correct_fixture_transaction", { p_id: value.id, p_revision: value.revision, p_merchant: value.merchant, p_category: value.category, p_time: value.time, p_account: value.account, p_description: value.description, p_save_rule: value.saveRule });
    if (result.error) throw new SpendingError("Correction could not be saved. Refresh to check for another edit, then retry. No partial correction was saved.");
    return value.saveRule ? "Correction saved. Merchant rule applies to future fixture imports only." : "Correction saved; original extraction retained.";
  }
  if (operation === "remove-rule") {
    const key = String(form.get("merchant_key") ?? "");
    if (!key || key.length > 120) throw new SpendingError("Invalid merchant rule.");
    const result = await client.rpc("remove_fixture_rule", { p_key: key });
    if (result.error) throw new SpendingError("Rule could not be removed. Refresh and retry.");
    return "Rule removed. Existing transactions and corrections are unchanged.";
  }
  throw new SpendingError("Unknown review action.");
}
