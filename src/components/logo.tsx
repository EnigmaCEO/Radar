import Image from "next/image";
import { cn } from "@/lib/utils";

interface LogoProps {
  size?: number;
  className?: string;
}

export function Logo({ size = 32, className }: LogoProps) {
  return (
    <Image
      src="/logo.png"
      alt="Radar by Sagitta Labs"
      width={size}
      height={size}
      className={cn("select-none", className)}
      priority
    />
  );
}
