import type { PurchasePayment, PurchasePaymentStatus } from "@/types/finance";

export type SupplierStatusFilter = "all" | "active" | "inactive";

export type SupplierInput = {
  name: string;
  phone?: string;
  address?: string;
  notes?: string;
  isActive: boolean;
};

export type SupplierFinancials = {
  purchaseCount: number;
  totalPurchases: number;
  totalPaid: number;
  remaining: number;
  lastPurchaseAt: string | null;
  lastPaymentAt: string | null;
};

export type SupplierPurchaseSummary = {
  id: string;
  purchaseNumber: number;
  supplierInvoiceNumber: string | null;
  supplierInvoiceDate: string | null;
  totalAmount: number;
  paymentStatus: PurchasePaymentStatus;
  createdAt: string;
  payment: PurchasePayment | null;
};

export type SupplierMaterialSummary = {
  inventoryItemId: string;
  name: string;
  totalQuantityBase: number;
  lastUnitPrice: number;
  lastPurchasedAt: string | null;
};

export type AdminSupplierProfile = {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  financials: SupplierFinancials;
  purchases: SupplierPurchaseSummary[];
  materials: SupplierMaterialSummary[];
  payments: PurchasePayment[];
};
