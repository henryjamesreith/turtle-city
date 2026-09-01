export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type TableDefinition<Row, Insert, Update> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      activity_progress: TableDefinition<
        {
          activity_key: string;
          best_score: Json;
          last_played_at: string | null;
          last_result: Json;
          times_played: number;
          user_id: string;
        },
        {
          activity_key: string;
          best_score?: Json;
          last_played_at?: string | null;
          last_result?: Json;
          times_played?: number;
          user_id: string;
        },
        {
          activity_key?: string;
          best_score?: Json;
          last_played_at?: string | null;
          last_result?: Json;
          times_played?: number;
          user_id?: string;
        }
      >;
      apartments: TableDefinition<
        {
          building_key: string;
          district: string;
          furniture: Json;
          tier: number;
          unit_label: string;
          updated_at: string;
          upgrades: Json;
          user_id: string;
        },
        {
          building_key?: string;
          district?: string;
          furniture?: Json;
          tier?: number;
          unit_label?: string;
          updated_at?: string;
          upgrades?: Json;
          user_id: string;
        },
        {
          building_key?: string;
          district?: string;
          furniture?: Json;
          tier?: number;
          unit_label?: string;
          updated_at?: string;
          upgrades?: Json;
          user_id?: string;
        }
      >;
      inventory_items: TableDefinition<
        {
          acquired_at: string;
          equipped: boolean;
          item_key: string;
          metadata: Json;
          quantity: number;
          user_id: string;
        },
        {
          acquired_at?: string;
          equipped?: boolean;
          item_key: string;
          metadata?: Json;
          quantity?: number;
          user_id: string;
        },
        {
          acquired_at?: string;
          equipped?: boolean;
          item_key?: string;
          metadata?: Json;
          quantity?: number;
          user_id?: string;
        }
      >;
      item_catalog: TableDefinition<
        {
          category: string;
          created_at: string;
          description: string;
          is_active: boolean;
          item_key: string;
          metadata: Json;
          name: string;
        },
        {
          category: string;
          created_at?: string;
          description?: string;
          is_active?: boolean;
          item_key: string;
          metadata?: Json;
          name: string;
        },
        {
          category?: string;
          created_at?: string;
          description?: string;
          is_active?: boolean;
          item_key?: string;
          metadata?: Json;
          name?: string;
        }
      >;
      player_states: TableDefinition<
        {
          last_district: string;
          last_location: string;
          location_data: Json;
          updated_at: string;
          user_id: string;
        },
        {
          last_district?: string;
          last_location?: string;
          location_data?: Json;
          updated_at?: string;
          user_id: string;
        },
        {
          last_district?: string;
          last_location?: string;
          location_data?: Json;
          updated_at?: string;
          user_id?: string;
        }
      >;
      profiles: TableDefinition<
        {
          appearance: Json;
          created_at: string;
          home_district: string;
          onboarding_completed_at: string | null;
          personality: string | null;
          turtle_name: string | null;
          turtle_tag: string | null;
          updated_at: string;
          user_id: string;
        },
        {
          appearance?: Json;
          created_at?: string;
          home_district?: string;
          onboarding_completed_at?: string | null;
          personality?: string | null;
          turtle_name?: string | null;
          turtle_tag?: string | null;
          updated_at?: string;
          user_id: string;
        },
        {
          appearance?: Json;
          created_at?: string;
          home_district?: string;
          onboarding_completed_at?: string | null;
          personality?: string | null;
          turtle_name?: string | null;
          turtle_tag?: string | null;
          updated_at?: string;
          user_id?: string;
        }
      >;
      wallets: TableDefinition<
        {
          shells: number;
          updated_at: string;
          user_id: string;
        },
        {
          shells?: number;
          updated_at?: string;
          user_id: string;
        },
        {
          shells?: number;
          updated_at?: string;
          user_id?: string;
        }
      >;
    };
    Views: Record<string, never>;
    Functions: {
      purchase_apartment_upgrade: {
        Args: { requested_item_key: string };
        Returns: Json;
      };
      purchase_shop_item: {
        Args: { requested_item_key: string };
        Returns: Json;
      };
      award_game_win: { Args: { p_activity_key: string; p_run_id: string }; Returns: number };
      upgrade_apartment: { Args: Record<string, never>; Returns: { shells: number; tier: number }[] };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
