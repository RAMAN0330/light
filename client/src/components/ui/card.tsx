import type { HTMLAttributes, PropsWithChildren } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "elevated" | "interactive" | "teal-glow" | "subtle";
}

export function Card({
  children,
  variant = "default",
  className = "",
  ...props
}: PropsWithChildren<CardProps>) {
  const variantStyles = {
    default: "bg-white border border-[#e1ebe9] shadow-sm",
    elevated: "bg-white border border-[#d3e3e0] shadow-md hover:shadow-lg transition-shadow duration-300",
    interactive: "bg-white border border-[#e1ebe9] hover:border-[#14b8a6]/40 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer",
    "teal-glow": "bg-white border border-[#0d9488]/30 shadow-[0_4px_20px_-4px_rgba(13,148,136,0.15)] hover:border-[#0d9488]/60 transition-all duration-300",
    subtle: "bg-[#f4f7f6] border border-[#e5eeec]",
  };

  return (
    <div
      className={`rounded-xl p-5 ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
