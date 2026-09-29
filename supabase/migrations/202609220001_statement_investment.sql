-- Add a manual investment treatment without changing already-classified records.
alter table public.statement_entries drop constraint statement_entries_kind_check;
alter table public.statement_entries add constraint statement_entries_kind_check
 check(kind in ('expense','emi','fee','emi_interest_included','refund','income','transfer','investment','card_payment','financed_purchase'));
alter table public.statement_entries drop constraint statement_entries_check;
alter table public.statement_entries add constraint statement_entries_check
 check((kind in ('expense','emi','fee','financed_purchase','emi_interest_included') and direction='debit')
 or (kind in ('refund','income') and direction='credit')
 or kind in ('transfer','investment','card_payment'));
