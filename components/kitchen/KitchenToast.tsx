type KitchenToastProps = {
  message: string;
};

export function KitchenToast({ message }: KitchenToastProps) {
  if (!message) {
    return null;
  }

  return (
    <div className="fixed left-4 right-4 top-24 z-50 mx-auto max-w-md rounded-lg border border-[#D8C8B7] bg-white px-4 py-3 text-center font-bold text-[#2C211D] shadow-lg">
      {message}
    </div>
  );
}
