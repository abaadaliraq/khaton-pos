import { LoginForm } from "@/components/auth/LoginForm";
import Image from "next/image";

export default function LoginPage() {
  return (
    <main dir="rtl" className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#292929] px-4 py-8">
      <Image
        src="/login/khaton-login.jpg"
        alt=""
        fill
        sizes="100vw"
        className="object-cover"
        priority
      />
      <div className="absolute inset-0 bg-black/70" />
      <div className="absolute inset-0 bg-[#292929]/45" />
      <div className="relative z-10 w-full">
        <LoginForm variant="immersive" />
      </div>
    </main>
  );
}
