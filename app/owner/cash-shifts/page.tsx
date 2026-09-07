"use client";

import { CashShiftManagementPanel } from "@/components/finance/CashShiftManagementPanel";

export default function OwnerCashShiftsPage() {
  return (
    <div className="-mx-4 -my-5 min-h-[calc(100vh-4rem)] bg-[#292929] px-4 py-5 lg:-mx-6 lg:px-6">
      <CashShiftManagementPanel />
    </div>
  );
}
