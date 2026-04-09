/** 12-column grid slots: x, y, w, h (0-based). */
export interface LayoutPresetSlot {
  gridX: number;
  gridY: number;
  gridW: number;
  gridH: number;
}

export interface DashboardLayoutPresetDefinition {
  id: string;
  name: string;
  description: string;
  slots: LayoutPresetSlot[];
}

export const DASHBOARD_LAYOUT_PRESETS: DashboardLayoutPresetDefinition[] = [
  {
    id: 'overview',
    name: 'Overview',
    description: 'Wide chart on the left, KPI stack on the right',
    slots: [
      { gridX: 0, gridY: 0, gridW: 8, gridH: 3 },
      { gridX: 8, gridY: 0, gridW: 4, gridH: 1 },
      { gridX: 8, gridY: 1, gridW: 4, gridH: 1 },
      { gridX: 8, gridY: 2, gridW: 4, gridH: 1 },
      { gridX: 0, gridY: 3, gridW: 4, gridH: 2 },
      { gridX: 4, gridY: 3, gridW: 4, gridH: 2 },
      { gridX: 8, gridY: 3, gridW: 4, gridH: 2 },
    ],
  },
  {
    id: 'kpi_row',
    name: 'KPI row',
    description: 'Four equal tiles across the top, then full-width rows',
    slots: [
      { gridX: 0, gridY: 0, gridW: 3, gridH: 2 },
      { gridX: 3, gridY: 0, gridW: 3, gridH: 2 },
      { gridX: 6, gridY: 0, gridW: 3, gridH: 2 },
      { gridX: 9, gridY: 0, gridW: 3, gridH: 2 },
      { gridX: 0, gridY: 2, gridW: 12, gridH: 3 },
    ],
  },
  {
    id: 'two_column',
    name: 'Two columns',
    description: 'Pairs of half-width tiles',
    slots: [
      { gridX: 0, gridY: 0, gridW: 6, gridH: 3 },
      { gridX: 6, gridY: 0, gridW: 6, gridH: 3 },
      { gridX: 0, gridY: 3, gridW: 6, gridH: 3 },
      { gridX: 6, gridY: 3, gridW: 6, gridH: 3 },
    ],
  },
  {
    id: 'single_column',
    name: 'Single column',
    description: 'Full-width stack',
    slots: [{ gridX: 0, gridY: 0, gridW: 12, gridH: 2 }],
  },
];

const PRESET_BY_ID = new Map(
  DASHBOARD_LAYOUT_PRESETS.map((p) => [p.id, p]),
);

export function getLayoutPreset(id: string): DashboardLayoutPresetDefinition | undefined {
  return PRESET_BY_ID.get(id);
}

export function listLayoutPresetSummaries(): Array<{
  id: string;
  name: string;
  description: string;
}> {
  return DASHBOARD_LAYOUT_PRESETS.map(({ id, name, description }) => ({
    id,
    name,
    description,
  }));
}

export interface WidgetLayoutInput {
  id: string;
  sortOrder: number;
  gridX: number;
  gridY: number;
  gridW: number;
  gridH: number;
}

/** Assign grid positions from preset; extra widgets stack below in full-width rows. */
export function computeAssignmentsForPreset(
  widgets: WidgetLayoutInput[],
  presetId: string,
): Array<{
  id: string;
  gridX: number;
  gridY: number;
  gridW: number;
  gridH: number;
  sortOrder: number;
}> {
  const preset = getLayoutPreset(presetId);
  if (!preset) {
    throw new Error(`Unknown layout preset: ${presetId}`);
  }
  const slots = preset.slots;
  const sorted = [...widgets].sort(
    (a, b) =>
      a.sortOrder - b.sortOrder ||
      a.gridY - b.gridY ||
      a.gridX - b.gridX ||
      a.id.localeCompare(b.id),
  );

  let bottomY = 0;
  for (const s of slots) {
    bottomY = Math.max(bottomY, s.gridY + s.gridH);
  }

  const rowHeight = 2;
  let overflowCursorY = bottomY;

  return sorted.map((w, i) => {
    if (i < slots.length) {
      const s = slots[i];
      return {
        id: w.id,
        gridX: s.gridX,
        gridY: s.gridY,
        gridW: s.gridW,
        gridH: s.gridH,
        sortOrder: i,
      };
    }
    const y = overflowCursorY;
    overflowCursorY += rowHeight;
    return {
      id: w.id,
      gridX: 0,
      gridY: y,
      gridW: 12,
      gridH: rowHeight,
      sortOrder: i,
    };
  });
}
