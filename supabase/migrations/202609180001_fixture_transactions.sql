-- Sprint 10 sandbox only. No Gmail messages or tokens are read by this migration.
create table public.transactions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.users(id) on delete cascade,
 source_mode text not null default 'fixture' check(source_mode = 'fixture'),
 email_message_id text not null check(email_message_id ~ '^fixture:[a-z0-9-]{1,60}$'),
 sender_email text not null check(sender_email = 'alerts@fixture-bank.example'),
 amount_minor bigint not null check(amount_minor between 1 and 99999999999),
 currency text not null check(currency in ('INR','USD','EUR')),
 merchant text not null check(length(trim(merchant)) between 1 and 100),
 merchant_key text not null check(length(trim(merchant_key)) between 1 and 120),
 normalized_merchant text not null check(length(trim(normalized_merchant)) between 1 and 100),
 category text not null check(category in ('Dining','Grocery','Shopping','Transport','Bills','Entertainment','Health','Travel','Household','Other')),
 transaction_time timestamptz not null check(transaction_time >= '2000-01-01' and transaction_time < '2101-01-01'),
 payment_method text not null check(payment_method in ('Card','UPI')),
 account_identifier text not null check(length(account_identifier) <= 40 and length(regexp_replace(account_identifier,'[^0-9]','','g')) <= 4),
 raw_description text not null check(length(raw_description) <= 200),
 classification_confidence double precision not null check(classification_confidence between 0 and 1),
 classification_source text not null check(classification_source in ('rule','known','ai','fallback')),
 original jsonb not null,
 revision integer not null default 0,
 corrected_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(user_id, source_mode, email_message_id)
);
create table public.merchant_rules (
 user_id uuid not null references public.users(id) on delete cascade,
 source_mode text not null default 'fixture' check(source_mode = 'fixture'),
 merchant_key text not null check(length(trim(merchant_key)) between 1 and 120),
 normalized_merchant text not null check(length(trim(normalized_merchant)) between 1 and 100),
 category text not null check(category in ('Dining','Grocery','Shopping','Transport','Bills','Entertainment','Health','Travel','Household','Other')),
 updated_at timestamptz not null default now(),
 primary key(user_id,source_mode,merchant_key)
);
create table public.transaction_corrections (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.users(id) on delete cascade,
 transaction_id uuid not null references public.transactions(id) on delete cascade,
 revision integer not null, before_values jsonb not null, after_values jsonb not null,
 created_at timestamptz not null default now(), unique(transaction_id,revision)
);
alter table public.transactions enable row level security;
alter table public.merchant_rules enable row level security;
alter table public.transaction_corrections enable row level security;
create policy own_transactions on public.transactions for select to authenticated using(user_id = (select auth.uid()));
create policy own_merchant_rules on public.merchant_rules for select to authenticated using(user_id = (select auth.uid()));
create policy own_transaction_corrections on public.transaction_corrections for select to authenticated using(user_id = (select auth.uid()));
revoke all on public.transactions, public.merchant_rules, public.transaction_corrections from anon, authenticated;
grant select on public.transactions, public.merchant_rules, public.transaction_corrections to authenticated;

