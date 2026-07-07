/** Shared skeleton and error-recovery markup for list pages. */

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Notebook-style skeleton rows for tasks. */
export function tasksSkeletonHtml(count = 4) {
  return Array.from({ length: count }, () => `
    <article class="ui-skeleton ui-skeleton--task" aria-hidden="true">
      <span class="ui-skeleton__line ui-skeleton__line--wide"></span>
      <span class="ui-skeleton__line ui-skeleton__line--medium"></span>
      <span class="ui-skeleton__line ui-skeleton__line--short"></span>
    </article>`).join("");
}

/** Generic card skeleton grid. */
export function cardSkeletonHtml(count = 3) {
  return `<div class="ui-skeleton-grid" aria-hidden="true">${Array.from({ length: count }, () => `
    <article class="ui-skeleton ui-skeleton--card">
      <span class="ui-skeleton__block"></span>
      <span class="ui-skeleton__line ui-skeleton__line--wide"></span>
      <span class="ui-skeleton__line ui-skeleton__line--medium"></span>
    </article>`).join("")}</div>`;
}

export type ErrorPanelOptions = {
  title: string;
  hint?: string;
  actionLabel?: string;
  actionAttr?: string;
  compact?: boolean;
};

/** Actionable error panel — Fix #49. */
export function errorPanelHtml(options: ErrorPanelOptions) {
  const {
    title,
    hint,
    actionLabel = "Try again",
    actionAttr = "data-retry",
    compact = true,
  } = options;
  return `
    <div class="ui-error-panel${compact ? " ui-error-panel--compact" : ""}" role="alert">
      <p class="ui-error-panel__title">${escapeHtml(title)}</p>
      ${hint ? `<p class="ui-error-panel__hint">${escapeHtml(hint)}</p>` : ""}
      <div class="ui-error-panel__actions">
        <button type="button" class="ui-btn ui-btn--secondary ui-btn--compact" ${actionAttr}>
          ${escapeHtml(actionLabel)}
        </button>
      </div>
    </div>`;
}
