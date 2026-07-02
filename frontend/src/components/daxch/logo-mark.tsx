import { cn } from "@/lib/utils";

type LogoMarkProps = {
  className?: string;
  size?: number;
  /** Use fixed colors for favicon/export; default uses theme CSS variables */
  variant?: "theme" | "fixed";
  showPulse?: boolean;
};

/**
 * Daxch mark: editorial frame + rising trend + live monitoring dot.
 * The line is your thesis; the dot is the agent watching price action.
 */
export function LogoMark({
  className,
  size = 32,
  variant = "theme",
  showPulse = true,
}: LogoMarkProps) {
  const isTheme = variant === "theme";
  const frameFill = isTheme ? "oklch(var(--paper))" : "#f4efe4";
  const frameStroke = isTheme ? "oklch(var(--ink))" : "#1a1a20";
  const markColor = isTheme ? "oklch(var(--primary))" : "#3a5c4a";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      aria-hidden
    >
      <rect x="1" y="1" width="30" height="30" fill={frameFill} stroke={frameStroke} strokeWidth="1.5" />
      {/* Thesis baseline */}
      <path
        d="M7 22.5 H25"
        stroke={markColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity={isTheme ? 0.35 : 0.4}
      />
      {/* Price trend */}
      <path
        d="M7 22 L11.5 17.5 L15.5 19 L20 12.5 L23.5 9"
        stroke={markColor}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Live monitoring dot */}
      <circle cx="23.5" cy="9" r="2.25" fill={markColor} />
      {showPulse && (
        <circle
          cx="23.5"
          cy="9"
          r="4"
          stroke={markColor}
          strokeWidth="1"
          opacity="0.45"
          className={isTheme ? "pulse-ring" : undefined}
        />
      )}
    </svg>
  );
}
