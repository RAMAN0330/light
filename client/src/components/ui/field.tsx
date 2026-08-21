import { forwardRef } from "react";
import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

const fieldClass =
  "w-full border border-[#4b5263] bg-[#2c313a] text-[#e6e9ef] rounded-lg outline-none transition-all duration-200 placeholder:text-[#8b919d] hover:border-[#4b5263] focus:border-[#4b5263] focus:ring-0 focus-visible:ring-3 focus-visible:ring-[#61afef]/25 disabled:cursor-not-allowed disabled:bg-[#21252b] disabled:opacity-60";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className = "", ...props }, ref) => (
    <input ref={ref} className={`${fieldClass} px-3 py-2 text-sm ${className}`} {...props} />
  )
);
Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className = "", ...props }, ref) => (
    <textarea
      ref={ref}
      className={`${fieldClass} p-3 text-sm min-h-[90px] resize-y ${className}`}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className = "", children, ...props }, ref) => (
    <select
      ref={ref}
      className={`${fieldClass} px-3 py-2 text-sm cursor-pointer ${className}`}
      {...props}
    >
      {children}
    </select>
  )
);
Select.displayName = "Select";
