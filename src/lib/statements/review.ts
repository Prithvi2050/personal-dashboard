import { expenseAmount, minimalDescription, spendingCategories, StatementError, type Entry, type Kind, type ParsedStatement, type ReviewChoice } from "./model.ts";

type Classification = { value: string; label: string; kind: Kind; category: string; group: "Expense" | "Excluded from expenses" };
export const classifications: Classification[] = [
  ...spendingCategories.map(category => ({ value: `expense:${category}`, label: category, kind: "expense" as const, category, group: "Expense" as const })),
  { value: "emi", label: "Monthly EMI", kind: "emi", category: "Bills", group: "Expense" },
  { value: "fee", label: "Interest, fees & taxes", kind: "fee", category: "Bills", group: "Expense" },
  { value: "investment", label: "Investment", kind: "investment", category: "Other", group: "Excluded from expenses" },
  { value: "transfer", label: "Transfer / cash withdrawal", kind: "transfer", category: "Other", group: "Excluded from expenses" },
  { value: "card_payment", label: "Card repayment", kind: "card_payment", category: "Other", group: "Excluded from expenses" },
  { value: "financed_purchase", label: "Original financed purchase", kind: "financed_purchase", category: "Other", group: "Excluded from expenses" },
  { value: "emi_interest_included", label: "Interest already included in EMI", kind: "emi_interest_included", category: "Bills", group: "Excluded from expenses" },
];

export function classificationFor(row: Pick<Entry, "kind" | "category">): string {
  return classifications.find(option => option.kind === row.kind && (row.kind !== "expense" || option.category === row.category))?.value ?? "review";
}

export function parseClassification(value: unknown): Classification {
  const option = classifications.find(item => item.value === value);
  if (!option) throw new StatementError("Choose a category, or uncheck Include. Refresh the page if this review was opened before the update.");
  return option;
}

export function categoryLabel(row: Pick<Entry, "kind" | "category">): string {
  return classifications.find(item => item.value === classificationFor(row))?.label ?? "Needs review";
}

// Keep original source indexes: removing credits here would shift all submitted row identifiers.
export function buildReviewChoices(files: ParsedStatement[], form: FormData): ReviewChoice[] {
  return files.map((file, fi) => {
    const account = String(form.get(`account-${fi}`) ?? "");
    if (!account) throw new StatementError(`File ${fi + 1}: select its shared account. Nothing was saved.`);
    return { file: fi, account, rows: file.rows.map((row, index) => {
      const prefix = `${fi}-${index}`;
      // Never import an invisible credit, even if an old/tampered form includes one.
      const include = row.direction === "debit" && form.get(`include-${prefix}`) === "yes";
      if (!include) return { index, include: false, kind: row.kind, category: row.category, merchant: row.merchant, keepDuplicate: false };
      let selected: Classification;
      try { selected = parseClassification(form.get(`classification-${prefix}`)); }
      catch { throw new StatementError(`File ${fi + 1}, source row ${index + 1}: choose a category, or uncheck Include. Nothing was saved.`); }
      const merchant = minimalDescription(String(form.get(`merchant-${prefix}`) ?? row.merchant));
      if (!merchant) throw new StatementError(`File ${fi + 1}, source row ${index + 1}: enter a merchant, or uncheck Include. Nothing was saved.`);
      return { index, include, kind: selected.kind, category: selected.category, merchant, keepDuplicate: form.get(`duplicate-${prefix}`) === "yes" };
    }) };
  });
}

export function summarizeSpending(rows: Pick<Entry, "kind" | "category" | "amount" | "direction">[]) {
  let total = 0, emi = 0, investments = 0;
  const amounts = new Map<string, number>();
  for (const row of rows) {
    if (row.direction !== "debit") continue;
    if (row.kind === "investment") investments += row.amount;
    const amount = expenseAmount(row);
    if (!amount) continue;
    total += amount;
    if (row.kind === "emi") emi += amount;
    const category = categoryLabel(row);
    amounts.set(category, (amounts.get(category) ?? 0) + amount);
  }
  const categories = [...amounts].map(([category, amount]) => ({
    category, amount, percentage: total ? amount / total * 100 : 0,
  })).sort((a, b) => b.amount - a.amount || a.category.localeCompare(b.category));
  return { total, emi, investments, categories };
}
