-- Phase 1 · Migration 1 — Enums
-- Domain enumerations used across projects, tasks, and notifications.

create type urgency_level     as enum ('low','medium','high','urgent');
create type project_status    as enum ('active','on_hold','completed','archived');
create type task_status       as enum ('todo','in_progress','done');
create type notification_type as enum (
  'task_assigned',
  'task_due_soon',
  'task_status_changed',
  'project_due_soon',
  'mention'
);
