/**
 * Task list views shared by the Tasks UI and deep-link helpers.
 * Keep this free of DOM / Cloudflare imports so unit tests can import it.
 */

export const TASK_VIEWS = [
  "my",
  "available",
  "attention",
  "completed",
  "all",
  "routine-opening",
  "routine-closing",
] as const;

export type TaskView = (typeof TASK_VIEWS)[number];

export function isTaskView(value: string | null | undefined): value is TaskView {
  return Boolean(value && (TASK_VIEWS as readonly string[]).includes(value));
}

/** Parse `?view=` from a search string or URLSearchParams. Defaults to `my`. */
export function parseTaskViewFromSearch(
  search: string | URLSearchParams | null | undefined,
): TaskView {
  const params =
    typeof search === "string"
      ? new URLSearchParams(search.startsWith("?") ? search.slice(1) : search)
      : search instanceof URLSearchParams
        ? search
        : new URLSearchParams();
  const raw = params.get("view");
  return isTaskView(raw) ? raw : "my";
}

export function taskViewSearchParam(view: TaskView): string {
  return view === "my" ? "" : `?view=${encodeURIComponent(view)}`;
}
