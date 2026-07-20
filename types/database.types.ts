export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          full_name: string;
          role: "captain" | "cashier" | "kitchen" | "admin";
          status: "active" | "inactive" | "suspended";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username: string;
          full_name: string;
          role: "captain" | "cashier" | "kitchen" | "admin";
          status?: "active" | "inactive" | "suspended";
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
      };
      restaurant_tables: {
        Row: {
          id: string;
          table_number: number;
          name: string | null;
          capacity: number | null;
          status: "available" | "occupied" | "cleaning";
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          table_number: number;
          name?: string | null;
          capacity?: number | null;
          status?: "available" | "occupied" | "cleaning";
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["restaurant_tables"]["Insert"]>;
      };
      menu_categories: {
        Row: {
          id: string;
          name_ar: string;
          name_en: string | null;
          sort_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name_ar: string;
          name_en?: string | null;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["menu_categories"]["Insert"]>;
      };
      menu_items: {
        Row: {
          id: string;
          category_id: string;
          name_ar: string;
          name_en: string | null;
          description_ar: string | null;
          price: number | null;
          preparation_station: "kitchen" | "barista" | "drinks" | "shisha";
          is_available: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          category_id: string;
          name_ar: string;
          name_en?: string | null;
          description_ar?: string | null;
          price?: number | null;
          preparation_station?: "kitchen" | "barista" | "drinks" | "shisha";
          is_available?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["menu_items"]["Insert"]>;
      };
      orders: {
        Row: {
          id: string;
          order_number: number;
          table_id: string;
          captain_id: string;
          status: "draft" | "submitted" | "preparing" | "ready" | "served" | "awaiting_payment" | "paid" | "cancelled";
          guest_count: number | null;
          general_notes: string | null;
          subtotal: number;
          discount_amount: number;
          service_charge: number;
          total: number;
          opened_at: string;
          submitted_at: string | null;
          served_at: string | null;
          paid_at: string | null;
          closed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          table_id: string;
          captain_id: string;
          status?: Database["public"]["Tables"]["orders"]["Row"]["status"];
          guest_count?: number | null;
          general_notes?: string | null;
          subtotal?: number;
          discount_amount?: number;
          service_charge?: number;
          total?: number;
          opened_at?: string;
          submitted_at?: string | null;
          served_at?: string | null;
          paid_at?: string | null;
          closed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["orders"]["Insert"]>;
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          menu_item_id: string;
          item_name_snapshot: string;
          unit_price: number;
          quantity: number;
          notes: string | null;
          preparation_station: "kitchen" | "barista" | "drinks" | "shisha";
          status: "submitted" | "preparing" | "ready" | "served" | "cancelled";
          sent_at: string;
          started_at: string | null;
          ready_at: string | null;
          served_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          menu_item_id: string;
          item_name_snapshot: string;
          unit_price: number;
          quantity: number;
          notes?: string | null;
          preparation_station: "kitchen" | "barista" | "drinks" | "shisha";
          status?: "submitted" | "preparing" | "ready" | "served" | "cancelled";
          sent_at?: string;
          started_at?: string | null;
          ready_at?: string | null;
          served_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["order_items"]["Insert"]>;
      };
      payments: {
        Row: {
          id: string;
          order_id: string;
          cashier_id: string;
          method: "cash" | "card" | "transfer";
          amount: number;
          reference: string | null;
          status: "completed" | "voided";
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          cashier_id: string;
          method: "cash" | "card" | "transfer";
          amount: number;
          reference?: string | null;
          status?: "completed" | "voided";
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["payments"]["Insert"]>;
      };
      order_status_events: {
        Row: {
          id: string;
          order_id: string;
          from_status: string | null;
          to_status: string;
          changed_by: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          from_status?: string | null;
          to_status: string;
          changed_by?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["order_status_events"]["Insert"]>;
      };
      audit_logs: {
        Row: {
          id: string;
          user_id: string | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          old_data: Json | null;
          new_data: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          action: string;
          entity_type: string;
          entity_id?: string | null;
          old_data?: Json | null;
          new_data?: Json | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["audit_logs"]["Insert"]>;
      };
    };
    Views: Record<string, never>;
    Functions: {
      current_user_role: { Args: Record<string, never>; Returns: string | null };
      create_restaurant_order: {
        Args: { p_table_id: string; p_items: Json; p_guest_count?: number | null; p_general_notes?: string | null };
        Returns: Json;
      };
      update_kitchen_order_status: { Args: { p_order_id: string; p_next_status: string }; Returns: Json };
      get_kitchen_order_queue: { Args: Record<string, never>; Returns: Json };
      record_order_payment: { Args: { p_order_id: string; p_payments: Json }; Returns: Json };
      apply_order_discount: { Args: { p_order_id: string; p_discount_amount: number; p_reason: string }; Returns: Json };
      close_paid_table: { Args: { p_order_id: string }; Returns: Json };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
