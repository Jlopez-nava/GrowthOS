-- GrowthOS A/B. No service-role key is required by the frontend.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.workspaces (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id),
 profile jsonb not null check (jsonb_typeof(profile)='object' and length(profile->>'name') between 1 and 100),
 rules jsonb not null check ((rules->>'window')::int in (7,28)),
 revision integer not null default 0,
 created_at timestamptz not null default now()
);
create table public.memberships (
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null check (role in ('owner','editor','viewer')),
 primary key(workspace_id,user_id)
);
alter table public.workspaces enable row level security;
alter table public.memberships enable row level security;
create policy own_membership on public.memberships for select to authenticated using(user_id=(select auth.uid()));
-- Bootstrap uses the immutable owner column, not user-controlled JWT metadata.
create policy owner_adds_members on public.memberships for insert to authenticated with check(exists(select 1 from public.workspaces w where w.id=workspace_id and w.owner_id=(select auth.uid())));
create function private.is_member(w uuid, writing boolean default false) returns boolean
 language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.memberships m where m.workspace_id=w and m.user_id=(select auth.uid()) and (not writing or m.role in ('owner','editor')))
$$;
revoke all on function private.is_member(uuid,boolean) from public;
grant execute on function private.is_member(uuid,boolean) to authenticated;
create policy workspace_read on public.workspaces for select to authenticated using(owner_id=(select auth.uid()) or private.is_member(id));
create policy workspace_create on public.workspaces for insert to authenticated with check(owner_id=(select auth.uid()));
create policy workspace_write on public.workspaces for update to authenticated using(private.is_member(id,true)) with check(private.is_member(id,true));
-- owner_id cannot be transferred through a browser write.
create function private.protect_owner() returns trigger language plpgsql set search_path='' as $$
begin if new.owner_id<>old.owner_id or new.id<>old.id then raise exception 'Workspace identity is immutable'; end if; return new; end $$;
create trigger immutable_owner before update on public.workspaces for each row execute function private.protect_owner();
revoke all on public.workspaces,public.memberships from anon,authenticated;
grant select,insert,update on public.workspaces to authenticated;
grant select,insert on public.memberships to authenticated;

