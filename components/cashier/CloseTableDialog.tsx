import { X } from "lucide-react";

type CloseTableDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function CloseTableDialog({ isOpen, onClose, onConfirm }: CloseTableDialogProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="cashier-no-print fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-4 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[#2C211D]">إغلاق الطاولة</h2>
          <button type="button" onClick={onClose} className="rounded-lg border border-[#d8c9b7] p-2">
            <X size={18} />
          </button>
        </div>
        <p className="mt-4 leading-7 text-[#6f5b52]">هل تريد إغلاق حساب الطاولة وتحريرها؟</p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button type="button" onClick={onConfirm} className="h-11 rounded-lg bg-[#7B3F32] font-semibold text-white">
            تأكيد الإغلاق
          </button>
          <button type="button" onClick={onClose} className="h-11 rounded-lg border border-[#d8c9b7]">
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}