create function public.import_fixture_transactions(p_items jsonb) returns integer
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); item jsonb; t public.transactions; rule public.merchant_rules; added integer := 0; affected integer;
begin
 if uid is null then raise exception 'Sign in required'; end if;
 if p_items is null or jsonb_typeof(p_items) <> 'array' then raise exception 'Invalid batch'; end if;
 if jsonb_array_length(p_items) > 20 or octet_length(p_items::text) > 30000 then raise exception 'Invalid batch'; end if;
 for item in select value from jsonb_array_elements(p_items) loop
  t := jsonb_populate_record(null::public.transactions, item);
  select * into rule from public.merchant_rules where user_id=uid and source_mode='fixture' and merchant_key=t.merchant_key;
  if found then
   t.normalized_merchant := rule.normalized_merchant; t.category := rule.category;
   t.classification_confidence := 1; t.classification_source := 'rule';
  end if;
  -- Whitelist the original structured facts; never preserve the supplied JSON wholesale.
  t.original := jsonb_build_object('email_message_id',t.email_message_id,'sender_email',t.sender_email,
   'amount_minor',t.amount_minor,'currency',t.currency,'merchant',t.merchant,'merchant_key',t.merchant_key,
   'normalized_merchant',t.normalized_merchant,'category',t.category,'transaction_time',t.transaction_time,
   'payment_method',t.payment_method,'account_identifier',t.account_identifier,'raw_description',t.raw_description,
   'classification_confidence',t.classification_confidence,'classification_source',t.classification_source);
  insert into public.transactions(user_id,email_message_id,sender_email,amount_minor,currency,merchant,merchant_key,normalized_merchant,category,transaction_time,payment_method,account_identifier,raw_description,classification_confidence,classification_source,original)
  values(uid,t.email_message_id,t.sender_email,t.amount_minor,t.currency,t.merchant,t.merchant_key,t.normalized_merchant,t.category,t.transaction_time,t.payment_method,t.account_identifier,t.raw_description,t.classification_confidence,t.classification_source,t.original)
  on conflict(user_id,source_mode,email_message_id) do nothing;
  get diagnostics affected = row_count; added := added + affected;
 end loop;
 return added;
end $$;

create function public.correct_fixture_transaction(p_id uuid,p_revision integer,p_merchant text,p_category text,p_time timestamptz,p_account text,p_description text,p_save_rule boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); previous public.transactions; current_row public.transactions;
begin
 if uid is null then raise exception 'Sign in required'; end if;
 select * into previous from public.transactions where id=p_id and user_id=uid and source_mode='fixture' for update;
 if not found then raise exception 'Transaction unavailable'; end if;
 if p_revision is null or previous.revision <> p_revision then raise exception 'Stale revision; refresh before editing'; end if;
 update public.transactions set normalized_merchant=trim(p_merchant),category=p_category,transaction_time=p_time,
 account_identifier=trim(p_account),raw_description=trim(p_description),revision=revision+1,corrected_at=now(),updated_at=now()
 where id=p_id returning * into current_row;
 insert into public.transaction_corrections(user_id,transaction_id,revision,before_values,after_values)
 values(uid,p_id,current_row.revision,
 jsonb_build_object('merchant',previous.normalized_merchant,'category',previous.category,'time',previous.transaction_time,'account',previous.account_identifier,'description',previous.raw_description),
 jsonb_build_object('merchant',current_row.normalized_merchant,'category',current_row.category,'time',current_row.transaction_time,'account',current_row.account_identifier,'description',current_row.raw_description));
 if p_save_rule then
  insert into public.merchant_rules(user_id,merchant_key,normalized_merchant,category) values(uid,previous.merchant_key,current_row.normalized_merchant,current_row.category)
  on conflict(user_id,source_mode,merchant_key) do update set normalized_merchant=excluded.normalized_merchant,category=excluded.category,updated_at=now();
 end if;
end $$;
create function public.remove_fixture_rule(p_key text) returns void
language plpgsql security definer set search_path = '' as $$
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 delete from public.merchant_rules where user_id=auth.uid() and source_mode='fixture' and merchant_key=p_key;
 if not found then raise exception 'Rule unavailable'; end if;
end $$;
revoke all on function public.import_fixture_transactions(jsonb),public.correct_fixture_transaction(uuid,integer,text,text,timestamptz,text,text,boolean),public.remove_fixture_rule(text) from public, anon;
grant execute on function public.import_fixture_transactions(jsonb),public.correct_fixture_transaction(uuid,integer,text,text,timestamptz,text,text,boolean),public.remove_fixture_rule(text) to authenticated;
