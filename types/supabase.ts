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
      award_reports: {
        Row: {
          award_id: string;
          created_at: string;
          created_by: string | null;
          deadline_id: string | null;
          due_date: string;
          generated: boolean;
          id: string;
          kind: Database["public"]["Enums"]["award_report_kind"];
          notes: string | null;
          organization_id: string;
          period_end: string | null;
          period_start: string | null;
          status: Database["public"]["Enums"]["award_report_status"];
          submitted_on: string | null;
          title: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          award_id: string;
          created_at?: string;
          created_by?: string | null;
          deadline_id?: string | null;
          due_date: string;
          generated?: boolean;
          id?: string;
          kind?: Database["public"]["Enums"]["award_report_kind"];
          notes?: string | null;
          organization_id: string;
          period_end?: string | null;
          period_start?: string | null;
          status?: Database["public"]["Enums"]["award_report_status"];
          submitted_on?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          award_id?: string;
          created_at?: string;
          created_by?: string | null;
          deadline_id?: string | null;
          due_date?: string;
          generated?: boolean;
          id?: string;
          kind?: Database["public"]["Enums"]["award_report_kind"];
          notes?: string | null;
          organization_id?: string;
          period_end?: string | null;
          period_start?: string | null;
          status?: Database["public"]["Enums"]["award_report_status"];
          submitted_on?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "award_reports_organization_id_award_id_fkey";
            columns: ["organization_id", "award_id"];
            isOneToOne: false;
            referencedRelation: "awards";
            referencedColumns: ["organization_id", "id"];
          },
          {
            foreignKeyName: "award_reports_organization_id_deadline_id_fkey";
            columns: ["organization_id", "deadline_id"];
            isOneToOne: false;
            referencedRelation: "deadlines";
            referencedColumns: ["organization_id", "id"];
          },
          {
            foreignKeyName: "award_reports_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      awards: {
        Row: {
          award_number: string | null;
          closed_at: string | null;
          closed_by: string | null;
          created_at: string;
          created_by: string | null;
          final_report_lag_days: number;
          grant_id: string;
          id: string;
          indirect_method: Database["public"]["Enums"]["indirect_cost_method"] | null;
          indirect_rate: number | null;
          is_federal: boolean;
          notes: string | null;
          organization_id: string;
          payment_method: Database["public"]["Enums"]["award_payment_method"] | null;
          records_retention_until: string | null;
          report_frequency: Database["public"]["Enums"]["report_frequency"];
          report_lag_days: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          award_number?: string | null;
          closed_at?: string | null;
          closed_by?: string | null;
          created_at?: string;
          created_by?: string | null;
          final_report_lag_days?: number;
          grant_id: string;
          id?: string;
          indirect_method?: Database["public"]["Enums"]["indirect_cost_method"] | null;
          indirect_rate?: number | null;
          is_federal?: boolean;
          notes?: string | null;
          organization_id: string;
          payment_method?: Database["public"]["Enums"]["award_payment_method"] | null;
          records_retention_until?: string | null;
          report_frequency?: Database["public"]["Enums"]["report_frequency"];
          report_lag_days?: number;
          updated_at?: string;
        };
        Update: {
          award_number?: string | null;
          closed_at?: string | null;
          closed_by?: string | null;
          created_at?: string;
          created_by?: string | null;
          final_report_lag_days?: number;
          grant_id?: string;
          id?: string;
          indirect_method?: Database["public"]["Enums"]["indirect_cost_method"] | null;
          indirect_rate?: number | null;
          is_federal?: boolean;
          notes?: string | null;
          organization_id?: string;
          payment_method?: Database["public"]["Enums"]["award_payment_method"] | null;
          records_retention_until?: string | null;
          report_frequency?: Database["public"]["Enums"]["report_frequency"];
          report_lag_days?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "awards_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "awards_organization_id_grant_id_fkey";
            columns: ["organization_id", "grant_id"];
            isOneToOne: false;
            referencedRelation: "grants";
            referencedColumns: ["organization_id", "id"];
          },
        ];
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
      budget_actuals: {
        Row: {
          amount: number;
          award_id: string;
          budget_line_id: string;
          created_at: string;
          created_by: string | null;
          description: string | null;
          id: string;
          organization_id: string;
          source: string;
          spent_on: string;
        };
        ComputedFields: never;
        Insert: {
          amount: number;
          award_id: string;
          budget_line_id: string;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          organization_id: string;
          source?: string;
          spent_on: string;
        };
        Update: {
          amount?: number;
          award_id?: string;
          budget_line_id?: string;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          organization_id?: string;
          source?: string;
          spent_on?: string;
        };
        Relationships: [
          {
            foreignKeyName: "budget_actuals_organization_id_award_id_budget_line_id_fkey";
            columns: ["organization_id", "award_id", "budget_line_id"];
            isOneToOne: false;
            referencedRelation: "budget_lines";
            referencedColumns: ["organization_id", "award_id", "id"];
          },
          {
            foreignKeyName: "budget_actuals_organization_id_award_id_fkey";
            columns: ["organization_id", "award_id"];
            isOneToOne: false;
            referencedRelation: "awards";
            referencedColumns: ["organization_id", "id"];
          },
          {
            foreignKeyName: "budget_actuals_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      budget_lines: {
        Row: {
          award_id: string;
          budgeted: number | null;
          category: string;
          created_at: string;
          created_by: string | null;
          id: string;
          organization_id: string;
          sort_order: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          award_id: string;
          budgeted?: number | null;
          category: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          organization_id: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          award_id?: string;
          budgeted?: number | null;
          category?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          organization_id?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "budget_lines_organization_id_award_id_fkey";
            columns: ["organization_id", "award_id"];
            isOneToOne: false;
            referencedRelation: "awards";
            referencedColumns: ["organization_id", "id"];
          },
          {
            foreignKeyName: "budget_lines_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      calendar_tokens: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          label: string | null;
          organization_id: string;
          revoked_at: string | null;
          token_hash: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          label?: string | null;
          organization_id: string;
          revoked_at?: string | null;
          token_hash: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          label?: string | null;
          organization_id?: string;
          revoked_at?: string | null;
          token_hash?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "calendar_tokens_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      compliance_items: {
        Row: {
          award_id: string;
          completed_at: string | null;
          completed_by: string | null;
          created_at: string;
          created_by: string | null;
          detail: string | null;
          id: string;
          organization_id: string;
          sort_order: number;
          template_key: string | null;
          title: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          award_id: string;
          completed_at?: string | null;
          completed_by?: string | null;
          created_at?: string;
          created_by?: string | null;
          detail?: string | null;
          id?: string;
          organization_id: string;
          sort_order?: number;
          template_key?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          award_id?: string;
          completed_at?: string | null;
          completed_by?: string | null;
          created_at?: string;
          created_by?: string | null;
          detail?: string | null;
          id?: string;
          organization_id?: string;
          sort_order?: number;
          template_key?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "compliance_items_organization_id_award_id_fkey";
            columns: ["organization_id", "award_id"];
            isOneToOne: false;
            referencedRelation: "awards";
            referencedColumns: ["organization_id", "id"];
          },
          {
            foreignKeyName: "compliance_items_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      contacts: {
        Row: {
          created_at: string;
          created_by: string | null;
          email: string | null;
          funder_id: string | null;
          grant_id: string | null;
          id: string;
          name: string;
          notes: string | null;
          organization_id: string;
          phone: string | null;
          publishability: Database["public"]["Enums"]["contact_publishability"];
          role: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          email?: string | null;
          funder_id?: string | null;
          grant_id?: string | null;
          id?: string;
          name: string;
          notes?: string | null;
          organization_id: string;
          phone?: string | null;
          publishability?: Database["public"]["Enums"]["contact_publishability"];
          role?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          email?: string | null;
          funder_id?: string | null;
          grant_id?: string | null;
          id?: string;
          name?: string;
          notes?: string | null;
          organization_id?: string;
          phone?: string | null;
          publishability?: Database["public"]["Enums"]["contact_publishability"];
          role?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "contacts_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contacts_organization_id_funder_id_fkey";
            columns: ["organization_id", "funder_id"];
            isOneToOne: false;
            referencedRelation: "funders";
            referencedColumns: ["organization_id", "id"];
          },
          {
            foreignKeyName: "contacts_organization_id_grant_id_fkey";
            columns: ["organization_id", "grant_id"];
            isOneToOne: false;
            referencedRelation: "grants";
            referencedColumns: ["organization_id", "id"];
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
      feed_items: {
        Row: {
          created_at: string;
          created_by: string | null;
          external_feed_id: string;
          external_uid: string;
          id: string;
          link: string | null;
          organization_id: string;
          published_at: string | null;
          summary: string | null;
          title: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          external_feed_id: string;
          external_uid: string;
          id?: string;
          link?: string | null;
          organization_id: string;
          published_at?: string | null;
          summary?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          external_feed_id?: string;
          external_uid?: string;
          id?: string;
          link?: string | null;
          organization_id?: string;
          published_at?: string | null;
          summary?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "feed_items_organization_id_external_feed_id_fkey";
            columns: ["organization_id", "external_feed_id"];
            isOneToOne: false;
            referencedRelation: "external_feeds";
            referencedColumns: ["organization_id", "id"];
          },
          {
            foreignKeyName: "feed_items_organization_id_fkey";
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
      knowledge_facts: {
        Row: {
          confidence: Database["public"]["Enums"]["knowledge_confidence"];
          confirmed_at: string | null;
          confirmed_by: string | null;
          created_at: string;
          created_by: string | null;
          fact: string;
          id: string;
          organization_id: string;
          source_kind: Database["public"]["Enums"]["knowledge_source_kind"];
          source_ref: string;
          status: Database["public"]["Enums"]["knowledge_status"];
          subject_id: string | null;
          subject_kind: Database["public"]["Enums"]["knowledge_subject_kind"];
          superseded_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          confidence?: Database["public"]["Enums"]["knowledge_confidence"];
          confirmed_at?: string | null;
          confirmed_by?: string | null;
          created_at?: string;
          created_by?: string | null;
          fact: string;
          id?: string;
          organization_id: string;
          source_kind: Database["public"]["Enums"]["knowledge_source_kind"];
          source_ref: string;
          status?: Database["public"]["Enums"]["knowledge_status"];
          subject_id?: string | null;
          subject_kind: Database["public"]["Enums"]["knowledge_subject_kind"];
          superseded_by?: string | null;
        };
        Update: {
          confidence?: Database["public"]["Enums"]["knowledge_confidence"];
          confirmed_at?: string | null;
          confirmed_by?: string | null;
          created_at?: string;
          created_by?: string | null;
          fact?: string;
          id?: string;
          organization_id?: string;
          source_kind?: Database["public"]["Enums"]["knowledge_source_kind"];
          source_ref?: string;
          status?: Database["public"]["Enums"]["knowledge_status"];
          subject_id?: string | null;
          subject_kind?: Database["public"]["Enums"]["knowledge_subject_kind"];
          superseded_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "knowledge_facts_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "knowledge_facts_organization_id_superseded_by_fkey";
            columns: ["organization_id", "superseded_by"];
            isOneToOne: false;
            referencedRelation: "knowledge_facts";
            referencedColumns: ["organization_id", "id"];
          },
        ];
      };
      learning_sessions: {
        Row: {
          closed_at: string | null;
          created_at: string;
          goal: string;
          id: string;
          lessons_summary: string | null;
          number: number;
          opened_at: string;
          opened_by: string | null;
          organization_id: string;
          packet: NonNullable<Json>;
          playbook_key: Database["public"]["Enums"]["playbook_key"];
          status: Database["public"]["Enums"]["learning_session_status"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          closed_at?: string | null;
          created_at?: string;
          goal: string;
          id?: string;
          lessons_summary?: string | null;
          number: number;
          opened_at?: string;
          opened_by?: string | null;
          organization_id: string;
          packet: NonNullable<Json>;
          playbook_key: Database["public"]["Enums"]["playbook_key"];
          status?: Database["public"]["Enums"]["learning_session_status"];
          updated_at?: string;
        };
        Update: {
          closed_at?: string | null;
          created_at?: string;
          goal?: string;
          id?: string;
          lessons_summary?: string | null;
          number?: number;
          opened_at?: string;
          opened_by?: string | null;
          organization_id?: string;
          packet?: NonNullable<Json>;
          playbook_key?: Database["public"]["Enums"]["playbook_key"];
          status?: Database["public"]["Enums"]["learning_session_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "learning_sessions_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
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
      organizations: {
        Row: {
          created_at: string;
          created_by: string | null;
          ein: string | null;
          id: string;
          kind: Database["public"]["Enums"]["organization_kind"];
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
          kind?: Database["public"]["Enums"]["organization_kind"];
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
          kind?: Database["public"]["Enums"]["organization_kind"];
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
      reimbursements: {
        Row: {
          amount: number | null;
          award_id: string;
          created_at: string;
          created_by: string | null;
          id: string;
          invoice_number: string | null;
          notes: string | null;
          organization_id: string;
          paid_on: string | null;
          sent_on: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          amount?: number | null;
          award_id: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          invoice_number?: string | null;
          notes?: string | null;
          organization_id: string;
          paid_on?: string | null;
          sent_on?: string | null;
          updated_at?: string;
        };
        Update: {
          amount?: number | null;
          award_id?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          invoice_number?: string | null;
          notes?: string | null;
          organization_id?: string;
          paid_on?: string | null;
          sent_on?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reimbursements_organization_id_award_id_fkey";
            columns: ["organization_id", "award_id"];
            isOneToOne: false;
            referencedRelation: "awards";
            referencedColumns: ["organization_id", "id"];
          },
          {
            foreignKeyName: "reimbursements_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      reminder_log: {
        Row: {
          days_before: number;
          id: string;
          item_key: string;
          organization_id: string;
          provider_message_id: string | null;
          sent_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          days_before: number;
          id?: string;
          item_key: string;
          organization_id: string;
          provider_message_id?: string | null;
          sent_at?: string;
          user_id: string;
        };
        Update: {
          days_before?: number;
          id?: string;
          item_key?: string;
          organization_id?: string;
          provider_message_id?: string | null;
          sent_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reminder_log_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      reminder_preferences: {
        Row: {
          created_at: string;
          id: string;
          mode: Database["public"]["Enums"]["reminder_mode"];
          organization_id: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          mode?: Database["public"]["Enums"]["reminder_mode"];
          organization_id: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          mode?: Database["public"]["Enums"]["reminder_mode"];
          organization_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reminder_preferences_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reminder_preferences_organization_id_user_id_fkey";
            columns: ["organization_id", "user_id"];
            isOneToOne: true;
            referencedRelation: "memberships";
            referencedColumns: ["organization_id", "user_id"];
          },
        ];
      };
      session_lessons: {
        Row: {
          applies_to: Database["public"]["Enums"]["lesson_applies_to"];
          created_at: string;
          created_by: string | null;
          evidence: string | null;
          id: string;
          lesson: string;
          organization_id: string;
          session_id: string;
        };
        ComputedFields: never;
        Insert: {
          applies_to?: Database["public"]["Enums"]["lesson_applies_to"];
          created_at?: string;
          created_by?: string | null;
          evidence?: string | null;
          id?: string;
          lesson: string;
          organization_id: string;
          session_id: string;
        };
        Update: {
          applies_to?: Database["public"]["Enums"]["lesson_applies_to"];
          created_at?: string;
          created_by?: string | null;
          evidence?: string | null;
          id?: string;
          lesson?: string;
          organization_id?: string;
          session_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "session_lessons_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "session_lessons_organization_id_session_id_fkey";
            columns: ["organization_id", "session_id"];
            isOneToOne: false;
            referencedRelation: "learning_sessions";
            referencedColumns: ["organization_id", "id"];
          },
        ];
      };
      session_proposals: {
        Row: {
          created_at: string;
          id: string;
          organization_id: string;
          proposal_id: string;
          session_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          organization_id: string;
          proposal_id: string;
          session_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          organization_id?: string;
          proposal_id?: string;
          session_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "session_proposals_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "session_proposals_organization_id_proposal_id_fkey";
            columns: ["organization_id", "proposal_id"];
            isOneToOne: false;
            referencedRelation: "proposals";
            referencedColumns: ["organization_id", "id"];
          },
          {
            foreignKeyName: "session_proposals_organization_id_session_id_fkey";
            columns: ["organization_id", "session_id"];
            isOneToOne: false;
            referencedRelation: "learning_sessions";
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
      touches: {
        Row: {
          contact_id: string;
          created_at: string;
          direction: Database["public"]["Enums"]["touch_direction"];
          grant_id: string | null;
          happened_at: string;
          id: string;
          kind: Database["public"]["Enums"]["touch_kind"];
          logged_by: string | null;
          organization_id: string;
          session_id: string | null;
          summary: string;
        };
        ComputedFields: never;
        Insert: {
          contact_id: string;
          created_at?: string;
          direction: Database["public"]["Enums"]["touch_direction"];
          grant_id?: string | null;
          happened_at?: string;
          id?: string;
          kind: Database["public"]["Enums"]["touch_kind"];
          logged_by?: string | null;
          organization_id: string;
          session_id?: string | null;
          summary: string;
        };
        Update: {
          contact_id?: string;
          created_at?: string;
          direction?: Database["public"]["Enums"]["touch_direction"];
          grant_id?: string | null;
          happened_at?: string;
          id?: string;
          kind?: Database["public"]["Enums"]["touch_kind"];
          logged_by?: string | null;
          organization_id?: string;
          session_id?: string | null;
          summary?: string;
        };
        Relationships: [
          {
            foreignKeyName: "touches_organization_id_contact_id_fkey";
            columns: ["organization_id", "contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["organization_id", "id"];
          },
          {
            foreignKeyName: "touches_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "touches_organization_id_grant_id_fkey";
            columns: ["organization_id", "grant_id"];
            isOneToOne: false;
            referencedRelation: "grants";
            referencedColumns: ["organization_id", "id"];
          },
          {
            foreignKeyName: "touches_organization_id_session_id_fkey";
            columns: ["organization_id", "session_id"];
            isOneToOne: false;
            referencedRelation: "learning_sessions";
            referencedColumns: ["organization_id", "id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      accept_learning_proposal: {
        Args: { p_proposal_id: string; p_record: Json };
        Returns: string;
      };
      create_organization: { Args: { p_name: string }; Returns: string };
      record_learning_proposals: {
        Args: { p_items: Json; p_session_id: string };
        Returns: string[];
      };
      supersede_knowledge_fact: {
        Args: {
          p_confidence: Database["public"]["Enums"]["knowledge_confidence"];
          p_fact: string;
          p_old_id: string;
          p_source_kind: Database["public"]["Enums"]["knowledge_source_kind"];
          p_source_ref: string;
        };
        Returns: string;
      };
    };
    Enums: {
      actor_kind: "person" | "agent" | "system";
      award_payment_method: "reimbursement" | "advance" | "lump_sum" | "other";
      award_report_kind:
        "financial" | "performance" | "final_financial" | "final_performance" | "other";
      award_report_status: "due" | "submitted" | "accepted";
      contact_publishability: "private" | "public";
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
      indirect_cost_method: "de_minimis" | "negotiated_rate" | "none" | "other";
      knowledge_confidence: "stated" | "likely" | "guess";
      knowledge_source_kind: "filing" | "website" | "document" | "person" | "ai";
      knowledge_status: "proposed" | "confirmed" | "superseded";
      knowledge_subject_kind: "organization" | "funder" | "opportunity" | "contact" | "grant";
      learning_session_status: "open" | "closed";
      lesson_applies_to: "prospecting" | "outreach" | "application" | "post_award" | "general";
      membership_role: "owner" | "admin" | "editor" | "viewer";
      opportunity_status: "forecasted" | "open" | "closed" | "custom";
      organization_kind: "seeker" | "funder" | "company";
      pipeline_preset: "standard" | "sbir";
      playbook_key:
        | "seeker-prospecting"
        | "seeker-outreach"
        | "application-prep"
        | "post-award-reporting"
        | "funder-grantee-outreach"
        | "company-nondilutive";
      proposal_status: "proposed" | "accepted" | "rejected";
      reminder_mode: "each" | "digest" | "off";
      report_frequency: "quarterly" | "semiannual" | "annual" | "none";
      task_status: "open" | "done";
      touch_direction: "out" | "in";
      touch_kind: "email" | "call" | "meeting" | "letter" | "note";
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
      award_payment_method: ["reimbursement", "advance", "lump_sum", "other"],
      award_report_kind: [
        "financial",
        "performance",
        "final_financial",
        "final_performance",
        "other",
      ],
      award_report_status: ["due", "submitted", "accepted"],
      contact_publishability: ["private", "public"],
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
      indirect_cost_method: ["de_minimis", "negotiated_rate", "none", "other"],
      knowledge_confidence: ["stated", "likely", "guess"],
      knowledge_source_kind: ["filing", "website", "document", "person", "ai"],
      knowledge_status: ["proposed", "confirmed", "superseded"],
      knowledge_subject_kind: ["organization", "funder", "opportunity", "contact", "grant"],
      learning_session_status: ["open", "closed"],
      lesson_applies_to: ["prospecting", "outreach", "application", "post_award", "general"],
      membership_role: ["owner", "admin", "editor", "viewer"],
      opportunity_status: ["forecasted", "open", "closed", "custom"],
      organization_kind: ["seeker", "funder", "company"],
      pipeline_preset: ["standard", "sbir"],
      playbook_key: [
        "seeker-prospecting",
        "seeker-outreach",
        "application-prep",
        "post-award-reporting",
        "funder-grantee-outreach",
        "company-nondilutive",
      ],
      proposal_status: ["proposed", "accepted", "rejected"],
      reminder_mode: ["each", "digest", "off"],
      report_frequency: ["quarterly", "semiannual", "annual", "none"],
      task_status: ["open", "done"],
      touch_direction: ["out", "in"],
      touch_kind: ["email", "call", "meeting", "letter", "note"],
    },
  },
} as const;
