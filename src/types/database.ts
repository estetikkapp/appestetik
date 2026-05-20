// Types crafteados manualmente en Plan 1a basados en las migraciones SQL.
// Cuando Docker esté disponible (o apliquemos contra Supabase cloud),
// regenerar con `npm run db:types` que sobreescribe este archivo con el
// output exacto de `supabase gen types typescript`.

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
      organizations: {
        Row: {
          id: string;
          name: string;
          legal_name: string | null;
          cuit: string | null;
          tax_condition: 'monotributo' | 'responsable_inscripto' | 'exento' | null;
          logo_url: string | null;
          timezone: string;
          slug: string | null;
          legacy_grandfathered: boolean;
          onboarded_at: string | null;
          afip_provider: 'tusfacturas' | 'direct' | 'manual' | null;
          afip_config: Json | null;
          whatsapp_status: 'disconnected' | 'connecting' | 'connected';
          whatsapp_phone: string | null;
          whatsapp_connected_at: string | null;
          whatsapp_provider: 'evolution' | 'cloud_api' | 'local_bridge';
          whatsapp_cloud_config: Json | null;
          mp_config: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          legal_name?: string | null;
          cuit?: string | null;
          tax_condition?: 'monotributo' | 'responsable_inscripto' | 'exento' | null;
          logo_url?: string | null;
          timezone?: string;
          slug?: string | null;
          legacy_grandfathered?: boolean;
          onboarded_at?: string | null;
          afip_provider?: 'tusfacturas' | 'direct' | 'manual' | null;
          afip_config?: Json | null;
          whatsapp_status?: 'disconnected' | 'connecting' | 'connected';
          whatsapp_phone?: string | null;
          whatsapp_connected_at?: string | null;
          whatsapp_provider?: 'evolution' | 'cloud_api' | 'local_bridge';
          whatsapp_cloud_config?: Json | null;
          mp_config?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['organizations']['Insert']>;
        Relationships: [];
      };
      memberships: {
        Row: {
          id: string;
          user_id: string;
          organization_id: string;
          role: 'owner' | 'admin' | 'professional' | 'receptionist';
          display_name: string | null;
          commission_rate: number | null;
          active: boolean;
          invited_by: string | null;
          invitation_accepted_at: string | null;
          schedule_template_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          organization_id: string;
          role: 'owner' | 'admin' | 'professional' | 'receptionist';
          display_name?: string | null;
          commission_rate?: number | null;
          active?: boolean;
          invited_by?: string | null;
          invitation_accepted_at?: string | null;
          schedule_template_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['memberships']['Insert']>;
        Relationships: [];
      };
      schedule_templates: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          attention_windows: Json;
          slot_minutes: number;
          is_default: boolean;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          attention_windows?: Json;
          slot_minutes?: number;
          is_default?: boolean;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['schedule_templates']['Insert']>;
        Relationships: [];
      };
      professional_services: {
        Row: {
          membership_id: string;
          service_id: string;
          organization_id: string;
          created_at: string;
        };
        Insert: {
          membership_id: string;
          service_id: string;
          organization_id: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['professional_services']['Insert']>;
        Relationships: [];
      };
      services: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          category: string | null;
          description: string | null;
          duration_minutes: number;
          buffer_minutes: number | null;
          price_ars: number;
          requires_consent: boolean | null;
          requires_resource_type: string | null;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          category?: string | null;
          description?: string | null;
          duration_minutes: number;
          buffer_minutes?: number | null;
          price_ars: number;
          requires_consent?: boolean | null;
          requires_resource_type?: string | null;
          active?: boolean;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['services']['Insert']>;
        Relationships: [];
      };
      resources: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          type: string;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          type: string;
          active?: boolean;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['resources']['Insert']>;
        Relationships: [];
      };
      clients: {
        Row: {
          id: string;
          organization_id: string;
          full_name: string;
          phone_e164: string | null;
          email: string | null;
          birthdate: string | null;
          dni: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
          last_visit_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          full_name: string;
          phone_e164?: string | null;
          email?: string | null;
          birthdate?: string | null;
          dni?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          last_visit_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['clients']['Insert']>;
        Relationships: [];
      };
      business_hours: {
        Row: {
          id: string;
          organization_id: string;
          day_of_week: number;
          opens_at: string | null;
          closes_at: string | null;
          active: boolean;
        };
        Insert: {
          id?: string;
          organization_id: string;
          day_of_week: number;
          opens_at?: string | null;
          closes_at?: string | null;
          active?: boolean;
        };
        Update: Partial<Database['public']['Tables']['business_hours']['Insert']>;
        Relationships: [];
      };
      appointments: {
        Row: {
          id: string;
          organization_id: string;
          client_id: string;
          professional_id: string | null;
          resource_id: string | null;
          service_id: string;
          starts_at: string;
          ends_at: string;
          status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
          source: 'panel' | 'public' | 'waitlist';
          notes: string | null;
          reminder_sent_at: string | null;
          checked_in_at: string | null;
          completed_at: string | null;
          cancelled_at: string | null;
          cancellation_reason: string | null;
          security_code_hash: string | null;
          cancellation_attempts: number;
          last_cancellation_attempt_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          client_id: string;
          professional_id?: string | null;
          resource_id?: string | null;
          service_id: string;
          starts_at: string;
          ends_at: string;
          status?: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
          source?: 'panel' | 'public' | 'waitlist';
          notes?: string | null;
          reminder_sent_at?: string | null;
          checked_in_at?: string | null;
          completed_at?: string | null;
          cancelled_at?: string | null;
          cancellation_reason?: string | null;
          security_code_hash?: string | null;
          cancellation_attempts?: number;
          last_cancellation_attempt_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['appointments']['Insert']>;
        Relationships: [];
      };
      schedule_blocks: {
        Row: {
          id: string;
          organization_id: string;
          professional_id: string | null;
          resource_id: string | null;
          starts_at: string;
          ends_at: string;
          reason: string;
          all_day: boolean;
          notified_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          professional_id?: string | null;
          resource_id?: string | null;
          starts_at: string;
          ends_at: string;
          reason: string;
          all_day?: boolean;
          notified_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['schedule_blocks']['Insert']>;
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string;
          type: string;
          title: string;
          body: string | null;
          link: string | null;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          user_id: string;
          type: string;
          title: string;
          body?: string | null;
          link?: string | null;
          read_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['notifications']['Insert']>;
        Relationships: [];
      };
      audit_log: {
        Row: {
          id: string;
          organization_id: string;
          actor_user_id: string | null;
          actor_label: string | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          payload: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          actor_user_id?: string | null;
          actor_label?: string | null;
          action: string;
          entity_type: string;
          entity_id?: string | null;
          payload?: Json;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['audit_log']['Insert']>;
        Relationships: [];
      };
      whatsapp_reminder_log: {
        Row: {
          id: string;
          organization_id: string;
          appointment_id: string;
          phone_e164: string;
          message: string;
          sent_at: string;
          error: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          appointment_id: string;
          phone_e164: string;
          message: string;
          sent_at?: string;
          error?: string | null;
        };
        Update: Partial<Database['public']['Tables']['whatsapp_reminder_log']['Insert']>;
        Relationships: [];
      };
      invitations: {
        Row: {
          id: string;
          organization_id: string;
          email: string;
          role: 'admin' | 'professional' | 'receptionist';
          token: string;
          invited_by: string;
          expires_at: string;
          accepted_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          email: string;
          role: 'admin' | 'professional' | 'receptionist';
          token: string;
          invited_by: string;
          expires_at?: string;
          accepted_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['invitations']['Insert']>;
        Relationships: [];
      };
      client_medical_info: {
        Row: {
          id: string;
          client_id: string;
          organization_id: string;
          allergies: string | null;
          medications: string | null;
          pregnancy_status: 'no' | 'si' | 'lactancia' | 'trying' | 'unknown' | null;
          skin_type: 'I' | 'II' | 'III' | 'IV' | 'V' | 'VI' | null;
          contraindications: string | null;
          consent_signed_at: string | null;
          consent_signature_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          organization_id: string;
          allergies?: string | null;
          medications?: string | null;
          pregnancy_status?: 'no' | 'si' | 'lactancia' | 'trying' | 'unknown' | null;
          skin_type?: 'I' | 'II' | 'III' | 'IV' | 'V' | 'VI' | null;
          contraindications?: string | null;
          consent_signed_at?: string | null;
          consent_signature_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['client_medical_info']['Insert']>;
        Relationships: [];
      };
      treatment_sessions: {
        Row: {
          id: string;
          organization_id: string;
          appointment_id: string | null;
          client_id: string;
          professional_id: string | null;
          service_id: string | null;
          performed_at: string;
          parameters: Json;
          photos_before_urls: string[];
          photos_after_urls: string[];
          products_used: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          appointment_id?: string | null;
          client_id: string;
          professional_id?: string | null;
          service_id?: string | null;
          performed_at: string;
          parameters?: Json;
          photos_before_urls?: string[];
          photos_after_urls?: string[];
          products_used?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['treatment_sessions']['Insert']>;
        Relationships: [];
      };
      packages: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          description: string | null;
          service_id: string | null;
          sessions_total: number;
          validity_days: number;
          price_ars: number;
          discount_percentage: number | null;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          description?: string | null;
          service_id?: string | null;
          sessions_total: number;
          validity_days?: number;
          price_ars: number;
          discount_percentage?: number | null;
          active?: boolean;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['packages']['Insert']>;
        Relationships: [];
      };
      client_packages: {
        Row: {
          id: string;
          organization_id: string;
          client_id: string;
          package_id: string;
          sessions_remaining: number;
          expires_at: string;
          purchase_price_ars: number;
          status: 'active' | 'completed' | 'expired' | 'refunded';
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          client_id: string;
          package_id: string;
          sessions_remaining: number;
          expires_at: string;
          purchase_price_ars: number;
          status?: 'active' | 'completed' | 'expired' | 'refunded';
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['client_packages']['Insert']>;
        Relationships: [];
      };
      waitlist_entries: {
        Row: {
          id: string;
          organization_id: string;
          client_id: string;
          service_id: string;
          preferred_date: string | null;
          notes: string | null;
          notified_at: string | null;
          status: 'waiting' | 'notified' | 'booked' | 'cancelled';
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          client_id: string;
          service_id: string;
          preferred_date?: string | null;
          notes?: string | null;
          notified_at?: string | null;
          status?: 'waiting' | 'notified' | 'booked' | 'cancelled';
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['waitlist_entries']['Insert']>;
        Relationships: [];
      };
      bridge_tokens: {
        Row: {
          id: string;
          organization_id: string;
          token_hash: string;
          label: string;
          created_at: string;
          last_seen_at: string | null;
          revoked_at: string | null;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          token_hash: string;
          label?: string;
          created_at?: string;
          last_seen_at?: string | null;
          revoked_at?: string | null;
          created_by?: string | null;
        };
        Update: Partial<Database['public']['Tables']['bridge_tokens']['Insert']>;
        Relationships: [];
      };
      bridge_state: {
        Row: {
          bridge_token_id: string;
          status: 'starting' | 'qr_pending' | 'connecting' | 'ready' | 'disconnected';
          phone_e164: string | null;
          qr_base64: string | null;
          qr_updated_at: string | null;
          last_heartbeat_at: string | null;
          agent_version: string | null;
          agent_os: string | null;
          updated_at: string;
        };
        Insert: {
          bridge_token_id: string;
          status?: 'starting' | 'qr_pending' | 'connecting' | 'ready' | 'disconnected';
          phone_e164?: string | null;
          qr_base64?: string | null;
          qr_updated_at?: string | null;
          last_heartbeat_at?: string | null;
          agent_version?: string | null;
          agent_os?: string | null;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['bridge_state']['Insert']>;
        Relationships: [];
      };
      bridge_commands: {
        Row: {
          id: string;
          organization_id: string;
          bridge_token_id: string | null;
          action: 'send_text' | 'send_media';
          payload: Json;
          status: 'pending' | 'processing' | 'sent' | 'failed' | 'expired';
          attempts: number;
          last_error: string | null;
          created_at: string;
          processed_at: string | null;
          expires_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          bridge_token_id?: string | null;
          action: 'send_text' | 'send_media';
          payload: Json;
          status?: 'pending' | 'processing' | 'sent' | 'failed' | 'expired';
          attempts?: number;
          last_error?: string | null;
          created_at?: string;
          processed_at?: string | null;
          expires_at?: string;
        };
        Update: Partial<Database['public']['Tables']['bridge_commands']['Insert']>;
        Relationships: [];
      };
      payments: {
        Row: {
          id: string;
          organization_id: string;
          client_id: string;
          appointment_id: string | null;
          client_package_id: string | null;
          amount_ars: number;
          method: 'cash' | 'mp_card' | 'mp_link' | 'transfer' | 'package_credit';
          status: 'pending' | 'approved' | 'rejected' | 'refunded' | 'cancelled';
          mp_payment_id: string | null;
          mp_preference_id: string | null;
          mp_payment_link: string | null;
          paid_at: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          client_id: string;
          appointment_id?: string | null;
          client_package_id?: string | null;
          amount_ars: number;
          method: 'cash' | 'mp_card' | 'mp_link' | 'transfer' | 'package_credit';
          status?: 'pending' | 'approved' | 'rejected' | 'refunded' | 'cancelled';
          mp_payment_id?: string | null;
          mp_preference_id?: string | null;
          mp_payment_link?: string | null;
          paid_at?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['payments']['Insert']>;
        Relationships: [];
      };
      invoices: {
        Row: {
          id: string;
          organization_id: string;
          payment_id: string | null;
          client_id: string | null;
          invoice_type: 'A' | 'B' | 'C' | 'M' | 'internal';
          invoice_number: string | null;
          cae: string | null;
          cae_due_date: string | null;
          issued_at: string;
          total_ars: number;
          pdf_url: string | null;
          is_fiscal: boolean;
          provider: 'tusfacturas' | 'direct' | 'manual' | null;
          provider_response: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          payment_id?: string | null;
          client_id?: string | null;
          invoice_type: 'A' | 'B' | 'C' | 'M' | 'internal';
          invoice_number?: string | null;
          cae?: string | null;
          cae_due_date?: string | null;
          issued_at?: string;
          total_ars: number;
          pdf_url?: string | null;
          is_fiscal?: boolean;
          provider?: 'tusfacturas' | 'direct' | 'manual' | null;
          provider_response?: Json | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['invoices']['Insert']>;
        Relationships: [];
      };
      skin_analyses: {
        Row: {
          id: string;
          organization_id: string;
          client_id: string;
          photo_url: string;
          client_age: number | null;
          client_objective: string | null;
          technical_analysis: Json | null;
          ai_report: Json | null;
          scores: Json | null;
          recommended_service_ids: string[];
          pdf_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          client_id: string;
          photo_url: string;
          client_age?: number | null;
          client_objective?: string | null;
          technical_analysis?: Json | null;
          ai_report?: Json | null;
          scores?: Json | null;
          recommended_service_ids?: string[];
          pdf_url?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['skin_analyses']['Insert']>;
        Relationships: [];
      };
      treatment_protocols: {
        Row: {
          id: string;
          organization_id: string;
          client_id: string;
          skin_analysis_id: string | null;
          objective: string;
          client_input: Json | null;
          ai_protocol: Json | null;
          total_sessions: number | null;
          total_price_ars: number | null;
          status: 'draft' | 'presented' | 'accepted' | 'rejected' | 'expired';
          accepted_at: string | null;
          pdf_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          client_id: string;
          skin_analysis_id?: string | null;
          objective: string;
          client_input?: Json | null;
          ai_protocol?: Json | null;
          total_sessions?: number | null;
          total_price_ars?: number | null;
          status?: 'draft' | 'presented' | 'accepted' | 'rejected' | 'expired';
          accepted_at?: string | null;
          pdf_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['treatment_protocols']['Insert']>;
        Relationships: [];
      };
      loyalty_points: {
        Row: {
          client_id: string;
          organization_id: string;
          points_balance: number;
          lifetime_earned: number;
          updated_at: string;
        };
        Insert: {
          client_id: string;
          organization_id: string;
          points_balance?: number;
          lifetime_earned?: number;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['loyalty_points']['Insert']>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      user_org_ids: {
        Args: Record<string, never>;
        Returns: { organization_id: string }[];
      };
      user_is_org_admin: {
        Args: { org_id: string };
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
  };
};

// Helpers para uso en el resto de la app
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];
