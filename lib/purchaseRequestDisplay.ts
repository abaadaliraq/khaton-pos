import type { PurchaseRequest } from "@/types/finance";

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 }).format(Number.isFinite(value) ? value : 0);
}

export function purchaseRequestCode(request: PurchaseRequest) {
  return `PR-${String(request.requestNumber).padStart(6, "0")}`;
}

export function purchaseRequestItemQuantityLabel(item: PurchaseRequest["items"][number]) {
  return `${item.inventoryItemName} ${formatNumber(item.quantity)} ${item.unitCode}`;
}

export function purchaseRequestItemsSummary(request: PurchaseRequest, visibleCount = 3) {
  if (request.items.length === 0) return "لا توجد مواد";
  const visible = request.items.slice(0, visibleCount).map(purchaseRequestItemQuantityLabel).join("، ");
  const hiddenCount = request.items.length - visibleCount;
  return hiddenCount > 0 ? `${visible} +${formatNumber(hiddenCount)}` : visible;
}

export function singlePurchaseRequestItemName(request: PurchaseRequest) {
  return request.items.length === 1 ? request.items[0]?.inventoryItemName ?? "لا توجد مواد" : purchaseRequestItemsSummary(request);
}

export function singlePurchaseRequestQuantity(request: PurchaseRequest) {
  if (request.items.length !== 1) return purchaseRequestItemsSummary(request);
  const item = request.items[0];
  return item ? `${formatNumber(item.quantity)} ${item.unitCode}` : "-";
}
