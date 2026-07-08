import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(new Date(date));
}

export function severityColor(severity: "watch" | "warning" | "critical"): string {
  return {
    watch: "text-yellow-500",
    warning: "text-orange-500",
    critical: "text-red-500",
  }[severity];
}

export function severityBadgeClass(severity: "watch" | "warning" | "critical"): string {
  return {
    watch: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    warning: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
    critical: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  }[severity];
}

export function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}
