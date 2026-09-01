type DashboardHeroProps = {
  title: string;
  eyebrow: string;
  description: string;
  image?: string;
  imagePosition?: string;
  className?: string;
};

const defaultHeroImage = "/images/dashboard/khatoun-dashboard-hero.jpg";

export function DashboardHero({
  title,
  eyebrow,
  description,
  image = defaultHeroImage,
  imagePosition = "center",
  className = "",
}: DashboardHeroProps) {
  return (
    <section
      className={`dashboard-hero relative isolate flex w-full shrink-0 items-end overflow-hidden bg-[#202020] px-4 py-6 sm:px-6 lg:px-8 ${className}`}
      style={{
        backgroundImage: `linear-gradient(to left, rgba(0,0,0,0.15), rgba(0,0,0,0.45)), url("${image}"), linear-gradient(135deg, rgba(255,86,86,0.24), rgba(32,32,32,0.88))`,
        backgroundPosition: imagePosition,
        backgroundRepeat: "no-repeat",
        backgroundSize: "cover",
        height: "clamp(180px, 22vw, 330px)",
      }}
    >
      <div className="relative z-10 max-w-xl text-right">
        <p className="text-xs font-semibold uppercase tracking-normal text-[#ff5656]">{eyebrow}</p>
        <h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">{title}</h1>
        <p className="mt-2 max-w-lg text-sm leading-6 text-zinc-100">{description}</p>
      </div>
    </section>
  );
}

export { defaultHeroImage };
