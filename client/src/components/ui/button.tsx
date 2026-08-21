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
    "border-[#61afef] bg-[#61afef] text-[#1e2227] shadow-sm hover:bg-[#79b8ff] hover:border-[#79b8ff] hover:shadow-md active:translate-y-[1px] focus-visible:outline-[#61afef]/30",
  secondary:
    "border-[#4b5263] bg-[#2c313a] text-[#e6e9ef] shadow-sm hover:border-[#61afef]/60 hover:bg-[#353b45] hover:text-[#e6efff] active:translate-y-[1px] focus-visible:outline-[#61afef]/30",
  "teal-subtle":
    "border-[#61afef]/25 bg-[#323842] text-[#c8d5ff] hover:bg-[#3e4451] hover:border-[#79b8ff] active:translate-y-[1px] focus-visible:outline-[#61afef]/30",
  outline:
    "border-[#4b5263] bg-transparent text-[#c8ccd4] hover:bg-[#323842] hover:border-[#61afef] hover:text-[#e6efff] active:translate-y-[1px] focus-visible:outline-[#61afef]/30",
  ghost:
    "border-transparent bg-transparent text-[#abb2bf] hover:bg-[#353b45] hover:text-[#e6efff] active:translate-y-[1px] focus-visible:outline-[#61afef]/30",
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
