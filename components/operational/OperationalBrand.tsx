import Image from "next/image";

type OperationalBrandProps = {
  title: string;
  subtitle: string;
  meta?: string;
  variant?: "dark" | "light";
};

export function OperationalBrand({ title, subtitle, meta, variant = "dark" }: OperationalBrandProps) {
  return (
    <div className="operational-brand" data-variant={variant}>
      <Image
        src="/brand/khaton-logo.png"
        alt="Khatoun"
        width={58}
        height={58}
        className="operational-brand-logo"
        priority
      />
      <div className="min-w-0">
        <p className="operational-brand-name">KHATOUN / خاتون</p>
        <h1 className="operational-brand-title">{title}</h1>
        <p className="operational-brand-subtitle">{subtitle}</p>
        {meta ? <p className="operational-brand-meta">{meta}</p> : null}
      </div>
    </div>
  );
}
