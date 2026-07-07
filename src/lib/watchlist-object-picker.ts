import type { SceCatalogObject, SceMonitorType } from "./sce-catalog";

export const OBJECT_PICKER_MONITOR_TYPE_ORDER: SceMonitorType[] = ["oracle", "bridge", "lp"];

export function groupObjectsByMonitorType(
  objects: SceCatalogObject[],
): Record<SceMonitorType, SceCatalogObject[]> {
  const groups: Record<SceMonitorType, SceCatalogObject[]> = { oracle: [], bridge: [], lp: [] };
  for (const obj of objects) {
    groups[obj.monitorType].push(obj);
  }
  return groups;
}

// Narrows the object picker list to the selected monitor types. An empty
// selection means "no filter applied" — every catalog object stays visible,
// so broad watchlists don't require picking a monitor type first.
export function filterObjectsForPicker(
  objects: SceCatalogObject[],
  selectedMonitorTypes: string[],
): SceCatalogObject[] {
  if (selectedMonitorTypes.length === 0) return objects;
  return objects.filter((o) => selectedMonitorTypes.includes(o.monitorType));
}
