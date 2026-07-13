import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?:
    | "default"
    | "secondary"
    | "destructive"
    | "outline"
    | "watch"
    | "warning"
    | "critical"
    | "resolved"
    | "closed";
}

// Radar Alert Threshold Doctrine v1.0 colour legend:
// Watch = blue, Warning = orange, Critical = red, Resolved = green.
const variantClasses: Record<string, string> = {
  default: "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80",
  secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
  destructive: "border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80",
  outline: "text-foreground",
  watch: "border-transparent bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  warning: "border-transparent bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  critical: "border-transparent bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  resolved: "border-transparent bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  closed: "border-transparent bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-300",
};

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}

export { Badge };
