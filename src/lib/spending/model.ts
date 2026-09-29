export const categories = ["Dining", "Grocery", "Shopping", "Transport", "Bills", "Entertainment", "Health", "Travel", "Household", "Other"] as const;
export type Category = typeof categories[number];
export type Classification = { category: Category; confidence: number; source: "rule" | "known" | "ai" | "fallback" };
export type MerchantRule = { merchant_key: string; normalized_merchant: string; category: Category };
export type Candidate = { email_message_id: string; sender_email: string; amount_minor: number; currency: "INR" | "USD" | "EUR"; merchant: string; merchant_key: string; normalized_merchant: string; transaction_time: string; payment_method: string; account_identifier: string; raw_description: string; category: Category; classification_confidence: number; classification_source: Classification["source"] };
export type Transaction = Candidate & { id: string; user_id: string; source_mode: "fixture"; original: Candidate; revision: number; corrected_at: string | null; created_at: string; updated_at: string };
export type SpendingState = { status: "idle" | "success" | "error"; message: string };
export class SpendingError extends Error {}
export const fixtureSender = "alerts@fixture-bank.example";
export type FixtureEmail = { id: string; from: string; body: string; synthetic: true };
export function amountMinor(value: string): number {
  if (!/^(?:0|[1-9]\d{0,8})\.\d{2}$/.test(value)) throw new SpendingError("Unsupported amount format.");
  const [whole, fraction] = value.split(".");
  const result = Number(whole) * 100 + Number(fraction);
  if (!Number.isSafeInteger(result) || result <= 0) throw new SpendingError("Amount must be positive.");
  return result;
}
export function timestamp(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match) throw new SpendingError("Use a complete timestamp with timezone.");
  const [, year, month, day, hour, minute, second, offset] = match;
  if (Number(year) < 2000 || Number(year) > 2100 || Number(month) < 1 || Number(month) > 12 || Number(day) < 1 || Number(day) > 31 || Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59 || new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))).toISOString().slice(0,10) !== value.slice(0,10)) throw new SpendingError("Invalid transaction date.");
  if (offset !== "Z" && (Number(offset.slice(4)) > 59 || Number(offset.slice(1,3)) * 60 + Number(offset.slice(4)) > 840)) throw new SpendingError("Invalid timezone offset.");
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new SpendingError("Invalid transaction date.");
  return date.toISOString();
}
export function merchantKey(value: string): string {
  const key = value.normalize("NFKC").trim().toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
  if (!key || key.length > 120) throw new SpendingError("Merchant is unavailable or too long.");
  // Only known synthetic branch formats are folded; unknown merchants remain distinct.
  return /^sample (cafe|market)(?: \d+)?$/.test(key) ? key.replace(/ \d+$/, "") : key;
}
const known: Record<string, { name: string; category: Category }> = { "sample cafe": { name: "Sample Cafe", category: "Dining" }, "sample market": { name: "Sample Market", category: "Grocery" } };
export interface CategoryClassifier { classify(merchant: string): Promise<unknown> }
export async function classifyMerchant(merchant: string, rules: MerchantRule[], classifier?: CategoryClassifier): Promise<Classification & { normalized_merchant: string }> {
  const key = merchantKey(merchant);
  const rule = rules.find(rule => rule.merchant_key === key);
  if (rule) return { normalized_merchant: rule.normalized_merchant, category: rule.category, confidence: 1, source: "rule" };
  if (Object.hasOwn(known,key)) return { normalized_merchant: known[key].name, category: known[key].category, confidence: 1, source: "known" };
  if (classifier) {
    try {
      const result = await classifier.classify(merchant);
      if (result && typeof result === "object" && "category" in result && "confidence" in result && categories.includes(result.category as Category) && typeof result.confidence === "number" && Number.isFinite(result.confidence) && result.confidence >= 0.6 && result.confidence <= 1) return { normalized_merchant: merchant, category: result.category as Category, confidence: result.confidence, source: "ai" };
    } catch { /* An unavailable classifier must not fabricate a confident category. */ }
  }
  return { normalized_merchant: merchant, category: "Other", confidence: 0, source: "fallback" };
}
export async function extractFixture(email: FixtureEmail, approved: string[], rules: MerchantRule[] = [], classifier?: CategoryClassifier): Promise<Candidate> {
  if (email.synthetic !== true || !/^fixture:[a-z0-9-]{1,60}$/.test(email.id) || email.from !== fixtureSender || !approved.includes(email.from)) throw new SpendingError("Fixture sender is not approved.");
  if (typeof email.body !== "string" || email.body.length > 2000) throw new SpendingError("Unsupported fixture message.");
  const card = /^Card debit: (INR|USD|EUR) (\d+\.\d{2}) at ([A-Za-z0-9 #&.'-]{1,100}) on (\S+)\. Card ending (\d{4})\.$/.exec(email.body);
  const upi = /^Payment successful: (INR|USD|EUR) (\d+\.\d{2}) to ([A-Za-z0-9 #&.'-]{1,100}) on (\S+)\. Method UPI\.$/.exec(email.body);
  const match = card ?? upi;
  if (!match) throw new SpendingError("Unsupported or ambiguous message; no transaction created.");
  const [,currency,amount,merchant,date] = match;
  const classification = await classifyMerchant(merchant, rules, classifier);
  return { email_message_id: email.id, sender_email: email.from, amount_minor: amountMinor(amount), currency: currency as Candidate["currency"], merchant, merchant_key: merchantKey(merchant), normalized_merchant: classification.normalized_merchant, transaction_time: timestamp(date), payment_method: card ? "Card" : "UPI", account_identifier: card ? `•••• ${card[5]}` : "", raw_description: `${card ? "Card debit" : "UPI payment"} · ${merchant}`, category: classification.category, classification_confidence: classification.confidence, classification_source: classification.source };
}
export async function prepareFixtures(emails: FixtureEmail[], approved: string[], rules: MerchantRule[] = [], classifier?: CategoryClassifier) {
  if (emails.length > 20) throw new SpendingError("Fixture batch is too large.");
  const seen = new Set<string>(); const items: Candidate[] = [];
  let rejected = 0, duplicates = 0;
  for (const email of emails) {
    if (seen.has(email.id)) { duplicates++; continue; }
    try { items.push(await extractFixture(email,approved,rules,classifier)); seen.add(email.id); } catch { rejected++; }
  }
  return { items, rejected, duplicates };
}
export function parseCorrection(form: FormData) {
  const id = String(form.get("id") ?? ""); const revision = Number(form.get("revision"));
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id) || !Number.isSafeInteger(revision) || revision < 0 || !/^\d+$/.test(String(form.get("revision") ?? ""))) throw new SpendingError("Refresh the transaction before editing.");
  const merchant = String(form.get("normalized_merchant") ?? "").trim();
  const category = String(form.get("category"));
  const account = String(form.get("account_identifier") ?? "").trim();
  const description = String(form.get("raw_description") ?? "").trim();
  if (!merchant || merchant.length > 100 || !categories.includes(category as Category) || account.length > 40 || account.replace(/\D/g, "").length > 4 || description.length > 200) throw new SpendingError("Use a merchant up to 100 characters, valid category, account label with at most four digits, and description up to 200 characters.");
  const input = String(form.get("transaction_time") ?? "");
  const time = timestamp(input.length === 16 ? `${input}:00Z` : `${input}Z`);
  return { id, revision, merchant, category: category as Category, account, description, time, saveRule: form.get("save_rule") === "yes" };
}

// These examples are invented, not real bank templates. Dates and amounts are fixed for reproducible tests.
export const fixtureEmails: FixtureEmail[] = [
  { id: "fixture:card-001", from: fixtureSender, synthetic: true, body: "Card debit: INR 845.00 at SAMPLE CAFE #001 on 2026-09-18T08:30:00+05:30. Card ending 1234." },
  { id: "fixture:upi-001", from: fixtureSender, synthetic: true, body: "Payment successful: INR 1120.00 to SAMPLE MARKET on 2026-09-18T13:00:00+05:30. Method UPI." },
  { id: "fixture:unknown-001", from: fixtureSender, synthetic: true, body: "Card debit: USD 19.99 at DEMO STUDIO on 2026-09-18T10:00:00Z. Card ending 4321." },
  { id: "fixture:card-001", from: fixtureSender, synthetic: true, body: "Card debit: INR 845.00 at SAMPLE CAFE #001 on 2026-09-18T08:30:00+05:30. Card ending 1234." },
  { id: "fixture:blocked-001", from: "unapproved@example.com", synthetic: true, body: "Card debit: INR 10.00 at SAMPLE CAFE on 2026-09-18T10:00:00Z. Card ending 1234." },
  { id: "fixture:credit-001", from: fixtureSender, synthetic: true, body: "Refund credited: INR 845.00. Not a spending debit." },
  { id: "fixture:invalid-001", from: fixtureSender, synthetic: true, body: "Card debit: INR 10.00 at SAMPLE CAFE on 2026-02-30T10:00:00Z. Card ending 1234." },
];
export const followupFixtures: FixtureEmail[] = [{ id: "fixture:card-002", from: fixtureSender, synthetic: true, body: "Card debit: INR 250.00 at SAMPLE CAFE #002 on 2026-09-18T15:30:00+05:30. Card ending 1234." }];
