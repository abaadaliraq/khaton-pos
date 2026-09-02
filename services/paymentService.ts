"use client";

import { createClient } from "@/lib/supabase/client";
import type { Json } from "@/types/database.types";
import type { PaymentMethod } from "@/types/cashier";

type PaymentInput = {
  method: Exclude<PaymentMethod, "mixed">;
  amount: number;
  reference?: string;
};

export async function applyOrderDiscount(orderId: string, discountAmount: number, reason: string) {
  const supabase = createClient();
  const { error } = await supabase.rpc("apply_order_discount", {
    p_order_id: orderId,
    p_discount_amount: discountAmount,
    p_reason: reason,
  } as never);

  if (error) {
    throw error;
  }
}

export async function recordOrderPayment(orderId: string, payments: PaymentInput[]) {
  const supabase = createClient();
  const { error } = await supabase.rpc("record_order_payment", {
    p_order_id: orderId,
    p_payments: payments as Json,
  } as never);

  if (error) {
    throw error;
  }
}

export async function recordTablePayment(tableSessionId: string, payments: PaymentInput[]) {
  const supabase = createClient();
  const { error } = await supabase.rpc("record_table_payment", {
    p_table_session_id: tableSessionId,
    p_payments: payments as Json,
  } as never);

  if (error) {
    throw error;
  }
}

export async function closePaidTable(orderId: string) {
  const supabase = createClient();
  const { error } = await supabase.rpc("close_paid_table", {
    p_order_id: orderId,
  } as never);

  if (error) {
    throw error;
  }
}
