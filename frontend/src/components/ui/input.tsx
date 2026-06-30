import { InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type BaseProps = {
  className?: string;
};

type InputProps = InputHTMLAttributes<HTMLInputElement> & BaseProps;
type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & BaseProps;

const inputBaseClass =
  "w-full rounded-xl border border-border/20 bg-muted/60 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground transition focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/40";

export function TextInput({ className = "", ...props }: InputProps) {
  return <input className={cn(inputBaseClass, className)} {...props} />;
}

export function TextArea({ className = "", ...props }: TextareaProps) {
  return <textarea className={cn(inputBaseClass, "min-h-[88px] resize-y", className)} {...props} />;
}

