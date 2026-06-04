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
          tour_completed_at: string | null;
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
          tour_completed_at?: string | null;
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
      plan_subscriptions: {
        Row: {
          id: string;
          organization_id: string;
          plan_id: string;
          billing_cycle: 'monthly' | 'yearly';
          status: 'trialing' | 'active' | 'past_due' | 'suspended' | 'trial_expired' | 'cancelled' | 'expired';
          trial_started_at: string | null;
          trial_ends_at: string | null;
          current_period_started_at: string;
          current_period_ends_at: string;
          cancel_at_period_end: boolean;
          mp_preapproval_id: string | null;
          mp_external_reference: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          plan_id: string;
          billing_cycle: 'monthly' | 'yearly';
          status: 'trialing' | 'active' | 'past_due' | 'suspended' | 'trial_expired' | 'cancelled' | 'expired';
          trial_started_at?: string | null;
          trial_ends_at?: string | null;
          current_period_started_at: string;
          current_period_ends_at: string;
          cancel_at_period_end?: boolean;
          mp_preapproval_id?: string | null;
          mp_external_reference?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['plan_subscriptions']['Insert']>;
        Relationships: [];
      };
      ai_usage_counters: {
        Row: {
          id: string;
          subscription_id: string;
          period_started_at: string;
          period_ends_at: string;
          skin_diagnosis_used: number;
          protocol_generator_used: number;
          skin_diagnosis_bonus_quota: number;
          protocol_generator_bonus_quota: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          subscription_id: string;
          period_started_at: string;
          period_ends_at: string;
          skin_diagnosis_used?: number;
          protocol_generator_used?: number;
          skin_diagnosis_bonus_quota?: number;
          protocol_generator_bonus_quota?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['ai_usage_counters']['Insert']>;
        Relationships: [];
      };
      ai_addon_purchases: {
        Row: {
          id: string;
          subscription_id: string;
          addon_type: string;
          quantity_added: number;
          amount_ars: number;
          status: 'pending' | 'paid' | 'failed';
          mp_payment_id: string | null;
          mp_external_reference: string | null;
          applied_to_period_start: string | null;
          applied_to_period_end: string | null;
          paid_at: string | null;
          failed_at: string | null;
          failed_reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          subscription_id: string;
          addon_type: string;
          quantity_added: number;
          amount_ars: number;
          status?: 'pending' | 'paid' | 'failed';
          mp_payment_id?: string | null;
          mp_external_reference?: string | null;
          applied_to_period_start?: string | null;
          applied_to_period_end?: string | null;
          paid_at?: string | null;
          failed_at?: string | null;
          failed_reason?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['ai_addon_purchases']['Insert']>;
        Relationships: [];
      };
      saas_invoices: {
        Row: {
          id: string;
          subscription_id: string;
          amount_ars: number;
          billing_period_start: string;
          billing_period_end: string;
          invoice_kind: 'subscription' | 'addon' | 'upgrade_diff';
          status: 'pending' | 'paid' | 'failed' | 'refunded';
          mp_payment_id: string | null;
          mp_external_reference: string | null;
          paid_at: string | null;
          failed_at: string | null;
          failed_reason: string | null;
          attempts: number;
          next_retry_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          subscription_id: string;
          amount_ars: number;
          billing_period_start: string;
          billing_period_end: string;
          invoice_kind?: 'subscription' | 'addon' | 'upgrade_diff';
          status?: 'pending' | 'paid' | 'failed' | 'refunded';
          mp_payment_id?: string | null;
          mp_external_reference?: string | null;
          paid_at?: string | null;
          failed_at?: string | null;
          failed_reason?: string | null;
          attempts?: number;
          next_retry_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['saas_invoices']['Insert']>;
        Relationships: [];
      };
      plan_change_events: {
        Row: {
          id: string;
          subscription_id: string;
          from_plan: string;
          to_plan: string;
          from_billing_cycle: string | null;
          to_billing_cycle: string | null;
          effective_at: string;
          applied_at: string | null;
          charge_amount_ars: number | null;
          saas_invoice_id: string | null;
          triggered_by_user_id: string | null;
          reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          subscription_id: string;
          from_plan: string;
          to_plan: string;
          from_billing_cycle?: string | null;
          to_billing_cycle?: string | null;
          effective_at: string;
          applied_at?: string | null;
          charge_amount_ars?: number | null;
          saas_invoice_id?: string | null;
          triggered_by_user_id?: string | null;
          reason?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['plan_change_events']['Insert']>;
        Relationships: [];
      };
      help_chat_messages: {
        Row: {
          id: string;
          user_id: string;
          organization_id: string;
          role: 'user' | 'assistant';
          content: string;
          tokens_used: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          organization_id: string;
          role: 'user' | 'assistant';
          content: string;
          tokens_used?: number | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['help_chat_messages']['Insert']>;
        Relationships: [];
      };
      onboarding_recovery_emails: {
        Row: {
          id: string;
          user_id: string;
          email_kind: 'recovery_1' | 'recovery_2' | 'recovery_3';
          email_to: string;
          sent_at: string;
          resend_message_id: string | null;
          failed_reason: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          email_kind: 'recovery_1' | 'recovery_2' | 'recovery_3';
          email_to: string;
          sent_at?: string;
          resend_message_id?: string | null;
          failed_reason?: string | null;
        };
        Update: Partial<Database['public']['Tables']['onboarding_recovery_emails']['Insert']>;
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
      platform_org_stats: {
        Args: Record<string, never>;
        Returns: {
          org_id: string;
          name: string;
          slug: string | null;
          created_at: string;
          onboarded_at: string | null;
          plan_id: string | null;
          sub_status: string | null;
          trial_ends_at: string | null;
          whatsapp_status: string | null;
          whatsapp_provider: string | null;
          has_mp: boolean;
          afip_provider: string | null;
          services_count: number;
          clients_count: number;
          active_clients_count: number;
          appointments_count: number;
          appointments_last_30d: number;
          staff_count: number;
          last_activity_at: string | null;
        }[];
      };
      platform_users: {
        Args: Record<string, never>;
        Returns: {
          user_id: string;
          email: string;
          created_at: string;
          email_confirmed_at: string | null;
          last_sign_in_at: string | null;
          membership_id: string | null;
          org_id: string | null;
          org_name: string | null;
          org_slug: string | null;
          role: 'owner' | 'admin' | 'professional' | 'receptionist' | null;
          display_name: string | null;
          membership_active: boolean | null;
          membership_created_at: string | null;
          invitation_accepted_at: string | null;
        }[];
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
