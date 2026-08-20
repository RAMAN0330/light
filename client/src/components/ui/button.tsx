import type { ButtonHTMLAttributes, PropsWithChildren, ReactNode } from "react";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "teal-subtle"
  | "outline"
  | "ghost"
  | "destructive";

export type ButtonSize = "sm" | "md" | "lg";

const variants: Record<ButtonVariant, string> = {
  primary:
    "border-teal-600 bg-teal-600 text-white shadow-sm hover:bg-teal-700 hover:border-teal-700 hover:shadow-md active:translate-y-[1px] focus-visible:outline-teal-500/30",
  secondary:
    "border-[#d3e3e0] bg-white text-[#13312d] shadow-sm hover:border-teal-400/60 hover:bg-[#f2f8f7] hover:text-teal-800 active:translate-y-[1px] focus-visible:outline-teal-500/30",
  "teal-subtle":
    "border-teal-500/20 bg-teal-50 text-teal-800 hover:bg-teal-100 hover:border-teal-400 active:translate-y-[1px] focus-visible:outline-teal-500/30",
  outline:
    "border-[#c7dcd8] bg-transparent text-[#1f3f3a] hover:bg-teal-50/60 hover:border-teal-500 hover:text-teal-800 active:translate-y-[1px] focus-visible:outline-teal-500/30",
  ghost:
    "border-transparent bg-transparent text-[#44635e] hover:bg-[#ebf4f2] hover:text-teal-800 active:translate-y-[1px] focus-visible:outline-teal-500/30",
  destructive:
    "border-rose-600 bg-rose-600 text-white shadow-sm hover:bg-rose-700 active:translate-y-[1px] focus-visible:outline-rose-500/30",
};

const sizes: Record<ButtonSize, string> = {
  sm: "text-[0.75rem] px-2.5 py-1.5 rounded-lg gap-1.5 min-h-[32px]",
  md: "text-[0.82rem] px-3.5 py-2 rounded-lg gap-2 min-h-[40px]",
  lg: "text-[0.92rem] px-5 py-2.5 rounded-xl gap-2.5 min-h-[48px]",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export function Button({
  className = "",
  variant = "secondary",
  size = "md",
  type = "button",
  isLoading = false,
  leftIcon,
  rightIcon,
  children,
  disabled,
  ...props
}: PropsWithChildren<ButtonProps>) {
  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      className={`inline-flex items-center justify-center border font-bold transition-all duration-150 ease-out focus-visible:outline-3 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 select-none ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {isLoading ? (
        <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-1.5" />
      ) : (
        leftIcon && <span className="inline-flex shrink-0">{leftIcon}</span>
      )}
      {children}
      {!isLoading && rightIcon && <span className="inline-flex shrink-0">{rightIcon}</span>}
    </button>
  );
}
