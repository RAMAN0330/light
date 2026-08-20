import { forwardRef } from "react";
import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

const fieldClass =
  "w-full border border-[#cbdcd8] bg-white text-[#132f2b] rounded-lg outline-none transition-all duration-200 placeholder:text-[#8ba29d] hover:border-teal-400 focus:border-teal-600 focus:ring-4 focus:ring-teal-600/15 disabled:cursor-not-allowed disabled:bg-[#f3f7f6] disabled:opacity-60";

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
