import type { HTMLAttributes, PropsWithChildren } from "react";

export function Dialog({
  open,
  children,
  className = "",
  ...props
}: PropsWithChildren<{ open: boolean } & HTMLAttributes<HTMLDivElement>>) {
  if (!open) return null;
  return (
    <div
      className={`fixed inset-0 z-50 grid place-items-center bg-[#091b19]/40 p-4 sm:p-6 backdrop-blur-md transition-opacity duration-200 animate-fadeIn ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
