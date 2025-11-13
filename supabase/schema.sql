-- Enable required extensions
create extension if not exists "uuid-ossp";

-- Members table
create table if not exists public.members (
    id uuid primary key default uuid_generate_v4(),
    full_name text not null,
    email text not null unique,
    phone text,
    member_number text unique,
    join_date date not null,
    status text not null default 'active',
    profile_photo_url text,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

-- Meetings table
create table if not exists public.meetings (
    id uuid primary key default uuid_generate_v4(),
    meeting_date date not null,
    meeting_month text not null,
    meeting_year integer not null,
    location text,
    meeting_type text not null default 'business',
    notes text,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

-- Guests table
create table if not exists public.guests (
    id uuid primary key default uuid_generate_v4(),
    full_name text not null,
    email text,
    phone text,
    first_attendance date,
    invited_by uuid references public.members(id),
    status text not null default 'active',
    total_meetings integer not null default 0,
    notes text,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

-- Pipeliners table
create table if not exists public.pipeliners (
    id uuid primary key default uuid_generate_v4(),
    full_name text not null,
    email text,
    phone text,
    promoted_from_guest_date date,
    guest_meetings_count integer not null default 3,
    business_meetings_count integer not null default 0,
    charity_events_count integer not null default 0,
    is_eligible_for_membership boolean not null default false,
    status text not null default 'active',
    sponsored_by uuid references public.members(id),
    notes text,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

-- Meetings attendance table
create table if not exists public.attendance (
    id uuid primary key default uuid_generate_v4(),
    meeting_id uuid not null references public.meetings(id) on delete cascade,
    member_id uuid references public.members(id) on delete cascade,
    guest_id uuid references public.guests(id) on delete cascade,
    pipeliner_id uuid references public.pipeliners(id) on delete cascade,
    status text not null check (status in ('present', 'apology', 'absent')),
    notes text,
    created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists attendance_meeting_member_key
    on public.attendance (meeting_id, member_id)
    where member_id is not null;

create unique index if not exists attendance_meeting_guest_key
    on public.attendance (meeting_id, guest_id)
    where guest_id is not null;

create unique index if not exists attendance_meeting_pipeliner_key
    on public.attendance (meeting_id, pipeliner_id)
    where pipeliner_id is not null;

-- Charity events table
create table if not exists public.charity_events (
    id uuid primary key default uuid_generate_v4(),
    event_name text not null,
    event_date date not null,
    description text,
    participant_ids uuid[],
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

-- Guest events table
create table if not exists public.guest_events (
    id uuid primary key default uuid_generate_v4(),
    guest_id uuid not null references public.guests(id) on delete cascade,
    event_name text not null,
    event_date date not null,
    contribution text,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

-- Enable Row Level Security and grant authenticated access policies
alter table public.members enable row level security;
alter table public.meetings enable row level security;
alter table public.attendance enable row level security;
alter table public.guests enable row level security;
alter table public.pipeliners enable row level security;
alter table public.charity_events enable row level security;
alter table public.guest_events enable row level security;

-- App settings table
create table if not exists public.app_settings (
    key text primary key,
    value integer,
    text_value text,
    updated_at timestamptz not null default timezone('utc', now())
);

alter table public.app_settings enable row level security;

create policy "Authenticated access to members"
    on public.members
    for all
    using (auth.role() = 'authenticated')
    with check (auth.role() = 'authenticated');

create policy "Authenticated access to meetings"
    on public.meetings
    for all
    using (auth.role() = 'authenticated')
    with check (auth.role() = 'authenticated');

create policy "Authenticated access to attendance"
    on public.attendance
    for all
    using (auth.role() = 'authenticated')
    with check (auth.role() = 'authenticated');

create policy "Authenticated access to guests"
    on public.guests
    for all
    using (auth.role() = 'authenticated')
    with check (auth.role() = 'authenticated');

create policy "Authenticated access to pipeliners"
    on public.pipeliners
    for all
    using (auth.role() = 'authenticated')
    with check (auth.role() = 'authenticated');

create policy "Authenticated access to charity events"
    on public.charity_events
    for all
    using (auth.role() = 'authenticated')
    with check (auth.role() = 'authenticated');

create policy "Authenticated access to guest events"
    on public.guest_events
    for all
    using (auth.role() = 'authenticated')
    with check (auth.role() = 'authenticated');

create policy "Authenticated access to app settings"
    on public.app_settings
    for all
    using (auth.role() = 'authenticated')
    with check (auth.role() = 'authenticated');

-- Views
create or replace view public.member_attendance_summary as
with member_stats as (
    select
        a.member_id,
        count(*) as total_meetings,
        count(*) filter (where a.status = 'present') as present_count,
        count(*) filter (where a.status = 'apology') as apology_count,
        count(*) filter (where a.status = 'absent') as absent_count,
        max(m.meeting_date) as last_meeting_date
    from public.attendance a
    join public.meetings m on m.id = a.meeting_id
    where a.member_id is not null
    group by a.member_id
)
select
    mem.id,
    mem.full_name,
    mem.email,
    mem.phone,
    mem.member_number,
    mem.join_date,
    mem.status,
    mem.profile_photo_url,
    mem.created_at,
    mem.updated_at,
    coalesce(ms.total_meetings, 0) as total_meetings,
    coalesce(ms.present_count, 0) as present_count,
    coalesce(ms.apology_count, 0) as apology_count,
    coalesce(ms.absent_count, 0) as absent_count,
    ms.last_meeting_date
from public.members mem
left join member_stats ms on ms.member_id = mem.id;

create or replace view public.guest_meeting_counts as
with guest_stats as (
    select
        a.guest_id,
        count(*) as total_attendance,
        count(*) filter (where a.status = 'present') as present_count,
        count(*) filter (where a.status = 'apology') as apology_count,
        count(*) filter (where a.status = 'absent') as absent_count
    from public.attendance a
    where a.guest_id is not null
    group by a.guest_id
),
event_stats as (
    select
        ge.guest_id,
        count(*) as event_count
    from public.guest_events ge
    group by ge.guest_id
)
select
    g.id,
    g.full_name,
    g.email,
    g.phone,
    g.first_attendance,
    g.invited_by,
    g.status,
    g.total_meetings,
    g.notes,
    g.created_at,
    g.updated_at,
    coalesce(gs.total_attendance, 0) as meeting_count,
    coalesce(gs.present_count, 0) as present_count,
    coalesce(gs.apology_count, 0) as apology_count,
    coalesce(gs.absent_count, 0) as absent_count,
    coalesce(es.event_count, 0) as event_count,
    (coalesce(gs.present_count, 0) >= 3 and coalesce(es.event_count, 0) >= 1) as eligible_for_pipeliner
from public.guests g
left join guest_stats gs on gs.guest_id = g.id
left join event_stats es on es.guest_id = g.id;

create or replace view public.pipeliner_eligibility as
with meeting_stats as (
    select
        a.pipeliner_id,
        count(*) filter (where a.status = 'present') as meeting_count
    from public.attendance a
    where a.pipeliner_id is not null
    group by a.pipeliner_id
),
charity_stats as (
    select
        participant_id as pipeliner_id,
        count(*) as charity_event_count
    from (
        select unnest(coalesce(ce.participant_ids, '{}'::uuid[])) as participant_id
        from public.charity_events ce
    ) participants
    group by participant_id
)
select
    p.id,
    p.full_name,
    p.email,
    p.phone,
    p.promoted_from_guest_date,
    p.guest_meetings_count,
    p.business_meetings_count,
    p.charity_events_count,
    p.is_eligible_for_membership,
    p.status,
    p.sponsored_by,
    p.notes,
    p.created_at,
    p.updated_at,
    coalesce(ms.meeting_count, 0) as meeting_count,
    coalesce(cs.charity_event_count, 0) as charity_event_count,
    (coalesce(ms.meeting_count, 0) >= 3 and coalesce(cs.charity_event_count, 0) >= 1) as meets_requirements
from public.pipeliners p
left join meeting_stats ms on ms.pipeliner_id = p.id
left join charity_stats cs on cs.pipeliner_id = p.id;

-- Helper functions for triggers
create or replace function public.refresh_guest_meeting_count(p_guest_id uuid)
returns void
language plpgsql
as $$
declare
    meeting_count integer;
begin
    select count(*)
    into meeting_count
    from public.attendance a
    where a.guest_id = p_guest_id
      and a.status = 'present';

    update public.guests
    set total_meetings = coalesce(meeting_count, 0),
        updated_at = timezone('utc', now())
    where id = p_guest_id;
end;
$$;

create or replace function public.update_guest_meeting_count()
returns trigger
language plpgsql
as $$
begin
    if (tg_op = 'INSERT') then
        if new.guest_id is not null then
            perform public.refresh_guest_meeting_count(new.guest_id);
        end if;
    elsif (tg_op = 'UPDATE') then
        if new.guest_id is not null then
            perform public.refresh_guest_meeting_count(new.guest_id);
        end if;
        if old.guest_id is not null and old.guest_id <> new.guest_id then
            perform public.refresh_guest_meeting_count(old.guest_id);
        end if;
    elsif (tg_op = 'DELETE') then
        if old.guest_id is not null then
            perform public.refresh_guest_meeting_count(old.guest_id);
        end if;
    end if;
    return null;
end;
$$;

create or replace function public.refresh_pipeliner_eligibility(p_pipeliner_id uuid)
returns void
language plpgsql
as $$
declare
    meeting_count integer;
    charity_event_count integer;
begin
    select count(*)
    into meeting_count
    from public.attendance a
    where a.pipeliner_id = p_pipeliner_id
      and a.status = 'present';

    select count(*)
    into charity_event_count
    from public.charity_events ce
    where coalesce(ce.participant_ids, '{}'::uuid[]) @> array[p_pipeliner_id];

    update public.pipeliners
    set business_meetings_count = coalesce(meeting_count, 0),
        charity_events_count = coalesce(charity_event_count, 0),
        is_eligible_for_membership = (coalesce(meeting_count, 0) >= 3 and coalesce(charity_event_count, 0) >= 1),
        updated_at = timezone('utc', now())
    where id = p_pipeliner_id;
end;
$$;

create or replace function public.update_pipeliner_eligibility()
returns trigger
language plpgsql
as $$
begin
    if (tg_op = 'INSERT') then
        if new.pipeliner_id is not null then
            perform public.refresh_pipeliner_eligibility(new.pipeliner_id);
        end if;
    elsif (tg_op = 'UPDATE') then
        if new.pipeliner_id is not null then
            perform public.refresh_pipeliner_eligibility(new.pipeliner_id);
        end if;
        if old.pipeliner_id is not null and old.pipeliner_id <> new.pipeliner_id then
            perform public.refresh_pipeliner_eligibility(old.pipeliner_id);
        end if;
    elsif (tg_op = 'DELETE') then
        if old.pipeliner_id is not null then
            perform public.refresh_pipeliner_eligibility(old.pipeliner_id);
        end if;
    end if;
    return null;
end;
$$;

create or replace function public.update_pipeliner_eligibility_from_charity()
returns trigger
language plpgsql
as $$
declare
    pipeliner uuid;
begin
    if (tg_op = 'INSERT') then
        foreach pipeliner in array coalesce(new.participant_ids, '{}'::uuid[]) loop
            perform public.refresh_pipeliner_eligibility(pipeliner);
        end loop;
    elsif (tg_op = 'UPDATE') then
        foreach pipeliner in array coalesce(old.participant_ids, '{}'::uuid[]) loop
            perform public.refresh_pipeliner_eligibility(pipeliner);
        end loop;
        foreach pipeliner in array coalesce(new.participant_ids, '{}'::uuid[]) loop
            perform public.refresh_pipeliner_eligibility(pipeliner);
        end loop;
    elsif (tg_op = 'DELETE') then
        foreach pipeliner in array coalesce(old.participant_ids, '{}'::uuid[]) loop
            perform public.refresh_pipeliner_eligibility(pipeliner);
        end loop;
    end if;

    return null;
end;
$$;

-- Triggers
create trigger trg_update_guest_meeting_count
after insert or update or delete on public.attendance
for each row execute function public.update_guest_meeting_count();

create trigger trg_update_pipeliner_eligibility
after insert or update or delete on public.attendance
for each row execute function public.update_pipeliner_eligibility();

create trigger trg_update_pipeliner_eligibility_charity
after insert or update or delete on public.charity_events
for each row execute function public.update_pipeliner_eligibility_from_charity();

