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
          subscription_tier: string;
          trial_ends_at: string;
          onboarded_at: string | null;
          afip_provider: 'tusfacturas' | 'direct' | 'manual' | null;
          afip_config: Json | null;
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
          subscription_tier?: string;
          trial_ends_at?: string;
          onboarded_at?: string | null;
          afip_provider?: 'tusfacturas' | 'direct' | 'manual' | null;
          afip_config?: Json | null;
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
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['memberships']['Insert']>;
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
