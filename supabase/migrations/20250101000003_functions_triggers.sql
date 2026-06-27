-- Phase 1 · Migration 3 — Functions & triggers
-- Mirrors auth users into profiles, maintains updated_at, the collaborator
-- helper used by checklist/link RLS, assignment notifications, and a generic
-- activity-log trigger attached to projects, tasks, and task_assignees.

-- ── mirror new auth users into profiles ─────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end; $$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ── updated_at maintenance ──────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger trg_projects_updated before update on public.projects
  for each row execute function public.set_updated_at();
create trigger trg_tasks_updated before update on public.tasks
  for each row execute function public.set_updated_at();
create trigger trg_events_updated before update on public.calendar_events
  for each row execute function public.set_updated_at();

-- ── collaborator check used by checklist/link RLS ───────────────────────────
create or replace function public.is_task_collaborator(p_task_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from tasks t
                 where t.id = p_task_id and t.created_by = auth.uid())
      or exists (select 1 from task_assignees a
                 where a.task_id = p_task_id and a.user_id = auth.uid());
$$;

-- ── notify assignee on assignment ───────────────────────────────────────────
create or replace function public.notify_task_assigned()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_name text;
begin
  select name into v_name from tasks where id = new.task_id;
  insert into notifications (user_id, type, title, body, entity_type, entity_id)
  values (new.user_id, 'task_assigned', 'New task assigned', v_name, 'task', new.task_id);
  return new;
end; $$;

create trigger trg_notify_task_assigned
after insert on public.task_assignees
for each row execute function public.notify_task_assigned();

-- ── generic activity logging ────────────────────────────────────────────────
-- Inserts an activity_log row on insert/update/delete of the attached tables.
-- Uses TG_OP to derive the action and auth.uid() as the actor. The before/after
-- diff (or the row snapshot) is stored in metadata. A status change on tasks is
-- recorded as the distinct 'status_changed' action.
create or replace function public.log_activity()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_actor       uuid := auth.uid();
  v_action      text;
  v_entity_type text := tg_argv[0];   -- 'project' | 'task' | 'assignee'
  v_entity_id   uuid;
  v_project_id  uuid;
  v_metadata    jsonb;
begin
  if tg_op = 'INSERT' then
    v_action := case when v_entity_type = 'assignee' then 'assigned' else 'created' end;
    v_metadata := jsonb_build_object('new', to_jsonb(new));
  elsif tg_op = 'UPDATE' then
    if v_entity_type = 'task' and new.status is distinct from old.status then
      v_action := 'status_changed';
    else
      v_action := 'updated';
    end if;
    v_metadata := jsonb_build_object('old', to_jsonb(old), 'new', to_jsonb(new));
  else -- DELETE
    v_action := case when v_entity_type = 'assignee' then 'unassigned' else 'deleted' end;
    v_metadata := jsonb_build_object('old', to_jsonb(old));
  end if;

  -- Resolve entity id and owning project per entity type.
  if v_entity_type = 'project' then
    v_entity_id  := coalesce(new.id, old.id);
    v_project_id := coalesce(new.id, old.id);
  elsif v_entity_type = 'task' then
    v_entity_id  := coalesce(new.id, old.id);
    v_project_id := coalesce(new.project_id, old.project_id);
  else -- assignee: keyed by task
    v_entity_id  := coalesce(new.task_id, old.task_id);
    select project_id into v_project_id from tasks where id = v_entity_id;
  end if;

  -- actor_id is NOT NULL; skip logging when there is no authenticated actor
  -- (e.g. service-role/cron writes), since those are not user activity.
  if v_actor is null then
    return coalesce(new, old);
  end if;

  insert into activity_log (actor_id, action, entity_type, entity_id, project_id, metadata)
  values (v_actor, v_action, v_entity_type, v_entity_id, v_project_id, v_metadata);

  return coalesce(new, old);
end; $$;

create trigger trg_activity_projects
after insert or update or delete on public.projects
for each row execute function public.log_activity('project');

create trigger trg_activity_tasks
after insert or update or delete on public.tasks
for each row execute function public.log_activity('task');

create trigger trg_activity_assignees
after insert or delete on public.task_assignees
for each row execute function public.log_activity('assignee');
