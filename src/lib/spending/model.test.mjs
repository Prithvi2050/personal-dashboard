import test from 'node:test';
import assert from 'node:assert/strict';
import { amountMinor, timestamp, merchantKey, classifyMerchant, prepareFixtures, fixtureEmails, fixtureSender, parseCorrection } from './model.ts';
test('money uses integer minor units and rejects ambiguous amounts', () => {
 assert.equal(amountMinor('19.99'),1999);
 for(const value of ['0.00','-1.00','1,000.00','1.234','01.00','1000000000.00']) assert.throws(()=>amountMinor(value));
});
test('dates preserve offsets and reject impossible calendar dates', () => {
 assert.equal(timestamp('2026-09-18T08:30:00+05:30'),'2026-09-18T03:00:00.000Z');
 for(const value of ['2026-02-30T10:00:00Z','2026-09-18T25:00:00Z','2026-09-18T10:00:00+15:00','2026-09-18']) assert.throws(()=>timestamp(value));
});
test('fixture pipeline only accepts approved synthetic debits and deduplicates', async()=>{
 const result=await prepareFixtures(fixtureEmails,[fixtureSender]);
 assert.equal(result.items.length,3); assert.equal(result.rejected,3); assert.equal(result.duplicates,1);
 assert.equal(result.items[0].amount_minor,84500);
 assert.equal(result.items[2].category,'Other');
 assert.equal((await prepareFixtures(fixtureEmails,[])).items.length,0);
 assert.equal((await prepareFixtures([{...fixtureEmails[0],synthetic:false}],[fixtureSender])).items.length,0);
 assert.equal(JSON.stringify(result).includes('Card ending'),false);
});
test('classification precedence is rules, known merchants, optional classifier, Other',async()=>{
 let calls=0; const adapter={classify:async()=>{calls++;return {category:'Shopping',confidence:0.8};}};
 const rules=[{merchant_key:'sample cafe',normalized_merchant:'My Cafe',category:'Travel'}];
 assert.equal((await classifyMerchant('SAMPLE CAFE #001',rules,adapter)).source,'rule');
 assert.equal((await classifyMerchant('SAMPLE CAFE #002',[],adapter)).source,'known'); assert.equal(calls,0);
 assert.equal((await classifyMerchant('Unknown store',[],adapter)).source,'ai'); assert.equal(calls,1);
 for(const response of [{category:'Invalid',confidence:1},{category:'Travel',confidence:0.2},null,{category:'Travel',confidence:NaN}]) assert.equal((await classifyMerchant('Unknown store',[],{classify:async()=>response})).source,'fallback');
 assert.equal((await classifyMerchant('Unknown store',[],{classify:async()=>{throw Error('offline');}})).category,'Other');
 assert.notEqual(merchantKey('Unknown 001'),merchantKey('Unknown 002'));
});
test('corrections validate input and prevent full account numbers',()=>{
 const form=new FormData();
 Object.entries({id:'11111111-1111-4111-8111-111111111111',revision:'0',normalized_merchant:'Cafe',category:'Dining',transaction_time:'2026-09-18T03:00',account_identifier:'Card 1234',raw_description:'Example',save_rule:'yes'}).forEach(([key,value])=>form.set(key,value));
 assert.equal(parseCorrection(form).time,'2026-09-18T03:00:00.000Z'); assert.equal(parseCorrection(form).saveRule,true);
 form.set('account_identifier','123456789'); assert.throws(()=>parseCorrection(form));
 form.set('account_identifier','Card 1234'); form.set('revision',''); assert.throws(()=>parseCorrection(form));
});
