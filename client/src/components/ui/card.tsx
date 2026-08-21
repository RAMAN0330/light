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
    default: "bg-[#2c313a] border border-[#3e4451] shadow-sm",
    elevated: "bg-[#2c313a] border border-[#4b5263] shadow-md hover:shadow-lg transition-shadow duration-300",
    interactive: "bg-[#2c313a] border border-[#3e4451] hover:border-[#61afef]/40 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer",
    "teal-glow": "bg-[#2c313a] border border-[#61afef]/30 shadow-[0_4px_20px_-4px_rgba(97,175,239,0.15)] hover:border-[#61afef]/60 transition-all duration-300",
    subtle: "bg-[#21252b] border border-[#3e4451]",
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
