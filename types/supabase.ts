export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      activity_log: {
        Row: {
          action: string;
          actor_id: string | null;
          actor_kind: Database["public"]["Enums"]["actor_kind"];
          created_at: string;
          details: NonNullable<Json>;
          grant_id: string | null;
          id: string;
          organization_id: string;
          summary: string;
        };
        ComputedFields: never;
        Insert: {
          action: string;
          actor_id?: string | null;
          actor_kind: Database["public"]["Enums"]["actor_kind"];
          created_at?: string;
          details?: NonNullable<Json>;
          grant_id?: string | null;
          id?: string;
          organization_id: string;
          summary: string;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          actor_kind?: Database["public"]["Enums"]["actor_kind"];
          created_at?: string;
          details?: NonNullable<Json>;
          grant_id?: string | null;
          id?: string;
          organization_id?: string;
          summary?: string;
        };
        Relationships: [
          {
            foreignKeyName: "activity_log_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "activity_log_organization_id_grant_id_fkey";
            columns: ["organization_id", "grant_id"];
            isOneToOne: false;
            referencedRelation: "grants";
            referencedColumns: ["organization_id", "id"];
          },
        ];
      };
      assistance_listings: {
        Row: {
          number: string;
          title: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          number: string;
          title?: string | null;
          updated_at?: string;
        };
        Update: {
          number?: string;
          title?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      boilerplate: {
        Row: {
          body: string;
          category: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          organization_id: string;
          tags: string[];
          title: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          body: string;
          category?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          organization_id: string;
          tags?: string[];
          title: string;
          updated_at?: string;
        };
        Update: {
          body?: string;
          category?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          organization_id?: string;
          tags?: string[];
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "boilerplate_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      deadlines: {
        Row: {
          all_day: boolean;
          created_at: string;
          created_by: string | null;
          due_at: string;
          external_feed_id: string | null;
          external_uid: string | null;
          grant_id: string | null;
          id: string;
          kind: Database["public"]["Enums"]["deadline_kind"];
          notes: string | null;
          organization_id: string;
          time_zone: string | null;
          title: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          all_day?: boolean;
          created_at?: string;
          created_by?: string | null;
          due_at: string;
          external_feed_id?: string | null;
          external_uid?: string | null;
          grant_id?: string | null;
          id?: string;
          kind?: Database["public"]["Enums"]["deadline_kind"];
          notes?: string | null;
          organization_id: string;
          time_zone?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          all_day?: boolean;
          created_at?: string;
          created_by?: string | null;
          due_at?: string;
          external_feed_id?: string | null;
          external_uid?: string | null;
          grant_id?: string | null;
          id?: string;
          kind?: Database["public"]["Enums"]["deadline_kind"];
          notes?: string | null;
          organization_id?: string;
          time_zone?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "deadlines_organization_id_external_feed_id_fkey";
            columns: ["organization_id", "external_feed_id"];
            isOneToOne: false;
            referencedRelation: "external_feeds";
            referencedColumns: ["organization_id", "id"];
          },
          {
            foreignKeyName: "deadlines_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "deadlines_organization_id_grant_id_fkey";
            columns: ["organization_id", "grant_id"];
            isOneToOne: false;
            referencedRelation: "grants";
            referencedColumns: ["organization_id", "id"];
          },
        ];
      };
      documents: {
        Row: {
          created_at: string;
          created_by: string | null;
          grant_id: string | null;
          id: string;
          mime_type: string | null;
          name: string;
          organization_id: string;
          size_bytes: number | null;
          storage_path: string;
          updated_at: string;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          grant_id?: string | null;
          id?: string;
          mime_type?: string | null;
          name: string;
          organization_id: string;
          size_bytes?: number | null;
          storage_path: string;
          updated_at?: string;
          version?: number;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          grant_id?: string | null;
          id?: string;
          mime_type?: string | null;
          name?: string;
          organization_id?: string;
          size_bytes?: number | null;
          storage_path?: string;
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "documents_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "documents_organization_id_grant_id_fkey";
            columns: ["organization_id", "grant_id"];
            isOneToOne: false;
            referencedRelation: "grants";
            referencedColumns: ["organization_id", "id"];
          },
        ];
      };
      external_feeds: {
        Row: {
          created_at: string;
          created_by: string | null;
          enabled: boolean;
          id: string;
          kind: Database["public"]["Enums"]["feed_kind"];
          last_error: string | null;
          last_fetched_at: string | null;
          last_status: string | null;
          name: string;
          organization_id: string;
          updated_at: string;
          url: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          enabled?: boolean;
          id?: string;
          kind: Database["public"]["Enums"]["feed_kind"];
          last_error?: string | null;
          last_fetched_at?: string | null;
          last_status?: string | null;
          name: string;
          organization_id: string;
          updated_at?: string;
          url: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          enabled?: boolean;
          id?: string;
          kind?: Database["public"]["Enums"]["feed_kind"];
          last_error?: string | null;
          last_fetched_at?: string | null;
          last_status?: string | null;
          name?: string;
          organization_id?: string;
          updated_at?: string;
          url?: string;
        };
        Relationships: [
          {
            foreignKeyName: "external_feeds_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      funders: {
        Row: {
          commons_funder_id: string | null;
          created_at: string;
          created_by: string | null;
          ein: string | null;
          id: string;
          kind: Database["public"]["Enums"]["funder_kind"];
          name: string;
          organization_id: string;
          updated_at: string;
          website: string | null;
        };
        ComputedFields: never;
        Insert: {
          commons_funder_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          ein?: string | null;
          id?: string;
          kind?: Database["public"]["Enums"]["funder_kind"];
          name: string;
          organization_id: string;
          updated_at?: string;
          website?: string | null;
        };
        Update: {
          commons_funder_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          ein?: string | null;
          id?: string;
          kind?: Database["public"]["Enums"]["funder_kind"];
          name?: string;
          organization_id?: string;
          updated_at?: string;
          website?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "funders_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      grant_stage_history: {
        Row: {
          changed_at: string;
          changed_by: string | null;
          from_stage: Database["public"]["Enums"]["grant_stage"] | null;
          grant_id: string;
          id: string;
          organization_id: string;
          to_stage: Database["public"]["Enums"]["grant_stage"];
        };
        ComputedFields: never;
        Insert: {
          changed_at?: string;
          changed_by?: string | null;
          from_stage?: Database["public"]["Enums"]["grant_stage"] | null;
          grant_id: string;
          id?: string;
          organization_id: string;
          to_stage: Database["public"]["Enums"]["grant_stage"];
        };
        Update: {
          changed_at?: string;
          changed_by?: string | null;
          from_stage?: Database["public"]["Enums"]["grant_stage"] | null;
          grant_id?: string;
          id?: string;
          organization_id?: string;
          to_stage?: Database["public"]["Enums"]["grant_stage"];
        };
        Relationships: [
          {
            foreignKeyName: "grant_stage_history_organization_id_grant_id_fkey";
            columns: ["organization_id", "grant_id"];
            isOneToOne: false;
            referencedRelation: "grants";
            referencedColumns: ["organization_id", "id"];
          },
        ];
      };
      grants: {
        Row: {
          amount_awarded: number | null;
          amount_requested: number | null;
          award_end_date: string | null;
          award_start_date: string | null;
          created_at: string;
          created_by: string | null;
          currency: string;
          decision_date: string | null;
          funder_id: string | null;
          id: string;
          opportunity_id: string | null;
          organization_id: string;
          preset: Database["public"]["Enums"]["pipeline_preset"];
          stage: Database["public"]["Enums"]["grant_stage"];
          submission_due_at: string | null;
          submitted_at: string | null;
          title: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          amount_awarded?: number | null;
          amount_requested?: number | null;
          award_end_date?: string | null;
          award_start_date?: string | null;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          decision_date?: string | null;
          funder_id?: string | null;
          id?: string;
          opportunity_id?: string | null;
          organization_id: string;
          preset?: Database["public"]["Enums"]["pipeline_preset"];
          stage?: Database["public"]["Enums"]["grant_stage"];
          submission_due_at?: string | null;
          submitted_at?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          amount_awarded?: number | null;
          amount_requested?: number | null;
          award_end_date?: string | null;
          award_start_date?: string | null;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          decision_date?: string | null;
          funder_id?: string | null;
          id?: string;
          opportunity_id?: string | null;
          organization_id?: string;
          preset?: Database["public"]["Enums"]["pipeline_preset"];
          stage?: Database["public"]["Enums"]["grant_stage"];
          submission_due_at?: string | null;
          submitted_at?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "grants_opportunity_id_fkey";
            columns: ["opportunity_id"];
            isOneToOne: false;
            referencedRelation: "opportunities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "grants_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "grants_organization_id_funder_id_fkey";
            columns: ["organization_id", "funder_id"];
            isOneToOne: false;
            referencedRelation: "funders";
            referencedColumns: ["organization_id", "id"];
          },
        ];
      };
      grants_gov_agencies: {
        Row: {
          code: string;
          name: string;
          top_agency_code: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          code: string;
          name: string;
          top_agency_code: string;
          updated_at?: string;
        };
        Update: {
          code?: string;
          name?: string;
          top_agency_code?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      memberships: {
        Row: {
          created_at: string;
          id: string;
          organization_id: string;
          role: Database["public"]["Enums"]["membership_role"];
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          organization_id: string;
          role?: Database["public"]["Enums"]["membership_role"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          organization_id?: string;
          role?: Database["public"]["Enums"]["membership_role"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "memberships_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      notes: {
        Row: {
          body: string;
          created_at: string;
          created_by: string | null;
          funder_id: string | null;
          grant_id: string | null;
          id: string;
          organization_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          body: string;
          created_at?: string;
          created_by?: string | null;
          funder_id?: string | null;
          grant_id?: string | null;
          id?: string;
          organization_id: string;
          updated_at?: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          created_by?: string | null;
          funder_id?: string | null;
          grant_id?: string | null;
          id?: string;
          organization_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notes_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notes_organization_id_funder_id_fkey";
            columns: ["organization_id", "funder_id"];
            isOneToOne: false;
            referencedRelation: "funders";
            referencedColumns: ["organization_id", "id"];
          },
          {
            foreignKeyName: "notes_organization_id_grant_id_fkey";
            columns: ["organization_id", "grant_id"];
            isOneToOne: false;
            referencedRelation: "grants";
            referencedColumns: ["organization_id", "id"];
          },
        ];
      };
      opportunities: {
        Row: {
          close_date: string | null;
          close_time: string | null;
          close_time_zone: string | null;
          created_at: string;
          created_by: string | null;
          currency: string;
          custom_fields: NonNullable<Json>;
          description: string | null;
          estimated_award_count: number | null;
          external_id: string | null;
          external_ids: NonNullable<Json>;
          funder_name: string | null;
          funding_details: string | null;
          id: string;
          max_award_amount: number | null;
          max_award_count: number | null;
          min_award_amount: number | null;
          min_award_count: number | null;
          opportunity_number: string | null;
          organization_id: string | null;
          other_dates: NonNullable<Json>;
          post_date: string | null;
          search: unknown;
          source_system: string;
          source_url: string | null;
          status: Database["public"]["Enums"]["opportunity_status"];
          status_custom_value: string | null;
          status_description: string | null;
          title: string;
          total_amount_available: number | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          close_date?: string | null;
          close_time?: string | null;
          close_time_zone?: string | null;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          custom_fields?: NonNullable<Json>;
          description?: string | null;
          estimated_award_count?: number | null;
          external_id?: string | null;
          external_ids?: NonNullable<Json>;
          funder_name?: string | null;
          funding_details?: string | null;
          id?: string;
          max_award_amount?: number | null;
          max_award_count?: number | null;
          min_award_amount?: number | null;
          min_award_count?: number | null;
          opportunity_number?: string | null;
          organization_id?: string | null;
          other_dates?: NonNullable<Json>;
          post_date?: string | null;
          search?: never;
          source_system?: string;
          source_url?: string | null;
          status: Database["public"]["Enums"]["opportunity_status"];
          status_custom_value?: string | null;
          status_description?: string | null;
          title: string;
          total_amount_available?: number | null;
          updated_at?: string;
        };
        Update: {
          close_date?: string | null;
          close_time?: string | null;
          close_time_zone?: string | null;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          custom_fields?: NonNullable<Json>;
          description?: string | null;
          estimated_award_count?: number | null;
          external_id?: string | null;
          external_ids?: NonNullable<Json>;
          funder_name?: string | null;
          funding_details?: string | null;
          id?: string;
          max_award_amount?: number | null;
          max_award_count?: number | null;
          min_award_amount?: number | null;
          min_award_count?: number | null;
          opportunity_number?: string | null;
          organization_id?: string | null;
          other_dates?: NonNullable<Json>;
          post_date?: string | null;
          search?: never;
          source_system?: string;
          source_url?: string | null;
          status?: Database["public"]["Enums"]["opportunity_status"];
          status_custom_value?: string | null;
          status_description?: string | null;
          title?: string;
          total_amount_available?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "opportunities_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      opportunity_details: {
        Row: {
          assistance_listings: NonNullable<Json>;
          attachments: NonNullable<Json>;
          details: NonNullable<Json>;
          fetched_at: string;
          opportunity_id: string;
          packages: NonNullable<Json>;
          revision: number | null;
          source_system: string;
        };
        ComputedFields: never;
        Insert: {
          assistance_listings?: NonNullable<Json>;
          attachments?: NonNullable<Json>;
          details?: NonNullable<Json>;
          fetched_at?: string;
          opportunity_id: string;
          packages?: NonNullable<Json>;
          revision?: number | null;
          source_system: string;
        };
        Update: {
          assistance_listings?: NonNullable<Json>;
          attachments?: NonNullable<Json>;
          details?: NonNullable<Json>;
          fetched_at?: string;
          opportunity_id?: string;
          packages?: NonNullable<Json>;
          revision?: number | null;
          source_system?: string;
        };
        Relationships: [
          {
            foreignKeyName: "opportunity_details_opportunity_id_fkey";
            columns: ["opportunity_id"];
            isOneToOne: true;
            referencedRelation: "opportunities";
            referencedColumns: ["id"];
          },
        ];
      };
      opportunity_sync_runs: {
        Row: {
          counts: NonNullable<Json>;
          error: string | null;
          finished_at: string | null;
          id: string;
          job: string;
          source_system: string;
          source_url: string | null;
          started_at: string;
          status: string;
        };
        ComputedFields: never;
        Insert: {
          counts?: NonNullable<Json>;
          error?: string | null;
          finished_at?: string | null;
          id?: string;
          job: string;
          source_system: string;
          source_url?: string | null;
          started_at?: string;
          status?: string;
        };
        Update: {
          counts?: NonNullable<Json>;
          error?: string | null;
          finished_at?: string | null;
          id?: string;
          job?: string;
          source_system?: string;
          source_url?: string | null;
          started_at?: string;
          status?: string;
        };
        Relationships: [];
      };
      organizations: {
        Row: {
          created_at: string;
          created_by: string | null;
          ein: string | null;
          id: string;
          mission: string | null;
          name: string;
          uei: string | null;
          updated_at: string;
          website: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          ein?: string | null;
          id?: string;
          mission?: string | null;
          name: string;
          uei?: string | null;
          updated_at?: string;
          website?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          ein?: string | null;
          id?: string;
          mission?: string | null;
          name?: string;
          uei?: string | null;
          updated_at?: string;
          website?: string | null;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          display_name: string | null;
          email: string | null;
          id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          display_name?: string | null;
          email?: string | null;
          id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          display_name?: string | null;
          email?: string | null;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      proposals: {
        Row: {
          created_at: string;
          decided_at: string | null;
          decided_by: string | null;
          grant_id: string | null;
          id: string;
          model: string | null;
          organization_id: string;
          payload: NonNullable<Json>;
          proposed_by: string | null;
          sources: NonNullable<Json>;
          status: Database["public"]["Enums"]["proposal_status"];
          summary: string;
          tool_name: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          grant_id?: string | null;
          id?: string;
          model?: string | null;
          organization_id: string;
          payload?: NonNullable<Json>;
          proposed_by?: string | null;
          sources?: NonNullable<Json>;
          status?: Database["public"]["Enums"]["proposal_status"];
          summary: string;
          tool_name: string;
        };
        Update: {
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          grant_id?: string | null;
          id?: string;
          model?: string | null;
          organization_id?: string;
          payload?: NonNullable<Json>;
          proposed_by?: string | null;
          sources?: NonNullable<Json>;
          status?: Database["public"]["Enums"]["proposal_status"];
          summary?: string;
          tool_name?: string;
        };
        Relationships: [
          {
            foreignKeyName: "proposals_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "proposals_organization_id_grant_id_fkey";
            columns: ["organization_id", "grant_id"];
            isOneToOne: false;
            referencedRelation: "grants";
            referencedColumns: ["organization_id", "id"];
          },
        ];
      };
      tasks: {
        Row: {
          assignee_id: string | null;
          completed_at: string | null;
          created_at: string;
          created_by: string | null;
          description: string | null;
          due_date: string | null;
          grant_id: string | null;
          id: string;
          organization_id: string;
          status: Database["public"]["Enums"]["task_status"];
          title: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          assignee_id?: string | null;
          completed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          due_date?: string | null;
          grant_id?: string | null;
          id?: string;
          organization_id: string;
          status?: Database["public"]["Enums"]["task_status"];
          title: string;
          updated_at?: string;
        };
        Update: {
          assignee_id?: string | null;
          completed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          due_date?: string | null;
          grant_id?: string | null;
          id?: string;
          organization_id?: string;
          status?: Database["public"]["Enums"]["task_status"];
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tasks_organization_id_assignee_id_fkey";
            columns: ["organization_id", "assignee_id"];
            isOneToOne: false;
            referencedRelation: "memberships";
            referencedColumns: ["organization_id", "user_id"];
          },
          {
            foreignKeyName: "tasks_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tasks_organization_id_grant_id_fkey";
            columns: ["organization_id", "grant_id"];
            isOneToOne: false;
            referencedRelation: "grants";
            referencedColumns: ["organization_id", "id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      create_organization: { Args: { p_name: string }; Returns: string };
      search_opportunities: {
        Args: {
          p_agency?: string;
          p_categories?: string[];
          p_close_from?: string;
          p_close_to?: string;
          p_eligibilities?: string[];
          p_keyword?: string;
          p_limit?: number;
          p_min_award_ceiling?: number;
          p_offset?: number;
          p_source_system?: string;
          p_statuses?: Database["public"]["Enums"]["opportunity_status"][];
        };
        Returns: {
          agency_code: string;
          close_date: string;
          eligible_applicants: string[];
          external_id: string;
          funder_name: string;
          funding_categories: string[];
          id: string;
          max_award_amount: number;
          min_award_amount: number;
          opportunity_number: string;
          post_date: string;
          source_system: string;
          source_url: string;
          status: Database["public"]["Enums"]["opportunity_status"];
          status_description: string;
          title: string;
          total_amount_available: number;
          total_count: number;
        }[];
      };
      upsert_catalog_opportunities: {
        Args: { p_rows: Json; p_source_system: string };
        Returns: {
          inserted: number;
          unchanged: number;
          updated: number;
        }[];
      };
    };
    Enums: {
      actor_kind: "person" | "agent" | "system";
      deadline_kind: "loi" | "application" | "report" | "internal" | "other";
      feed_kind: "ical" | "rss";
      funder_kind: "foundation" | "corporate" | "federal" | "state" | "county" | "city" | "other";
      grant_stage:
        | "prospect"
        | "qualifying"
        | "loi"
        | "application"
        | "submitted"
        | "awarded"
        | "declined"
        | "active"
        | "reporting"
        | "closed";
      membership_role: "owner" | "admin" | "editor" | "viewer";
      opportunity_status: "forecasted" | "open" | "closed" | "custom";
      pipeline_preset: "standard" | "sbir";
      proposal_status: "proposed" | "accepted" | "rejected";
      task_status: "open" | "done";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      actor_kind: ["person", "agent", "system"],
      deadline_kind: ["loi", "application", "report", "internal", "other"],
      feed_kind: ["ical", "rss"],
      funder_kind: ["foundation", "corporate", "federal", "state", "county", "city", "other"],
      grant_stage: [
        "prospect",
        "qualifying",
        "loi",
        "application",
        "submitted",
        "awarded",
        "declined",
        "active",
        "reporting",
        "closed",
      ],
      membership_role: ["owner", "admin", "editor", "viewer"],
      opportunity_status: ["forecasted", "open", "closed", "custom"],
      pipeline_preset: ["standard", "sbir"],
      proposal_status: ["proposed", "accepted", "rejected"],
      task_status: ["open", "done"],
    },
  },
} as const;
