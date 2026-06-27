-- Phase 1 · Migration 5 — Reporting views & RPC
-- Views MUST be security_invoker = on so personal-table RLS (attendance) is
-- respected: a user only ever aggregates rows they are allowed to read.

-- total effort time per task (sums overlapping entries; running entries count
-- up to now). This is the ONLY correct source of "total task time".
create view public.v_task_total_time with (security_invoker = on) as
select task_id,
       coalesce(sum(extract(epoch from (coalesce(ended_at, now()) - started_at)))::bigint, 0) as total_seconds
from public.task_time_entries
group by task_id;

-- daily attendance per user (worked + extra over 8h), grouped by IST date.
-- This is the ONLY source of "hours worked" — never derived from task timers.
create view public.v_daily_attendance with (security_invoker = on) as
select user_id, ist_date,
       coalesce(sum(extract(epoch from (coalesce(check_out_at, now()) - check_in_at)))::bigint, 0) as worked_seconds,
       greatest(
         0,
         coalesce(sum(extract(epoch from (coalesce(check_out_at, now()) - check_in_at)))::bigint, 0) - 8 * 3600
       ) as extra_seconds
from public.attendance_sessions
group by user_id, ist_date;

-- dashboard counts (flat/team-wide via RLS). security invoker so the caller's
-- RLS applies to the underlying selects.
create or replace function public.get_my_dashboard()
returns json language sql stable security invoker set search_path = public as $$
  select json_build_object(
    'total_tasks',   (select count(*) from tasks),
    'urgent_tasks',  (select count(*) from tasks where urgency in ('high','urgent') and status <> 'done'),
    'pending_tasks', (select count(*) from tasks where status <> 'done'),
    'project_count', (select count(*) from projects where status = 'active')
  );
$$;
