import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({
  className,
  type,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type={type}
      className={cn(
        "flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
