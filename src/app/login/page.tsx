"use client";

import { useEffect } from "react";

export default function LoginPage() {
  useEffect(() => {
    const target = new URL("/auth/login", window.location.origin);
    const currentSearchParams = new URLSearchParams(window.location.search);
    for (const [key, value] of currentSearchParams.entries()) {
      target.searchParams.set(key, value);
    }
    window.location.assign(target.toString());
  }, []);

  return null;
}
