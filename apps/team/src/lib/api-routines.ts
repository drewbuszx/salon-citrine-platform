import type { SupabaseClient } from "@supabase/supabase-js";
import { salonLocalDate } from "./report-range";

export type SalonRoutineSlug = "opening" | "closing";

export type SalonRoutineItemRow = {
  id: string;
  routine_id: string;
  label: string;
  sort_order: number;
};

export type SalonRoutineCompletionRow = {
  item_id: string;
  salon_date: string;
  completed_by_staff_id: string | null;
  completed_at: string;
  completed_by:
    | { id: string; name: string }
    | { id: string; name: string }[]
    | null;
};

export type SalonRoutineRow = {
  id: string;
  slug: SalonRoutineSlug;
  title: string;
  sort_order: number;
  salon_routine_items: SalonRoutineItemRow[] | null;
};

export type RoutineItemPayload = {
  id: string;
  label: string;
  sortOrder: number;
  completed: boolean;
  completedAt: string | null;
  completedByName: string | null;
};

export type RoutinePayload = {
  id: string;
  slug: SalonRoutineSlug;
  title: string;
  salonDate: string;
  completedCount: number;
  totalCount: number;
  items: RoutineItemPayload[];
};

function relOne<T extends { name: string }>(value: T | T[] | null | undefined) {
  if (!value) return null;
  const row = Array.isArray(value) ? value[0] : value;
  return row?.name ?? null;
}

export function isRoutineSlug(value: string): value is SalonRoutineSlug {
  return value === "opening" || value === "closing";
}

export async function loadSalonRoutines(
  supabase: SupabaseClient,
  salonDate = salonLocalDate(),
): Promise<RoutinePayload[]> {
  const { data: routines, error: routinesError } = await supabase
    .from("salon_routines")
    .select(
      `
      id,
      slug,
      title,
      sort_order,
      salon_routine_items (
        id,
        routine_id,
        label,
        sort_order
      )
    `,
    )
    .order("sort_order", { ascending: true });

  if (routinesError) {
    throw routinesError;
  }

  const itemIds = (routines ?? []).flatMap((routine) =>
    (routine.salon_routine_items ?? []).map((item) => item.id),
  );

  let completions: SalonRoutineCompletionRow[] = [];
  if (itemIds.length > 0) {
    const { data, error } = await supabase
      .from("salon_routine_completions")
      .select(
        `
        item_id,
        salon_date,
        completed_by_staff_id,
        completed_at,
        completed_by:staff!salon_routine_completions_completed_by_staff_id_fkey ( id, name )
      `,
      )
      .eq("salon_date", salonDate)
      .in("item_id", itemIds);

    if (error) {
      throw error;
    }

    completions = (data ?? []) as SalonRoutineCompletionRow[];
  }

  const completionByItem = new Map(
    completions.map((row) => [row.item_id, row]),
  );

  return (routines ?? [])
    .map((routine) => {
      const items = [...(routine.salon_routine_items ?? [])].sort(
        (a, b) => a.sort_order - b.sort_order,
      );
      const mappedItems = items.map((item) => {
        const completion = completionByItem.get(item.id);
        return {
          id: item.id,
          label: item.label,
          sortOrder: item.sort_order,
          completed: Boolean(completion),
          completedAt: completion?.completed_at ?? null,
          completedByName: relOne(completion?.completed_by ?? null),
        };
      });

      const completedCount = mappedItems.filter((item) => item.completed).length;

      return {
        id: routine.id,
        slug: routine.slug as SalonRoutineSlug,
        title: routine.title,
        salonDate,
        completedCount,
        totalCount: mappedItems.length,
        items: mappedItems,
      };
    })
    .sort((a, b) => {
      const order = { opening: 1, closing: 2 } as const;
      return order[a.slug] - order[b.slug];
    });
}

export async function setRoutineItemCompletion(
  supabase: SupabaseClient,
  staffId: string,
  itemId: string,
  completed: boolean,
  salonDate = salonLocalDate(),
) {
  if (completed) {
    const { error } = await supabase.from("salon_routine_completions").upsert(
      {
        item_id: itemId,
        salon_date: salonDate,
        completed_by_staff_id: staffId,
        completed_at: new Date().toISOString(),
      },
      { onConflict: "item_id,salon_date" },
    );

    if (error) {
      throw error;
    }
    return;
  }

  const { error } = await supabase
    .from("salon_routine_completions")
    .delete()
    .eq("item_id", itemId)
    .eq("salon_date", salonDate);

  if (error) {
    throw error;
  }
}
