import { cn } from "@/lib/utils";

type LogoIconProps = {
  className?: string;
  title?: string;
};

/** Ícone do Orçô: folha de orçamento com visto (docs/12-identidade-visual.md). */
export function LogoIcon({ className, title = "Orçô" }: LogoIconProps) {
  return (
    <svg
      viewBox="0 0 48 48"
      role="img"
      aria-label={title}
      className={cn("size-12 shrink-0", className)}
    >
      <rect width="48" height="48" rx="10" fill="#0F766E" />
      <path d="M16 11h11l7 7v19a2 2 0 0 1-2 2H16a2 2 0 0 1-2-2V13a2 2 0 0 1 2-2z" fill="#FFFFFF" />
      <path d="M27 11v5a2 2 0 0 0 2 2h5z" fill="#E6F4F2" />
      <path
        d="M19 28l3.5 3.5L29 25"
        fill="none"
        stroke="#0F766E"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
