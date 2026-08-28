export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          full_name: string;
          role: "captain" | "cashier" | "kitchen" | "admin" | "storekeeper" | "accountant" | "owner";
          status: "active" | "inactive" | "suspended";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username: string;
          full_name: string;
          role: "captain" | "cashier" | "kitchen" | "admin" | "storekeeper" | "accountant" | "owner";
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
      staff_members: {
        Row: {
          id: string;
          employee_number: number;
          profile_id: string | null;
          full_name: string;
          phone: string | null;
          secondary_phone: string | null;
          job_title: string;
          department: "service" | "cashier" | "kitchen" | "management" | "cleaning" | "barista" | "shisha" | "inventory" | "finance" | "other";
          employment_type: "full_time" | "part_time" | "temporary";
          shift_type: "morning" | "evening" | "night" | "rotating" | "fixed";
          hire_date: string | null;
          birth_date: string | null;
          salary: number | null;
          address: string | null;
          emergency_contact_name: string | null;
          emergency_contact_phone: string | null;
          notes: string | null;
          status: "active" | "on_leave" | "inactive" | "terminated";
          has_system_access: boolean;
          created_by: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          employee_number?: number;
          profile_id?: string | null;
          full_name: string;
          phone?: string | null;
          secondary_phone?: string | null;
          job_title: string;
          department: Database["public"]["Tables"]["staff_members"]["Row"]["department"];
          employment_type?: Database["public"]["Tables"]["staff_members"]["Row"]["employment_type"];
          shift_type?: Database["public"]["Tables"]["staff_members"]["Row"]["shift_type"];
          hire_date?: string | null;
          birth_date?: string | null;
          salary?: number | null;
          address?: string | null;
          emergency_contact_name?: string | null;
          emergency_contact_phone?: string | null;
          notes?: string | null;
          status?: Database["public"]["Tables"]["staff_members"]["Row"]["status"];
          has_system_access?: boolean;
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["staff_members"]["Insert"]>;
      };
      expenses: {
        Row: {
          id: string;
          expense_number: number;
          amount: number;
          category: "electricity" | "water" | "internet" | "generator" | "maintenance" | "cleaning" | "transport" | "marketing" | "external_services" | "other";
          expense_date: string;
          payment_method: "cash" | "card" | "transfer";
          receipt_number: string | null;
          description: string;
          notes: string | null;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          expense_number?: number;
          amount: number;
          category: Database["public"]["Tables"]["expenses"]["Row"]["category"];
          expense_date?: string;
          payment_method: Database["public"]["Tables"]["expenses"]["Row"]["payment_method"];
          receipt_number?: string | null;
          description: string;
          notes?: string | null;
          created_by: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["expenses"]["Insert"]>;
      };
      suppliers: {
        Row: {
          id: string;
          name: string;
          phone: string | null;
          address: string | null;
          notes: string | null;
          is_active: boolean;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          phone?: string | null;
          address?: string | null;
          notes?: string | null;
          is_active?: boolean;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["suppliers"]["Insert"]>;
      };
      purchases: {
        Row: {
          id: string;
          purchase_number: number;
          client_request_id: string;
          supplier_id: string;
          supplier_invoice_number: string | null;
          supplier_invoice_date: string | null;
          total_amount: number;
          notes: string | null;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          purchase_number?: number;
          client_request_id: string;
          supplier_id: string;
          supplier_invoice_number?: string | null;
          supplier_invoice_date?: string | null;
          total_amount?: number;
          notes?: string | null;
          created_by: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["purchases"]["Insert"]>;
      };
      purchase_items: {
        Row: {
          id: string;
          purchase_id: string;
          inventory_item_id: string;
          quantity: number;
          unit_id: string;
          unit_price: number;
          line_total: number;
          quantity_base: number;
          unit_cost_base: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          purchase_id: string;
          inventory_item_id: string;
          quantity: number;
          unit_id: string;
          unit_price: number;
          line_total: number;
          quantity_base: number;
          unit_cost_base: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["purchase_items"]["Insert"]>;
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
      create_staff_member: {
        Args: {
          p_full_name: string;
          p_phone?: string | null;
          p_secondary_phone?: string | null;
          p_job_title?: string | null;
          p_department?: string;
          p_employment_type?: string;
          p_shift_type?: string;
          p_hire_date?: string | null;
          p_birth_date?: string | null;
          p_salary?: number | null;
          p_address?: string | null;
          p_emergency_contact_name?: string | null;
          p_emergency_contact_phone?: string | null;
          p_notes?: string | null;
        };
        Returns: Database["public"]["Tables"]["staff_members"]["Row"];
      };
      update_staff_member: {
        Args: {
          p_staff_id: string;
          p_full_name: string;
          p_phone?: string | null;
          p_secondary_phone?: string | null;
          p_job_title?: string | null;
          p_department?: string;
          p_employment_type?: string;
          p_shift_type?: string;
          p_hire_date?: string | null;
          p_birth_date?: string | null;
          p_salary?: number | null;
          p_address?: string | null;
          p_emergency_contact_name?: string | null;
          p_emergency_contact_phone?: string | null;
          p_notes?: string | null;
        };
        Returns: Database["public"]["Tables"]["staff_members"]["Row"];
      };
      update_staff_status: { Args: { p_staff_id: string; p_status: string }; Returns: Database["public"]["Tables"]["staff_members"]["Row"] };
      update_staff_system_access: { Args: { p_staff_id: string; p_is_active: boolean }; Returns: Database["public"]["Tables"]["staff_members"]["Row"] };
      link_staff_system_profile: { Args: { p_staff_id: string; p_profile_id: string; p_username: string; p_role: string }; Returns: Database["public"]["Tables"]["staff_members"]["Row"] };
      create_expense: {
        Args: {
          p_amount: number;
          p_category: string;
          p_payment_method: string;
          p_receipt_number?: string | null;
          p_description?: string | null;
          p_notes?: string | null;
        };
        Returns: Database["public"]["Tables"]["expenses"]["Row"];
      };
      create_inventory_purchase: {
        Args: {
          p_client_request_id: string;
          p_supplier_id: string;
          p_supplier_invoice_number?: string | null;
          p_supplier_invoice_date?: string | null;
          p_notes?: string | null;
          p_items?: Json;
        };
        Returns: Json;
      };
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

