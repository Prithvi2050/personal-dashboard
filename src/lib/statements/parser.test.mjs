import test from 'node:test';
import assert from 'node:assert/strict';
import {parsePages,digest} from './parser.ts';
import {money,parseDate,expenseAmount,minimalDescription,suggest} from './model.ts';
import {extractStatement} from './pdf.ts';
const hash=digest('invented fixture');
test('statement money and dates reject malformed inputs',()=>{
 assert.equal(money('1,23,456.78'),12345678);assert.equal(parseDate('07 Sep 26'),'2026-09-07');
 for(const value of ['-1.00','1.234','NaN','1,234,56.00'])assert.throws(()=>money(value));
 assert.throws(()=>parseDate('31-02-26'));
});
test('Axis multi-page rows include credits, categories and partial billing periods',()=>{
 const result=parsePages(['Axis Bank RuPay Credit Card\n22/07/2026 - 20/08/2026\nTRANSACTION DETAILS\n22/07/2026 UPI/SAMPLE CAFE/test@upi RESTAURANTS 100.00 Dr\n23/07/2026 BBPS PAYMENT RECEIVED - FAKE123456789 100.00 Cr','Axis Bank\nTRANSACTION DETAILS\n20/08/2026 SAMPLE MARKET FOOD PRODUCTS 50.00 Dr\nEnd of Statement'],hash);
 assert.equal(result.rows.length,3);assert.equal(result.start,'2026-07-22');assert.equal(result.rows[0].category,'Dining');assert.equal(result.rows[1].kind,'card_payment');
 assert.equal(result.rows[0].merchant.includes('test@upi'),false);assert.equal(result.rows[1].merchant.includes('FAKE123456789'),false);
});
test('SBI card installments, interest, tax and repayments remain separate',()=>{
 const result=parsePages(['SBI Card\nTransaction Details\nfor Statement Period 08 Aug 26 to 07 Sep 26\n21 Aug 26 PAYMENT RECEIVED 200.00 C\n07 Sep 26 FP EMI 01/12 100.00 M\n07 Sep 26 INTEREST ON EMI 10.00 D\nIGST DB @ 18.00% 1.80 D\nImportant Messages'],hash);
 assert.deepEqual(result.rows.map(row=>row.kind),['card_payment','emi','emi_interest_included','fee']);
 assert.equal(result.rows.reduce((sum,row)=>sum+expenseAmount(row),0),10180);
 assert.equal(result.rows[3].date,'2026-09-07');assert.match(result.rows[3].warning,/inherited/);
});
test('SBI bank handles wrapped rows and late text-order opening balance, skips loan ledger',()=>{
 const result=parsePages(['sbi.co.in\nTRANSACTION OVERVIEW\nDate Transaction Reference Ref.No./Chq.No. Credit Debit Balance\n01-08-26 UPI/DR/111111111111/SAMPLE SHOP - 0 100.00 900.00\n02-08-26 NEFT*FAKE123456789*EXAMPLE\n INCOME - 200.00 0 1100.00\nYour Opening Balance on 01-08-26: 1000.00','Date Transaction Reference Ref.No./Chq.No. Credit Debit Balance\n03-08-26 DIRECT DR - 0 50.00 1050.00\nYour Closing Balance on 31-08-26: 1050.00','DL/TL ACCOUNT\nTRANSACTION OVERVIEW\nDate Transaction Reference Ref.No./Chq.No. Credit Debit Balance\n01-08-26 INTEREST - 0 20.00 2000.00'],hash);
 assert.equal(result.rows.length,3);assert.equal(result.rows[0].kind,'review');assert.equal(result.start,'2026-08-01');assert.equal(result.end,'2026-08-31');assert.ok(result.warnings.some(x=>x.includes('Loan-account')));
});
test('unsupported or partially unreadable files fail closed',async()=>{
 assert.throws(()=>parsePages(['Unknown bank'],hash),/Unsupported/);
 assert.throws(()=>parsePages(['Axis Bank Credit Card\nTRANSACTION DETAILS\n01/08/2026 incomplete'],hash),/completely/);
 assert.throws(()=>parsePages(['sbi.co.in\nTRANSACTION OVERVIEW\nDate Transaction Reference\nYour Opening Balance on 01-08-26: 1000.00\n01-08-26 SHOP - 0 100.00 700.00\nYour Closing Balance on 31-08-26: 700.00'],hash),/reconciliation/);
 await assert.rejects(extractStatement(new Uint8Array([1,2,3])),/PDF/);
});
test('expense math excludes financing and repayments; direction and privacy are explicit',()=>{
 for(const kind of ['transfer','investment','card_payment','financed_purchase','income','emi_interest_included'])assert.equal(expenseAmount({kind,amount:10000,direction:'debit'}),0);
 assert.equal(expenseAmount({kind:'investment',amount:10000,direction:'credit'}),0);
 assert.equal(expenseAmount({kind:'refund',amount:10000,direction:'credit'}),0);
 assert.equal(suggest('Unknown credit','credit','sbi-bank').kind,'review');
 assert.equal(minimalDescription('UPI test.person@upi 123456789012').includes('123456789012'),false);
});
test('PDF byte extraction runs end-to-end using an invented in-memory document',async()=>{
 const lines=['Axis Bank Credit Card','01/08/2026 - 31/08/2026','TRANSACTION DETAILS','01/08/2026 SAMPLE CAFE RESTAURANTS 100.00 Dr'];
 const stream='BT /F1 11 Tf 30 750 Td '+lines.map((line,index)=>(index?'0 -20 Td ':'')+'('+line+') Tj').join('\n')+' ET';
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`];
 let pdf='%PDF-1.4\n';const offsets=[0];for(const [i,obj] of objects.entries()){offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${obj}\nendobj\n`;}
 const xref=Buffer.byteLength(pdf);pdf+=`xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(offset=>String(offset).padStart(10,'0')+' 00000 n ').join('\n')}\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
 const bytes=new Uint8Array(Buffer.from(pdf));const parsed=await extractStatement(bytes);
 assert.equal(parsed.rows.length,1);assert.equal(parsed.rows[0].amount,10000);assert.equal(parsed.format,'axis-card');
 if(bytes.byteLength)bytes.fill(0); // same cleanup path as the upload action
});
