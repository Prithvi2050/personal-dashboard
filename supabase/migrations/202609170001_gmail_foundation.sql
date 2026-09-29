begin;
create table public.financial_senders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  sender_email text not null check (length(sender_email) <= 254 and sender_email=lower(sender_email) and sender_email ~ '^[a-z0-9][a-z0-9._%+\-]*@[a-z0-9][a-z0-9.\-]*\.[a-z0-9\-]+$'),
  sender_name text not null check(length(sender_name) between 1 and 100),
  institution text not null check(length(institution) between 1 and 100),
  enabled boolean not null default false,
  unique(user_id,sender_email)
);
alter table public.financial_senders enable row level security;
create policy financial_senders_read on public.financial_senders for select to authenticated using(user_id=(select auth.uid()));
revoke all on public.financial_senders from public,anon,authenticated;
grant select on public.financial_senders to authenticated;

create table public.gmail_connections (
  user_id uuid primary key references public.users(id) on delete cascade,
  id uuid not null unique default gen_random_uuid(),
  email text not null check(length(email) between 3 and 254),
  encrypted_refresh_token text not null check(length(encrypted_refresh_token) between 40 and 16000 and encrypted_refresh_token like 'v1.%'),
  created_at timestamptz not null default now(),
  next_check_at timestamptz not null default now()
);
alter table public.gmail_connections enable row level security;
create policy gmail_connections_read on public.gmail_connections for select to authenticated using(user_id=(select auth.uid()));
revoke all on public.gmail_connections from public,anon,authenticated;
-- The normal table API may expose connection metadata, never the token column.
grant select(user_id,id,email,created_at) on public.gmail_connections to authenticated;

create function public.save_financial_sender(p_id uuid,p_email text,p_name text,p_institution text,p_enabled boolean)
returns void language plpgsql security definer set search_path='' as $$
declare owner_id uuid:=auth.uid();
begin
  if owner_id is null then raise exception 'Sign in required'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('gmail-senders:'||owner_id::text,0));
  if p_id is null then
    if (select count(*) from public.financial_senders where user_id=owner_id)>=20 then raise exception 'Sender limit reached'; end if;
    insert into public.financial_senders(user_id,sender_email,sender_name,institution,enabled) values(owner_id,p_email,p_name,p_institution,p_enabled);
  else
    update public.financial_senders set sender_email=p_email,sender_name=p_name,institution=p_institution,enabled=p_enabled where id=p_id and user_id=owner_id;
    if not found then raise exception 'Sender unavailable'; end if;
  end if;
end; $$;
create function public.remove_financial_sender(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  delete from public.financial_senders where id=p_id and user_id=auth.uid();
  if not found then raise exception 'Sender unavailable'; end if;
end; $$;
create function public.connect_gmail(p_email text,p_ciphertext text) returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  -- No blind upsert: another mailbox cannot silently replace a current connection.
  insert into public.gmail_connections(user_id,email,encrypted_refresh_token) values(auth.uid(),p_email,p_ciphertext);
end; $$;
create function public.claim_gmail_check() returns text language plpgsql security definer set search_path='' as $$
declare cipher text;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  update public.gmail_connections set next_check_at=now()+interval '60 seconds'
    where user_id=auth.uid() and next_check_at<=now() returning encrypted_refresh_token into cipher;
  if cipher is null then raise exception 'Connect Gmail or wait one minute before checking again'; end if;
  return cipher;
end; $$;
create function public.disconnect_gmail(p_id uuid) returns text language plpgsql security definer set search_path='' as $$
declare cipher text;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  delete from public.gmail_connections where user_id=auth.uid() and id=p_id returning encrypted_refresh_token into cipher;
  return cipher;
end; $$;
revoke all on function public.save_financial_sender(uuid,text,text,text,boolean), public.remove_financial_sender(uuid), public.connect_gmail(text,text), public.claim_gmail_check(), public.disconnect_gmail(uuid) from public,anon,authenticated;
grant execute on function public.save_financial_sender(uuid,text,text,text,boolean), public.remove_financial_sender(uuid), public.connect_gmail(text,text), public.claim_gmail_check(), public.disconnect_gmail(uuid) to authenticated;
commit;
