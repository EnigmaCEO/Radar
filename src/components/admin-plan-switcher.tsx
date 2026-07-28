"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ADMIN_VIEW_PLANS,
  type AdminViewPlan,
} from "@/lib/admin-plan-override";
import { getPlanLabel } from "@/lib/plan-limits";
import { Select } from "@/components/ui/select";

export function AdminPlanSwitcher({
  currentPlan,
}: {
  currentPlan: AdminViewPlan | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState<string>(currentPlan ?? "");
  const [saving, setSaving] = useState(false);

  async function updatePlan(nextValue: string) {
    setValue(nextValue);
    setSaving(true);

    try {
      const response = await fetch("/api/admin/view-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: nextValue || null }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Failed to update admin plan view.");
      }

      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      console.error(error);
      setValue(currentPlan ?? "");
    } finally {
      setSaving(false);
    }
  }

  return (
    <label className="flex items-center gap-2">
      <span className="hidden text-xs text-muted-foreground sm:block">View as</span>
      <Select
        value={value}
        onChange={(event) => {
          void updatePlan(event.target.value);
        }}
        disabled={saving}
        className="h-8 w-28 text-xs sm:w-36"
        aria-label="Admin plan preview"
      >
        <option value="">Admin</option>
        {ADMIN_VIEW_PLANS.map((plan) => (
          <option key={plan} value={plan}>
            {getPlanLabel(plan)}
          </option>
        ))}
      </Select>
    </label>
  );
}
