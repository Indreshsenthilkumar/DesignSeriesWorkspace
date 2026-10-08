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
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[10px] p-0.5 ${className ?? ""}`}
      style={{
        width: size,
        height: size,
        background: "var(--surface-sunken)",
        border: "1px solid var(--line-default)",
      }}
    >
      <Image
        src="/brand/designseries-logo.png"
        alt="DesignSeries"
        width={size}
        height={size}
        priority
        className="h-full w-full object-contain rounded-md"
      />
    </div>
  );
}

/** Mark + product name lockup. */
export function LogoLockup({
  height = 28,
  subtitle = "Portal",
  className,
}: {
  height?: number;
  subtitle?: string;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-3 ${className ?? ""}`}>
      <div
        className="relative shrink-0 overflow-hidden rounded-lg"
        style={{
          width: height + 6,
          height: height + 6,
          background: "var(--surface-sunken)",
          border: "1px solid var(--line-default)",
          padding: 2,
        }}
      >
        <Image
          src="/brand/designseries-logo.png"
          alt="DesignSeries"
          width={height + 6}
          height={height + 6}
          priority
          className="h-full w-full object-contain"
        />
      </div>
      <div className="flex flex-col">
        <span className="font-bold leading-tight tracking-tight text-foreground text-[16px]">
          Design<span className="text-[var(--color-brand-blue)]">Series</span>
        </span>
        {subtitle ? (
          <span
            className="text-[9.5px] font-semibold uppercase tracking-[0.14em]"
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
