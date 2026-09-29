-- Sprint 12: opt-in, per-user feed metadata. No service-role/browser secrets.
create table public.news_sources (
 id text primary key, name text not null, category text not null check(category in ('Business','Technology','Finance')),
 region text not null, feed_url text not null, site_url text not null
);
insert into public.news_sources values
 ('bbc-business','BBC News — Business','Business','Global','https://feeds.bbci.co.uk/news/business/rss.xml','https://www.bbc.com/news/business'),
 ('bbc-technology','BBC News — Technology','Technology','Global','https://feeds.bbci.co.uk/news/technology/rss.xml','https://www.bbc.com/news/technology'),
 ('rbi-press','Reserve Bank of India — Releases','Finance','India','https://rbi.org.in/pressreleases_rss.xml','https://www.rbi.org.in/Scripts/rss.aspx'),
 ('fed-press','US Federal Reserve — Releases','Finance','Global / US','https://www.federalreserve.gov/feeds/press_all.xml','https://www.federalreserve.gov/feeds/feeds.htm');
create table public.user_news_sources (
 user_id uuid not null references auth.users(id) on delete cascade,
 source_id text not null references public.news_sources(id),
 enabled boolean not null default false,
 last_attempt_at timestamptz, last_success_at timestamptz,
 status text not null default 'idle' check(status in ('idle','collecting','success','error')),
 request_id uuid, imported_count integer not null default 0, skipped_count integer not null default 0,
 primary key(user_id,source_id)
);
create table public.news_articles (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 source_id text not null references public.news_sources(id),
 title text not null check(length(title) between 1 and 500),
 url text not null check(length(url) between 1 and 2048 and url like 'https://%'),
 published_at timestamptz not null, collected_at timestamptz not null default now(),
 unique(user_id,source_id,url)
);
create index news_articles_recent on public.news_articles(user_id,published_at desc);
alter table public.news_sources enable row level security;
alter table public.user_news_sources enable row level security;
alter table public.news_articles enable row level security;
create policy news_catalog_read on public.news_sources for select to authenticated using(true);
create policy news_preferences_own on public.user_news_sources for select to authenticated using(user_id=auth.uid());
create policy news_articles_own on public.news_articles for select to authenticated using(user_id=auth.uid() and published_at>=now()-interval '7 days');
revoke all on public.news_sources,public.user_news_sources,public.news_articles from anon,authenticated;
grant select on public.news_sources,public.user_news_sources,public.news_articles to authenticated;

create function public.set_news_source(p_source text,p_enabled boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 if p_enabled is null then raise exception 'Choose enabled status'; end if;
 insert into public.user_news_sources(user_id,source_id,enabled) values(auth.uid(),p_source,p_enabled)
 on conflict(user_id,source_id) do update set enabled=excluded.enabled,request_id=null,
 status=case when public.user_news_sources.status='collecting' then 'idle' else public.user_news_sources.status end;
end $$;

create function public.claim_news_source(p_source text) returns uuid
language plpgsql security definer set search_path='' as $$
declare token uuid:=gen_random_uuid(); claimed uuid;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 update public.user_news_sources set last_attempt_at=now(),request_id=token,status='collecting'
 where user_id=auth.uid() and source_id=p_source and enabled
 and (last_attempt_at is null or last_attempt_at<now()-interval '5 minutes')
 returning request_id into claimed;
 return claimed;
end $$;

create function public.finish_news_source(p_source text,p_request uuid,p_items jsonb,p_failed boolean,p_skipped integer) returns integer
language plpgsql security definer set search_path='' as $$
declare preference public.user_news_sources; item jsonb; n integer:=0; added integer; link text; published timestamptz;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 select * into preference from public.user_news_sources where user_id=auth.uid() and source_id=p_source for update;
 if not found or not preference.enabled or preference.request_id is distinct from p_request or p_request is null then raise exception 'Collection is no longer current'; end if;
 if p_failed is null or p_skipped is null or p_skipped<0 or p_skipped>500 or jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items)>50 then raise exception 'Invalid collection result'; end if;
 if p_failed and jsonb_array_length(p_items)>0 then raise exception 'Failure cannot contain articles'; end if;
 if not p_failed then
   for item in select value from jsonb_array_elements(p_items) loop
     link:=item->>'url';published:=(item->>'published_at')::timestamptz;
     if jsonb_typeof(item->'title') is distinct from 'string' or length(trim(item->>'title')) not between 1 and 500
       or jsonb_typeof(item->'url') is distinct from 'string' or length(link)>2048
       or published is null or published<now()-interval '7 days' or published>now()+interval '1 hour'
       or not (case when p_source in ('bbc-business','bbc-technology') then link~'^https://(www\.)?bbc\.(co\.uk|com)/'
                    when p_source='rbi-press' then link~'^https://(www\.)?rbi\.org\.in/'
                    when p_source='fed-press' then link~'^https://(www\.)?federalreserve\.gov/' else false end)
       then raise exception 'Invalid article metadata'; end if;
     insert into public.news_articles(user_id,source_id,title,url,published_at)
       values(auth.uid(),p_source,item->>'title',link,published)
       on conflict(user_id,source_id,url) do nothing;
     get diagnostics added=row_count;n:=n+added;
   end loop;
 end if;
 delete from public.news_articles where user_id=auth.uid() and published_at<now()-interval '7 days';
 update public.user_news_sources set request_id=null,status=case when p_failed then 'error' else 'success' end,
 last_success_at=case when p_failed then last_success_at else now() end,imported_count=n,skipped_count=p_skipped
 where user_id=auth.uid() and source_id=p_source;
 return n;
end $$;
revoke all on function public.set_news_source(text,boolean),public.claim_news_source(text),public.finish_news_source(text,uuid,jsonb,boolean,integer) from public,anon;
grant execute on function public.set_news_source(text,boolean),public.claim_news_source(text),public.finish_news_source(text,uuid,jsonb,boolean,integer) to authenticated;
