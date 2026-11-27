import Image from "next/image";

/**
 * DesignSeries official brand marks — served from /public/brand.
 */

export function Wordmark({
  height = 28,
  className,
}: {
  height?: number;
  className?: string;
}) {
  return (
    <div className={`relative inline-flex items-center gap-2.5 ${className ?? ""}`} style={{ height }}>
      <Image
        src="/brand/designseries-logo.png"
        alt="DesignSeries"
        width={height}
        height={height}
        priority
        className="h-full w-auto object-contain rounded-md"
      />
      <span className="font-bold tracking-tight text-foreground text-[16px]">
        Design<span className="text-[var(--color-brand-blue)]">Series</span>
      </span>
    </div>
  );
}

/** Square mark — nav rail, mobile bar, favicon source. */
export function LogoMark({
  size = 36,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <div
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden ${className ?? ""}`}
      style={{
        width: size,
        height: size,
      }}
    >
      <Image
        src="/brand/designseries-logo.png"
        alt="DesignSeries"
        width={size}
        height={size}
        priority
        className="h-full w-full object-contain"
      />
    </div>
  );
}

/** Mark + product name lockup. */
export function LogoLockup({
  height = 30,
  subtitle,
  className,
}: {
  height?: number;
  subtitle?: string;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ""}`}>
      <div
        className="relative shrink-0 overflow-hidden"
        style={{
          width: height + 8,
          height: height,
        }}
      >
        <Image
          src="/brand/designseries-logo.png"
          alt="DesignSeries"
          width={height + 8}
          height={height}
          priority
          className="h-full w-full object-contain"
        />
      </div>
      <div className="flex flex-col justify-center">
        <span className="font-bold leading-none tracking-tight text-[var(--text-strong)] text-[16px]">
          Design<span className="text-[var(--color-brand-blue)]">Series</span>
        </span>
        {subtitle ? (
          <span
            className="text-[9.5px] font-semibold uppercase tracking-[0.14em] mt-0.5"
            style={{ color: "var(--text-muted)" }}
          >
            {subtitle}
          </span>
        ) : null}
      </div>
    </span>
  );
}

/** The four-colour rule used as a cap on primary surfaces. */
export function BrandThread({ className = "" }: { className?: string }) {
  return <span aria-hidden className={`brand-thread-bar block h-[3px] w-full ${className}`} />;
}
