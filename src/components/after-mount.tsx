"use client";

import { useSyncExternalStore, type ReactNode } from "react";

const subscribe = () => () => {};

/**
 * Renders its children only in the browser, after hydration. For decorative
 * duplicates, such as the marquee's loop copy, that should not appear in the
 * server HTML crawlers and link previews read.
 */
export function AfterMount({ children }: { children: ReactNode }) {
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  return mounted ? children : null;
}
