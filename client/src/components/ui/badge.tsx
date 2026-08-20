import type { HTMLAttributes, PropsWithChildren } from "react";

export type BadgeVariant = "teal" | "emerald" | "amber" | "rose" | "cyan" | "slate" | "outline";
export type BadgeSize = "sm" | "md" | "lg";

const variantStyles: Record<BadgeVariant, string> = {
  teal: "bg-teal-500/10 text-teal-700 border-teal-500/20 font-medium",
  emerald: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 font-medium",
  amber: "bg-amber-500/10 text-amber-800 border-amber-500/20 font-medium",
  rose: "bg-rose-500/10 text-rose-700 border-rose-500/20 font-medium",
  cyan: "bg-cyan-500/10 text-cyan-800 border-cyan-500/20 font-medium",
  slate: "bg-slate-500/10 text-slate-700 border-slate-500/20 font-medium",
  outline: "bg-transparent text-slate-600 border-slate-200 font-medium",
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: "text-[0.68rem] px-2 py-0.5 gap-1.5 rounded-md",
  md: "text-[0.75rem] px-2.5 py-1 gap-1.5 rounded-lg",
  lg: "text-[0.82rem] px-3 py-1.5 gap-2 rounded-lg",
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  pulse?: boolean;
}

export function Badge({
  children,
  variant = "teal",
  size = "md",
  dot = false,
  pulse = false,
  className = "",
  ...props
}: PropsWithChildren<BadgeProps>) {
  return (
    <span
      className={`inline-flex items-center justify-center border font-semibold tracking-wide transition-all duration-200 ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {dot && (
        <span className="relative flex h-2 w-2">
          {pulse && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75" />
          )}
          <span className="relative inline-flex rounded-full h-2 w-2 bg-current" />
        </span>
      )}
      {children}
    </span>
  );
}
