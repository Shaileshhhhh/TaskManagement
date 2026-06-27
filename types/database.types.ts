// ─────────────────────────────────────────────────────────────────────────────
// Supabase database types.
//
// NOTE: This file is normally produced by:
//   supabase gen types typescript --local > types/database.types.ts
// It was hand-authored in Phase 1 to match supabase/migrations/* exactly,
// because the local Supabase container / a linked project was not available at
// build time. REGENERATE it with the command above once Supabase is connected,
// then commit any diff. Keep it in sync with the migrations — it is the typed
// contract every query and route relies on.
// ─────────────────────────────────────────────────────────────────────────────

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          avatar_url: string | null;
          email: string | null;
          created_at: string;
          updated_at: string | null;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          avatar_url?: string | null;
          email?: string | null;
          created_at?: string;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          email?: string | null;
          created_at?: string;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      projects: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          start_date: string | null;
          end_date: string | null;
          deadline: string | null;
          urgency: Database["public"]["Enums"]["urgency_level"];
          status: Database["public"]["Enums"]["project_status"];
          color: string | null;
          owner_id: string;
          created_at: string;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          start_date?: string | null;
          end_date?: string | null;
          deadline?: string | null;
          urgency?: Database["public"]["Enums"]["urgency_level"];
          status?: Database["public"]["Enums"]["project_status"];
          color?: string | null;
          owner_id: string;
          created_at?: string;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string | null;
          start_date?: string | null;
          end_date?: string | null;
          deadline?: string | null;
          urgency?: Database["public"]["Enums"]["urgency_level"];
          status?: Database["public"]["Enums"]["project_status"];
          color?: string | null;
          owner_id?: string;
          created_at?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "projects_owner_id_fkey";
            columns: ["owner_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      tasks: {
        Row: {
          id: string;
          project_id: string;
          name: string;
          description: string | null;
          start_date: string | null;
          end_date: string | null;
          deadline: string | null;
          urgency: Database["public"]["Enums"]["urgency_level"];
          status: Database["public"]["Enums"]["task_status"];
          color: string | null;
          created_by: string;
          created_at: string;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          project_id: string;
          name: string;
          description?: string | null;
          start_date?: string | null;
          end_date?: string | null;
          deadline?: string | null;
          urgency?: Database["public"]["Enums"]["urgency_level"];
          status?: Database["public"]["Enums"]["task_status"];
          color?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          project_id?: string;
          name?: string;
          description?: string | null;
          start_date?: string | null;
          end_date?: string | null;
          deadline?: string | null;
          urgency?: Database["public"]["Enums"]["urgency_level"];
          status?: Database["public"]["Enums"]["task_status"];
          color?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "tasks_project_id_fkey";
            columns: ["project_id"];
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tasks_created_by_fkey";
            columns: ["created_by"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      task_assignees: {
        Row: {
          task_id: string;
          user_id: string;
          assigned_by: string;
          assigned_at: string;
        };
        Insert: {
          task_id: string;
          user_id: string;
          assigned_by: string;
          assigned_at?: string;
        };
        Update: {
          task_id?: string;
          user_id?: string;
          assigned_by?: string;
          assigned_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "task_assignees_task_id_fkey";
            columns: ["task_id"];
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "task_assignees_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "task_assignees_assigned_by_fkey";
            columns: ["assigned_by"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      task_checklist_items: {
        Row: {
          id: string;
          task_id: string;
          content: string;
          is_done: boolean;
          position: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          content: string;
          is_done?: boolean;
          position?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          task_id?: string;
          content?: string;
          is_done?: boolean;
          position?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "task_checklist_items_task_id_fkey";
            columns: ["task_id"];
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          },
        ];
      };
      task_links: {
        Row: {
          id: string;
          task_id: string;
          label: string | null;
          url: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          label?: string | null;
          url: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          task_id?: string;
          label?: string | null;
          url?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "task_links_task_id_fkey";
            columns: ["task_id"];
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          },
        ];
      };
      task_time_entries: {
        Row: {
          id: string;
          task_id: string;
          user_id: string;
          started_at: string;
          ended_at: string | null;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          user_id: string;
          started_at: string;
          ended_at?: string | null;
          note?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          task_id?: string;
          user_id?: string;
          started_at?: string;
          ended_at?: string | null;
          note?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "task_time_entries_task_id_fkey";
            columns: ["task_id"];
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "task_time_entries_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      attendance_sessions: {
        Row: {
          id: string;
          user_id: string;
          check_in_at: string;
          check_out_at: string | null;
          ist_date: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          check_in_at: string;
          check_out_at?: string | null;
          ist_date: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          check_in_at?: string;
          check_out_at?: string | null;
          ist_date?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "attendance_sessions_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      calendar_events: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          description: string | null;
          start_at: string;
          end_at: string;
          all_day: boolean;
          color: string | null;
          location: string | null;
          task_id: string | null;
          rrule: string | null;
          recurrence_parent_id: string | null;
          created_at: string;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          description?: string | null;
          start_at: string;
          end_at: string;
          all_day?: boolean;
          color?: string | null;
          location?: string | null;
          task_id?: string | null;
          rrule?: string | null;
          recurrence_parent_id?: string | null;
          created_at?: string;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          description?: string | null;
          start_at?: string;
          end_at?: string;
          all_day?: boolean;
          color?: string | null;
          location?: string | null;
          task_id?: string | null;
          rrule?: string | null;
          recurrence_parent_id?: string | null;
          created_at?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "calendar_events_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "calendar_events_task_id_fkey";
            columns: ["task_id"];
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "calendar_events_recurrence_parent_id_fkey";
            columns: ["recurrence_parent_id"];
            referencedRelation: "calendar_events";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: Database["public"]["Enums"]["notification_type"];
          title: string;
          body: string | null;
          entity_type: string | null;
          entity_id: string | null;
          is_read: boolean;
          email_sent: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: Database["public"]["Enums"]["notification_type"];
          title: string;
          body?: string | null;
          entity_type?: string | null;
          entity_id?: string | null;
          is_read?: boolean;
          email_sent?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: Database["public"]["Enums"]["notification_type"];
          title?: string;
          body?: string | null;
          entity_type?: string | null;
          entity_id?: string | null;
          is_read?: boolean;
          email_sent?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      activity_log: {
        Row: {
          id: string;
          actor_id: string;
          action: string;
          entity_type: string;
          entity_id: string;
          project_id: string | null;
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_id: string;
          action: string;
          entity_type: string;
          entity_id: string;
          project_id?: string | null;
          metadata?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          actor_id?: string;
          action?: string;
          entity_type?: string;
          entity_id?: string;
          project_id?: string | null;
          metadata?: Json | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "activity_log_actor_id_fkey";
            columns: ["actor_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "activity_log_project_id_fkey";
            columns: ["project_id"];
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      v_task_total_time: {
        Row: {
          task_id: string | null;
          total_seconds: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "task_time_entries_task_id_fkey";
            columns: ["task_id"];
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          },
        ];
      };
      v_daily_attendance: {
        Row: {
          user_id: string | null;
          ist_date: string | null;
          worked_seconds: number | null;
          extra_seconds: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "attendance_sessions_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Functions: {
      get_my_dashboard: {
        Args: Record<string, never>;
        Returns: Json;
      };
      is_task_collaborator: {
        Args: { p_task_id: string };
        Returns: boolean;
      };
    };
    Enums: {
      urgency_level: "low" | "medium" | "high" | "urgent";
      project_status: "active" | "on_hold" | "completed" | "archived";
      task_status: "todo" | "in_progress" | "done";
      notification_type:
        | "task_assigned"
        | "task_due_soon"
        | "task_status_changed"
        | "project_due_soon"
        | "mention";
    };
    CompositeTypes: Record<string, never>;
  };
};

// ── Convenience helpers ──────────────────────────────────────────────────────
type PublicSchema = Database["public"];

export type Tables<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"];
export type Views<T extends keyof PublicSchema["Views"]> =
  PublicSchema["Views"][T]["Row"];
export type Enums<T extends keyof PublicSchema["Enums"]> =
  PublicSchema["Enums"][T];
