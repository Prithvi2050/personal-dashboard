import { PDFParse } from "pdf-parse";
import { parsePages, digest } from "./parser.ts";
import { StatementError } from "./model.ts";
export async function extractStatement(bytes: Uint8Array) {
  if (bytes.length > 3*1024*1024 || bytes.length < 5 || Buffer.from(bytes.subarray(0,5)).toString() !== "%PDF-") throw new StatementError("Use an unlocked PDF no larger than 3 MB.");
  const hash = digest(bytes);
  const parser = new PDFParse({ data: bytes, verbosity: 0, isEvalSupported: false });
  try {
    const info = await parser.getInfo();
    if (info.total > 30) throw new StatementError("Use a statement with at most 30 pages.");
    const result = await parser.getText();
    if(result.text.length>500000) throw new StatementError("Statement text exceeds the processing limit.");
    return parsePages(result.pages.map(page=>page.text),hash);
  } finally { await parser.destroy(); }
}
