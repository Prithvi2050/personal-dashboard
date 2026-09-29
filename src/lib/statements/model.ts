export const formats = ["sbi-card", "axis-card", "sbi-bank"] as const;
export type Format = typeof formats[number];
export const kinds = ["expense", "emi", "fee", "emi_interest_included", "refund", "income", "transfer", "investment", "card_payment", "financed_purchase", "review"] as const;
export type Kind = typeof kinds[number];
export const spendingCategories = ["Dining", "Grocery", "Shopping", "Transport", "Bills", "Entertainment", "Health", "Travel", "Household", "Other"] as const;
export type StatementRow = { key: string; date: string; merchant: string; amount: number; direction: "debit" | "credit"; kind: Kind; category: string; fingerprint: string; warning: string };
export type ParsedStatement = { format: Format; label: string; hash: string; start: string | null; end: string | null; rows: StatementRow[]; warnings: string[] };
export type Account = { id: string; household_id: string; owner_id: string; label: string; format: Format; last_four: string; created_at: string };
export type Member = { user_id: string; household_id: string; display_name: string; role: "owner" | "member" };
export type Draft = { id: string; user_id: string; household_id: string; files: ParsedStatement[]; expires_at: string; created_at: string; confirmed_at: string | null };
export type Entry = { id: string; household_id: string; account_id: string; source_key: string; fingerprint: string; date: string; merchant: string; amount: number; direction: "debit" | "credit"; kind: Kind; category: string; revision: number; created_at: string };
export type ReviewChoice = { file: number; account: string; rows: { index: number; include: boolean; kind: Kind; category: string; merchant: string; keepDuplicate: boolean }[] };
export type UploadState = { status: "idle" | "success" | "error"; message: string; draft?: Draft; errors?: string[]; reviewId?: string };
export class StatementError extends Error {}
export function expenseAmount(row: Pick<Entry, "kind" | "amount" | "direction">): number {
  return row.direction === "debit" && ["expense", "emi", "fee"].includes(row.kind) ? row.amount : 0;
}
export function money(value: string): number {
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+|\d{1,2}(?:,\d{2})*,\d{3})(?:\.\d{2})?$/.test(value)) throw new StatementError("Unsupported amount.");
  const [whole, cents = "00"] = value.replaceAll(",", "").split(".");
  const amount = Number(whole) * 100 + Number(cents);
  if (!Number.isSafeInteger(amount) || amount < 0 || amount > 99999999999) throw new StatementError("Amount outside supported range.");
  return amount;
}
export function parseDate(value: string): string {
  const months = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
  const match = /^(\d{2})[-/ ](\d{2}|[A-Za-z]{3})[-/ ](\d{2}|\d{4})$/.exec(value.trim());
  if (!match) throw new StatementError("Unrecognized date.");
  const day = Number(match[1]), month = /^\d/.test(match[2]) ? Number(match[2]) : months.indexOf(match[2].toLowerCase()) + 1;
  const year = match[3].length === 2 ? 2000 + Number(match[3]) : Number(match[3]);
  const iso = `${year}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
  if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31 || new Date(`${iso}T00:00:00Z`).toISOString().slice(0,10) !== iso) throw new StatementError("Invalid date.");
  return iso;
}
export function minimalDescription(value: string): string {
  // Remove UPI addresses, long identifiers and control characters before storing review data.
  return value.replace(/[\w.+-]+@[\w.-]+/g, "[UPI]").replace(/\b(?=[A-Za-z0-9]*\d)[A-Za-z0-9]{10,}\b/g, "[ref]").replace(/[\u0000-\u001f]/g," ").replace(/\s+/g," ").trim().slice(0,160);
}
export function suggest(description: string, direction: "debit" | "credit", format: Format): { kind: Kind; category: string; warning: string } {
  const upper = description.toUpperCase();
  let kind: Kind = "expense", warning = "";
  if (/PAYMENT RECEIV|BBPS PAYMENT|PAYMENT THANK/.test(upper)) kind = "card_payment";
  else if (/REFUND|REVERSAL|REVERSED/.test(upper)) { kind = direction === "credit" ? "refund" : "review"; warning = "Verify the linked purchase and refund treatment."; }
  else if (/INTEREST|IGST|CGST|SGST|\bFEE\b|\bCHARGES\b/.test(upper)) {kind = direction === "debit" ? "fee" : "review"; if(direction === "credit") warning="Review this credit: it may be income or a reversed fee.";}
  else if (/\bEMI\b/.test(upper)) { kind = /CONVERT|BOOKING/.test(upper) ? "financed_purchase" : "emi"; warning = "Check EMI principal/interest are counted once; exclude the original financed purchase."; }
  else if (direction === "credit") { kind = "review"; warning = "Choose income, refund, transfer or card repayment. A credit is not automatically a refund."; }
  else if (format === "sbi-bank") { kind = "review"; warning = "Identify purchase, EMI, card repayment or household transfer."; }
  const category = /RESTAURANT|CAFE|SWIGGY|ZOMATO/.test(upper) ? "Dining" : /FOOD PRODUCTS|GROCERY|SUPERMARKET/.test(upper) ? "Grocery" : /MEDICAL|PHARM/.test(upper) ? "Health" : /CLOTH|SHOPPING/.test(upper) ? "Shopping" : /FUEL|PETROL|TRANSPORT/.test(upper) ? "Transport" : kind === "fee" || kind === "emi" ? "Bills" : "Other";
  return { kind, category, warning };
}
