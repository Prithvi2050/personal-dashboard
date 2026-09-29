import { createHash } from "node:crypto";
import { money, parseDate, minimalDescription, suggest, StatementError, type Format, type ParsedStatement, type StatementRow } from "./model.ts";
export const digest = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
const dateToken = "(?:\\d{2}[-/]\\d{2}[-/]\\d{2,4}|\\d{2} [A-Za-z]{3} \\d{2,4})";
const startsDate = new RegExp(`^(${dateToken})\\s+`);
const cardRow = new RegExp(`^(${dateToken})\\s+(.+?)\\s+([\\d,]+\\.\\d{2})\\s+(Dr|Cr|D|C|M)$`, "i");
const bankRow = new RegExp(`^(${dateToken})\\s+(.+?)\\s+(?:-|[A-Za-z0-9]+)\\s+([\\d,]+(?:\\.\\d{2})?)\\s+([\\d,]+(?:\\.\\d{2})?)\\s+([\\d,]+\\.\\d{2})$`);

export function parsePages(pages: string[], hash: string): ParsedStatement {
  const all = pages.join("\n");
  const format: Format = /Axis Bank/i.test(all) && /Credit Card|RuPay/i.test(all) ? "axis-card" : /SBI\s*CARD|sbicard\.com/i.test(all) ? "sbi-card" : /sbi\.co\.in/i.test(all) && /TRANSACTION OVERVIEW/i.test(all) ? "sbi-bank" : (() => { throw new StatementError("Unsupported statement format. Currently supported: SBI Card, Axis Card and SBI Relationship Summary savings statements."); })();
  const rows: StatementRow[] = [], warnings: string[] = [];
  const memoEmis = new Set<number>();
  let start: string | null = null, end: string | null = null, previousDate: string | null = null;
  let opening: number | null = null, closing: number | null = null, running: number | null = null;
  const period = format === "axis-card" ? /(\d{2}\/\d{2}\/\d{4})\s*-\s*(\d{2}\/\d{2}\/\d{4})/.exec(all) : /Statement Period\s*[:.,]?\s*(\d{2} [A-Za-z]{3} \d{2,4})\s*to\s*(\d{2} [A-Za-z]{3} \d{2,4})/i.exec(all);
  if (period) { start = parseDate(period[1]); end = parseDate(period[2]); }
  function add(date: string, description: string, amount: number, direction: "debit" | "credit", extra = "") {
    if (!amount) throw new StatementError("A transaction has no amount; review the original statement.");
    const parsedDate = parseDate(date); previousDate = date;
    const merchant = minimalDescription(description);
    const suggestion = suggest(description, direction, format);
    rows.push({ key: digest(`${hash}:${rows.length}`), date: parsedDate, merchant, amount, direction, ...suggestion, warning: [suggestion.warning, extra].filter(Boolean).join(" "), fingerprint: digest(`${parsedDate}|${amount}|${direction}|${description.trim().replace(/\s+/g," ").toUpperCase()}`) });
  }
  for (const page of pages) {
    if (format === "sbi-bank" && !/TRANSACTION OVERVIEW|Transaction Reference/i.test(page)) continue;
    if (format === "sbi-bank" && /DL\s*\/\s*TL ACCOUNT/i.test(page.split("TRANSACTION OVERVIEW")[0])) { warnings.push("Loan-account ledger omitted. Review the savings-account EMI debit instead; do not count both sides or loan interest twice."); continue; }
    const lines = page.split(/\r?\n/).map(line => line.replace(/\s+/g," ").trim());
    const openingMatch = format === "sbi-bank" ? /Your Opening Balance on (\d{2}-\d{2}-\d{2,4})\s*:?\s*[₹\s]*([\d,]+\.\d{2})/.exec(page) : null;
    if (openingMatch) {
      if (opening !== null) throw new StatementError("Multiple savings ledgers detected. Upload a single-account statement.");
      start=parseDate(openingMatch[1]); opening=money(openingMatch[2]); running=opening;
    }
    let active = false;
    for (let i=0;i<lines.length;i++) {
      let line = lines[i];
      if (format === "sbi-bank" ? /Transaction Reference/i.test(line) : format === "axis-card" ? /TRANSACTION DETAILS/i.test(line) : /Transaction Details/i.test(line)) active = true;
      if (!active) continue;
      if (format === "sbi-bank") {
        const open = /Your Opening Balance on (\d{2}-\d{2}-\d{2,4})\s*:?\s*[₹\s]*([\d,]+\.\d{2})/.exec(line);
        const close = /Your Closing Balance on (\d{2}-\d{2}-\d{2,4})\s*:?\s*[₹\s]*([\d,]+\.\d{2})/.exec(line);
        if (open) continue; // PDF text order can place this visually earlier line after transactions.
        if (close) { end=parseDate(close[1]); closing=money(close[2]); active=false; }
      }
      if (/End of Statement|Important Messages|Transactions highlighted|Important notice/i.test(line)) active=false;
      if (!active) continue;
      if (startsDate.test(line)) {
        if (format === "sbi-bank") {
          for (let continuation=0; !bankRow.test(line) && continuation<3 && i+1<lines.length && !startsDate.test(lines[i+1]); continuation++) line += " " + lines[++i];
          const match = bankRow.exec(line);
          if (!match) throw new StatementError("A bank transaction row could not be read completely. No rows from this file will be imported.");
          const credit=money(match[3]), debit=money(match[4]), balance=money(match[5]);
          if ((credit>0) === (debit>0)) throw new StatementError("Ambiguous debit/credit columns.");
          if (running !== null && running+credit-debit !== balance) throw new StatementError(`Bank balance reconciliation failed at row ${rows.length+1}. No partial import is allowed.`);
          running=balance; add(match[1],match[2],debit||credit,debit ? "debit":"credit");
        } else {
          for (let continuation=0; !cardRow.test(line) && continuation<2 && i+1<lines.length && !startsDate.test(lines[i+1]); continuation++) line += " " + lines[++i];
          const match=cardRow.exec(line);
          if (!match) throw new StatementError("A card transaction row could not be read completely. No rows from this file will be imported.");
          add(match[1], match[2], money(match[3]), /^c/i.test(match[4]) ? "credit":"debit");
          if(format === "sbi-card" && match[4].toUpperCase()==="M") {
            if(/\bEMI\b/i.test(match[2])) memoEmis.add(rows.length-1);
            else {rows[rows.length-1].kind="review";rows[rows.length-1].warning="Memo entry: confirm whether this is spending before including it.";}
          }
        }
      } else if (format === "sbi-card" && /^(?:IGST|CGST|SGST|GST)\b/i.test(line)) {
        const tax=/^(.+?)\s+([\d,]+\.\d{2})\s+([DC])$/i.exec(line);
        if (!tax || !previousDate) throw new StatementError("Tax date could not be established.");
        add(previousDate,tax[1],money(tax[2]),tax[3].toUpperCase()==="C"?"credit":"debit","Date inherited from preceding transaction; verify.");
      }
    }
  }
  if (!rows.length || rows.length>500) throw new StatementError("No supported transactions found, or more than 500 rows. Scanned PDFs need a text-based export.");
  for(const index of memoEmis) {
    const emi=rows[index],interest=rows[index+1];
    if(interest && /^INTEREST ON EMI$/i.test(interest.merchant) && interest.date===emi.date && interest.direction==="debit" && interest.amount<emi.amount) {
      interest.kind="emi_interest_included";
      interest.warning="Already included in the preceding SBI memo EMI total. Not added to spending again. Verify this pairing.";
      emi.warning="SBI memo EMI total includes the following interest component. Count this total once; separately billed taxes remain expenses. Verify the pairing.";
    } else {emi.kind="review";emi.warning="SBI memo EMI: could not pair its interest component safely. Verify the monthly commitment before including it.";}
  }
  if (format === "sbi-bank" && (opening === null || closing === null || closing !== running)) throw new StatementError("Opening/closing bank balances could not be reconciled.");
  if (!start || !end) warnings.push("Statement coverage dates could not be established; this import cannot certify a complete month.");
  if (rows.some(row=>/\bEMI\b/i.test(row.merchant))) warnings.push("Monthly EMI amounts count as expenses. Mark any original financed purchase as financed_purchase to avoid counting it twice.");
  warnings.push("Verify all rows against your statement before confirming. Card statement dates may differ from original purchase dates; displayed dates are used.");
  return { format, label: {"sbi-bank":"SBI bank", "sbi-card":"SBI Card", "axis-card":"Axis Card"}[format], hash, start, end, rows, warnings: [...new Set(warnings)] };
}
