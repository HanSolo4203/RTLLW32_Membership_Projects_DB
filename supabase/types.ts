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
      app_settings: {
        Row: {
          key: string;
          value: number | null;
          text_value: string | null;
          updated_at: string;
        };
        Insert: {
          key: string;
          value?: number | null;
          text_value?: string | null;
          updated_at?: string;
        };
        Update: {
          key?: string;
          value?: number | null;
          text_value?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      attendance: {
        Row: {
          created_at: string;
          guest_id: string | null;
          id: string;
          meeting_id: string;
          member_id: string | null;
          notes: string | null;
          pipeliner_id: string | null;
          status: 'present' | 'apology' | 'absent';
        };
        Insert: {
          created_at?: string;
          guest_id?: string | null;
          id?: string;
          meeting_id: string;
          member_id?: string | null;
          notes?: string | null;
          pipeliner_id?: string | null;
          status: 'present' | 'apology' | 'absent';
        };
        Update: {
          created_at?: string;
          guest_id?: string | null;
          id?: string;
          meeting_id?: string;
          member_id?: string | null;
          notes?: string | null;
          pipeliner_id?: string | null;
          status?: 'present' | 'apology' | 'absent';
        };
        Relationships: [
          {
            foreignKeyName: 'attendance_guest_id_fkey';
            columns: ['guest_id'];
            referencedRelation: 'guests';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'attendance_meeting_id_fkey';
            columns: ['meeting_id'];
            referencedRelation: 'meetings';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'attendance_member_id_fkey';
            columns: ['member_id'];
            referencedRelation: 'members';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'attendance_pipeliner_id_fkey';
            columns: ['pipeliner_id'];
            referencedRelation: 'pipeliners';
            referencedColumns: ['id'];
          }
        ];
      };
      charity_events: {
        Row: {
          created_at: string;
          description: string | null;
          event_date: string;
          event_name: string;
          id: string;
          participant_ids: string[] | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          event_date: string;
          event_name: string;
          id?: string;
          participant_ids?: string[] | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          event_date?: string;
          event_name?: string;
          id?: string;
          participant_ids?: string[] | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      guest_events: {
        Row: {
          contribution: string | null;
          created_at: string;
          event_date: string;
          event_name: string;
          guest_id: string;
          id: string;
          updated_at: string;
        };
        Insert: {
          contribution?: string | null;
          created_at?: string;
          event_date: string;
          event_name: string;
          guest_id: string;
          id?: string;
          updated_at?: string;
        };
        Update: {
          contribution?: string | null;
          created_at?: string;
          event_date?: string;
          event_name?: string;
          guest_id?: string;
          id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'guest_events_guest_id_fkey';
            columns: ['guest_id'];
            referencedRelation: 'guests';
            referencedColumns: ['id'];
          }
        ];
      };
      guests: {
        Row: {
          created_at: string;
          email: string | null;
          first_attendance: string | null;
          full_name: string;
          id: string;
          invited_by: string | null;
          notes: string | null;
          phone: string | null;
          status: string;
          total_meetings: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          email?: string | null;
          first_attendance?: string | null;
          full_name: string;
          id?: string;
          invited_by?: string | null;
          notes?: string | null;
          phone?: string | null;
          status?: string;
          total_meetings?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          email?: string | null;
          first_attendance?: string | null;
          full_name?: string;
          id?: string;
          invited_by?: string | null;
          notes?: string | null;
          phone?: string | null;
          status?: string;
          total_meetings?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'guests_invited_by_fkey';
            columns: ['invited_by'];
            referencedRelation: 'members';
            referencedColumns: ['id'];
          }
        ];
      };
      meetings: {
        Row: {
          created_at: string;
          id: string;
          location: string | null;
          meeting_date: string;
          meeting_month: string;
          meeting_type: string;
          meeting_year: number;
          notes: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          location?: string | null;
          meeting_date: string;
          meeting_month: string;
          meeting_type?: string;
          meeting_year: number;
          notes?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          location?: string | null;
          meeting_date?: string;
          meeting_month?: string;
          meeting_type?: string;
          meeting_year?: number;
          notes?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      members: {
        Row: {
          created_at: string;
          email: string;
          full_name: string;
          id: string;
          join_date: string;
          member_number: string | null;
          phone: string | null;
          profile_photo_url: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          email: string;
          full_name: string;
          id?: string;
          join_date: string;
          member_number?: string | null;
          phone?: string | null;
          profile_photo_url?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          full_name?: string;
          id?: string;
          join_date?: string;
          member_number?: string | null;
          phone?: string | null;
          profile_photo_url?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      pipeliners: {
        Row: {
          business_meetings_count: number;
          charity_events_count: number;
          created_at: string;
          email: string | null;
          full_name: string;
          guest_meetings_count: number;
          id: string;
          is_eligible_for_membership: boolean;
          notes: string | null;
          phone: string | null;
          promoted_from_guest_date: string | null;
          sponsored_by: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          business_meetings_count?: number;
          charity_events_count?: number;
          created_at?: string;
          email?: string | null;
          full_name: string;
          guest_meetings_count?: number;
          id?: string;
          is_eligible_for_membership?: boolean;
          notes?: string | null;
          phone?: string | null;
          promoted_from_guest_date?: string | null;
          sponsored_by?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          business_meetings_count?: number;
          charity_events_count?: number;
          created_at?: string;
          email?: string | null;
          full_name?: string;
          guest_meetings_count?: number;
          id?: string;
          is_eligible_for_membership?: boolean;
          notes?: string | null;
          phone?: string | null;
          promoted_from_guest_date?: string | null;
          sponsored_by?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'pipeliners_sponsored_by_fkey';
            columns: ['sponsored_by'];
            referencedRelation: 'members';
            referencedColumns: ['id'];
          }
        ];
      };
    };
    Views: {
      guest_meeting_counts: {
        Row: {
          apology_count: number;
          absent_count: number;
          created_at: string;
          email: string | null;
          eligible_for_pipeliner: boolean;
          event_count: number;
          first_attendance: string | null;
          full_name: string;
          id: string;
          invited_by: string | null;
          meeting_count: number;
          notes: string | null;
          phone: string | null;
          present_count: number;
          status: string;
          total_meetings: number;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: 'guests_invited_by_fkey';
            columns: ['invited_by'];
            referencedRelation: 'members';
            referencedColumns: ['id'];
          }
        ];
      };
      member_attendance_summary: {
        Row: {
          absent_count: number;
          apology_count: number;
          created_at: string;
          email: string;
          full_name: string;
          id: string;
          join_date: string;
          last_meeting_date: string | null;
          member_number: string | null;
          phone: string | null;
          present_count: number;
          profile_photo_url: string | null;
          status: string;
          total_meetings: number;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      pipeliner_eligibility: {
        Row: {
          business_meetings_count: number;
          charity_event_count: number;
          charity_events_count: number;
          created_at: string;
          email: string | null;
          full_name: string;
          guest_meetings_count: number;
          id: string;
          is_eligible_for_membership: boolean;
          meeting_count: number;
          meets_requirements: boolean;
          notes: string | null;
          phone: string | null;
          promoted_from_guest_date: string | null;
          sponsored_by: string | null;
          status: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: 'pipeliners_sponsored_by_fkey';
            columns: ['sponsored_by'];
            referencedRelation: 'members';
            referencedColumns: ['id'];
          }
        ];
      };
    };
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