create table public.imports (
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 id uuid not null,
 payload jsonb not null check (jsonb_typeof(payload)='object' and payload->>'status' in ('imported','failed')),
 primary key(workspace_id,id)
);
create unique index unique_import_fingerprint on public.imports(workspace_id,(payload->>'fingerprint')) where payload->>'status'='imported';
create table public.daily_metrics (
 workspace_id uuid not null,
 id uuid not null,
 import_id uuid generated always as ((payload->>'importId')::uuid) stored,
 source text generated always as (payload->>'source') stored,
 account text generated always as (payload->>'account') stored,
 report_date text generated always as (payload->>'date') stored,
 entity text generated always as (payload->>'entity') stored,
 payload jsonb not null check (payload->>'source' in ('ga4','gsc','ads') and payload->>'grain'='date_entity' and payload->>'date' ~ '^\d{4}-\d{2}-\d{2}$' and length(payload->>'entity')>0),
 primary key(workspace_id,id),
 foreign key(workspace_id,import_id) references public.imports(workspace_id,id),
 unique(workspace_id,source,account,report_date,entity)
);
create table public.recommendations (
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 id uuid not null,
 payload jsonb not null check (payload->>'status' in ('open','reviewed','dismissed','implemented','superseded')),
 primary key(workspace_id,id)
);
create table public.drafts (
 workspace_id uuid not null,
 id uuid not null,
 recommendation_id uuid generated always as ((payload->>'recommendationId')::uuid) stored,
 payload jsonb not null check(jsonb_array_length(payload->'versions')>0),
 primary key(workspace_id,id),
 foreign key(workspace_id,recommendation_id) references public.recommendations(workspace_id,id)
);
create table public.decisions (
 workspace_id uuid not null,
 id uuid not null,
 recommendation_id uuid generated always as ((payload->>'recommendationId')::uuid) stored,
 payload jsonb not null,
 primary key(workspace_id,id),
 foreign key(workspace_id,recommendation_id) references public.recommendations(workspace_id,id)
);
create table public.measurement_plans (
 workspace_id uuid not null,
 id uuid not null,
 recommendation_id uuid generated always as ((payload->>'recommendationId')::uuid) stored,
 payload jsonb not null,
 primary key(workspace_id,id),
 foreign key(workspace_id,recommendation_id) references public.recommendations(workspace_id,id)
);
create table public.brand_documents (
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 id uuid not null,
 payload jsonb not null,
 primary key(workspace_id,id)
);
-- Each table has explicit grants and workspace policies. Source-specific views retain RLS.
do $$ declare t text; begin
 foreach t in array array['imports','daily_metrics','recommendations','drafts','decisions','measurement_plans','brand_documents'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon, authenticated',t);
 execute format('grant select, insert on public.%I to authenticated',t);
 execute format('create policy workspace_read on public.%I for select to authenticated using (private.is_member(workspace_id))',t);
 execute format('create policy workspace_insert on public.%I for insert to authenticated with check (private.is_member(workspace_id,true))',t);
 end loop;
 foreach t in array array['recommendations','drafts','measurement_plans'] loop
 execute format('grant update on public.%I to authenticated',t);
 execute format('create policy workspace_update on public.%I for update to authenticated using (private.is_member(workspace_id,true)) with check (private.is_member(workspace_id,true))',t);
 end loop;
end $$;
create view public.ga4_daily_metrics with (security_invoker=true) as select * from public.daily_metrics where source='ga4';
create view public.search_console_daily_metrics with (security_invoker=true) as select * from public.daily_metrics where source='gsc';
create view public.google_ads_daily_metrics with (security_invoker=true) as select * from public.daily_metrics where source='ads';
grant select on public.ga4_daily_metrics,public.search_console_daily_metrics,public.google_ads_daily_metrics to authenticated;

create function private.validate_evidence() returns trigger language plpgsql security invoker set search_path='' as $$
declare evidence_id text; refs jsonb;
begin
 refs:=case when tg_table_name='recommendations' then new.payload->'evidenceIds' else new.payload->'sourceIds' end;
 if refs is null or jsonb_typeof(refs)<>'array' or jsonb_array_length(refs)=0 then raise exception 'Evidence is required'; end if;
 for evidence_id in select jsonb_array_elements_text(refs) loop
 if not exists(select 1 from public.daily_metrics where workspace_id=new.workspace_id and id=evidence_id::uuid) then raise exception 'Invalid workspace evidence reference'; end if;
 end loop;
 if tg_op='UPDATE' and new.workspace_id<>old.workspace_id then raise exception 'Workspace references are immutable'; end if;
 return new;
end $$;
create trigger check_recommendation_evidence before insert or update on public.recommendations for each row execute function private.validate_evidence();
create trigger check_draft_evidence before insert or update on public.drafts for each row execute function private.validate_evidence();

create function public.create_workspace(p_profile jsonb,p_rules jsonb) returns uuid
language plpgsql security invoker set search_path='' as $$
declare w uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 insert into public.workspaces(owner_id,profile,rules) values(auth.uid(),p_profile,p_rules) returning id into w;
 insert into public.memberships(workspace_id,user_id,role) values(w,auth.uid(),'owner');
 return w;
end $$;
create function public.save_workspace(p_workspace uuid,p_expected_revision integer,p_state jsonb) returns integer
language plpgsql security invoker set search_path='' as $$
declare rev integer; t text; field text; item jsonb;
begin
 if auth.uid() is null or not private.is_member(p_workspace,true) then raise exception 'Workspace access denied'; end if;
 if p_state->>'mode'<>'cloud' or p_state->>'id'<>p_workspace::text then raise exception 'Invalid workspace scope'; end if;
 if octet_length(p_state::text)>10000000 then raise exception 'Workspace transaction exceeds 10 MB'; end if;
 select revision into rev from public.workspaces where id=p_workspace for update;
 if rev is null then raise exception 'Workspace access denied'; end if;
 if rev<>p_expected_revision then raise exception 'Workspace changed in another session. Reload before saving.'; end if;
 for t,field in select * from (values ('imports','imports'),('daily_metrics','metrics'),('recommendations','recommendations'),('drafts','drafts'),('decisions','decisions'),('measurement_plans','measurements'),('brand_documents','brandVersions')) as x(t,f) loop
 for item in select jsonb_array_elements(p_state->field) loop
 if t in ('recommendations','drafts','measurement_plans') then
 execute format('insert into public.%I(workspace_id,id,payload) values($1,$2,$3) on conflict(workspace_id,id) do update set payload=excluded.payload',t) using p_workspace,(item->>'id')::uuid,item;
 else
 execute format('insert into public.%I(workspace_id,id,payload) values($1,$2,$3) on conflict(workspace_id,id) do nothing',t) using p_workspace,(item->>'id')::uuid,item;
 end if;
 end loop;
 end loop;
 -- Replace transient open recommendations no longer supported by the new analysis with an archived state.
 update public.recommendations set payload=jsonb_set(payload,'{status}','"superseded"')
 where workspace_id=p_workspace and payload->>'status'='open'
 and not exists(select 1 from jsonb_array_elements(p_state->'recommendations') r where r->>'id'=recommendations.id::text);
 update public.workspaces set profile=p_state->'profile',rules=p_state->'rules',revision=revision+1 where id=p_workspace;
 return rev+1;
end $$;
revoke all on function public.create_workspace(jsonb,jsonb),public.save_workspace(uuid,integer,jsonb) from public;
grant execute on function public.create_workspace(jsonb,jsonb),public.save_workspace(uuid,integer,jsonb) to authenticated;

-- A private bucket reserved for future raw-file retention. Stage B stores parsed records only.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('growthos-private','growthos-private',false,2000000,array['text/csv','application/json']) on conflict(id) do nothing;
create policy growthos_file_read on storage.objects for select to authenticated using(bucket_id='growthos-private' and private.is_member(((storage.foldername(name))[1])::uuid));
create policy growthos_file_insert on storage.objects for insert to authenticated with check(bucket_id='growthos-private' and private.is_member(((storage.foldername(name))[1])::uuid,true));

-- Reject invalid or incompatible records even if a caller bypasses the browser validator.
create function private.validate_metric() returns trigger language plpgsql security invoker set search_path='' as $$
declare k text; n numeric; report jsonb;
begin
 if new.id::text<>new.payload->>'id' then raise exception 'Metric identity mismatch'; end if;
 if (new.payload->>'date')::date::text<>new.payload->>'date' then raise exception 'Invalid date'; end if;
 select payload into report from public.imports where workspace_id=new.workspace_id and id=(new.payload->>'importId')::uuid;
 if report is null or report->>'status'<>'imported' then raise exception 'Valid source import required'; end if;
 foreach k in array array['source','account','currency','timezone','definition'] loop
 if (new.payload->>k) is null or (new.payload->>k) is distinct from (report->>k) then raise exception 'Metric metadata does not match source import'; end if;
 end loop;
 foreach k in array array['sessions','conversions','spend','clicks','impressions'] loop
 if not (new.payload ? k) then raise exception 'Missing metric keys must be explicit null'; end if;
 if new.payload->k<>'null'::jsonb then
 if jsonb_typeof(new.payload->k)<>'number' then raise exception 'Metric must be numeric or null'; end if;
 n:=(new.payload->>k)::numeric; if n<0 or n>1000000000000 then raise exception 'Metric outside supported range'; end if;
 end if;
 end loop;
 if new.payload->>'source'='ga4' and (new.payload->>'conversions')::numeric>(new.payload->>'sessions')::numeric then raise exception 'Converted sessions exceed sessions'; end if;
 if (new.payload->>'clicks')::numeric>(new.payload->>'impressions')::numeric then raise exception 'Clicks exceed impressions'; end if;
 return new;
end $$;
create trigger validate_source_metric before insert on public.daily_metrics for each row execute function private.validate_metric();
create function private.validate_import() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.id::text<>new.payload->>'id' then raise exception 'Import identity mismatch'; end if;
 if new.payload->>'status'='imported' then
 if exists(select 1 from public.imports i where i.workspace_id=new.workspace_id and i.payload->>'status'='imported' and i.payload->>'source'=new.payload->>'source' and i.payload->>'account'=new.payload->>'account' and ((i.payload->>'currency') is distinct from (new.payload->>'currency') or (i.payload->>'timezone') is distinct from (new.payload->>'timezone') or (i.payload->>'definition') is distinct from (new.payload->>'definition'))) then raise exception 'Incompatible report metadata for source account'; end if;
 end if;
 return new;
end $$;
create trigger validate_source_import before insert on public.imports for each row execute function private.validate_import();

create function private.validate_draft_versions() returns trigger language plpgsql security invoker set search_path='' as $$
declare old_count integer; new_count integer; i integer;
begin
 new_count:=jsonb_array_length(new.payload->'versions');
 if new.id::text<>new.payload->>'id' then raise exception 'Draft identity mismatch'; end if;
 for i in 0..new_count-1 loop
 if (new.payload->'versions'->i->>'version')::integer<>i+1 then raise exception 'Draft versions must be sequential'; end if;
 end loop;
 if new.payload->'reviewedVersion'<>'null'::jsonb and (new.payload->>'reviewedVersion')::integer<>new_count then raise exception 'Review must bind to the current exact version'; end if;
 if tg_op='UPDATE' then
 old_count:=jsonb_array_length(old.payload->'versions');
 if new_count<old_count or new_count>old_count+1 then raise exception 'Append one draft version at a time'; end if;
 for i in 0..old_count-1 loop
 if new.payload->'versions'->i is distinct from old.payload->'versions'->i then raise exception 'Prior draft versions are immutable'; end if;
 end loop;
 if new_count>old_count and new.payload->'reviewedVersion'<>'null'::jsonb then raise exception 'New draft version invalidates review'; end if;
 end if;
 return new;
end $$;
create trigger validate_draft_version_history before insert or update on public.drafts for each row execute function private.validate_draft_versions();
