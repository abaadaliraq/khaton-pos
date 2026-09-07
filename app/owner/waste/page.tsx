"use client";

import { InventoryWastePanel } from "@/components/inventory/InventoryWastePanel";

export default function OwnerWastePage() {
  return (
    <div className="-mx-4 -my-5 min-h-[calc(100vh-4rem)] bg-[#292929] px-4 py-5 lg:-mx-6 lg:px-6">
      <InventoryWastePanel readOnly onInventoryChanged={() => undefined} />
    </div>
  );
}
