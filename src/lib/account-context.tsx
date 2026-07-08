"use client";

import { createContext, useContext } from "react";
import type { RadarAccount } from "@/lib/radar-account";

interface AccountContextValue {
  account: RadarAccount;
  userEmail: string;
}

const AccountContext = createContext<AccountContextValue | null>(null);

export function AccountProvider({
  account,
  userEmail,
  children,
}: {
  account: RadarAccount;
  userEmail: string;
  children: React.ReactNode;
}) {
  return (
    <AccountContext.Provider value={{ account, userEmail }}>
      {children}
    </AccountContext.Provider>
  );
}

export function useAccount(): AccountContextValue {
  const ctx = useContext(AccountContext);
  if (!ctx) throw new Error("useAccount must be used within AccountProvider");
  return ctx;
}
