import { getMonitoredValueUsd, formatUsd } from "@/lib/radar-stats";

export async function StatsBanner() {
  const value = await getMonitoredValueUsd();
  // Only a real reading is shown; with none yet, the banner stays out of the way.
  if (value === null) return null;
  const formatted = formatUsd(value);

  return (
    <div className="border-b border-white/[0.06] bg-[#050409] px-4 py-1.5">
      <p className="text-center text-[11px] tracking-wide text-slate-500">
        <span className="mr-1.5 inline-block h-1.5 w-1.5 translate-y-px rounded-full bg-amber-400 opacity-80" />
        Sagitta Radar monitors the oracles and pools behind{" "}
        <span className="font-semibold text-amber-400">{formatted}</span>
        {" "}of DeFi TVL
      </p>
    </div>
  );
}
