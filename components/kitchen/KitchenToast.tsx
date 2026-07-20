type KitchenToastProps = {
  message: string;
};

export function KitchenToast({ message }: KitchenToastProps) {
  if (!message) {
    return null;
  }

  return (
    <div className="fixed left-4 right-4 top-24 z-50 mx-auto max-w-md rounded-lg border border-white/10 bg-[#302B27] px-4 py-3 text-center font-medium text-[#FFF8EE] shadow-lg">
      {message}
    </div>
  );
}
