import { showToast, friendlyError } from "../lib/toast";

type Document = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  fileName: string;
  mimeType: string | null;
  fileSizeBytes: number | null;
  uploadedByName: string | null;
  createdAt: string;
};

const root = document.querySelector<HTMLElement>("[data-docs-app]");
if (!root) {
  throw new Error("Docs app root not found");
}

const apiBase = root.dataset.apiBase ?? "";
const isManager = root.dataset.manager === "1";
const listEl = root.querySelector<HTMLElement>("[data-docs-list]");
const errorEl = root.querySelector<HTMLElement>("[data-docs-error]");
const searchInput = root.querySelector<HTMLInputElement>("[data-doc-search]");
const categoryButtons = root.querySelectorAll<HTMLButtonElement>("[data-doc-category]");
const uploadOpenBtn = root.querySelector<HTMLButtonElement>("[data-doc-upload-open]");
const modal = document.querySelector<HTMLDialogElement>("[data-doc-modal]");
const form = document.querySelector<HTMLFormElement>("[data-doc-form]");
const closeButtons = document.querySelectorAll<HTMLButtonElement>("[data-doc-modal-close]");
const submitBtn = document.querySelector<HTMLButtonElement>("[data-doc-submit]");

let documents: Document[] = [];
let searchQuery = "";
let categoryFilter = "all";
let pendingDeleteId: string | null = null;

function showError(message: string) {
  if (!errorEl) return;
  errorEl.textContent = message;
  errorEl.hidden = false;
}

function clearError() {
  if (!errorEl) return;
  errorEl.textContent = "";
  errorEl.hidden = true;
}

function formatDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatFileSize(bytes: number | null) {
  if (!bytes) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function categoryLabel(category: string | null) {
  if (!category) return "";
  return category.charAt(0).toUpperCase() + category.slice(1);
}

function categoryBadge(category: string | null) {
  if (!category) return "";
  return `<span class="ui-badge doc-badge doc-badge--${category}">${escapeHtml(categoryLabel(category))}</span>`;
}

function filteredDocuments() {
  const q = searchQuery.trim().toLowerCase();
  return documents.filter((doc) => {
    if (categoryFilter !== "all" && doc.category !== categoryFilter) {
      return false;
    }
    if (!q) return true;
    return (
      doc.title.toLowerCase().includes(q) ||
      (doc.description ?? "").toLowerCase().includes(q) ||
      doc.fileName.toLowerCase().includes(q)
    );
  });
}

function renderSkeleton() {
  if (!listEl) return;
  listEl.innerHTML = Array.from({ length: 3 }, () => `
    <article class="doc-card doc-card--skeleton" aria-hidden="true">
      <div class="doc-card__top">
        <span class="skeleton doc-card__skeleton-title"></span>
        <span class="skeleton doc-card__skeleton-badge"></span>
      </div>
      <span class="skeleton doc-card__skeleton-line"></span>
      <span class="skeleton doc-card__skeleton-meta"></span>
    </article>
  `).join("");
}

function renderEmptyState() {
  const filtered = filteredDocuments();
  const hasFilters = categoryFilter !== "all" || searchQuery.trim().length > 0;

  if (documents.length === 0) {
    const action = isManager
      ? `<div class="ui-empty__actions"><button class="ui-btn ui-btn--primary ui-btn--compact" type="button" data-doc-upload-open-inline">Upload document</button></div>`
      : "";
    return `<div class="ui-empty ui-empty--compact docs-empty" role="status">
      <span class="ui-empty__icon" aria-hidden="true">📄</span>
      <p class="ui-empty__title">No documents yet</p>
      <p class="ui-empty__hint">Salon resources and handbooks will appear here.</p>
      ${action}
    </div>`;
  }

  if (filtered.length === 0 && hasFilters) {
    return `<div class="ui-empty ui-empty--compact docs-empty" role="status">
      <span class="ui-empty__icon" aria-hidden="true">📄</span>
      <p class="ui-empty__title">No documents match</p>
      <p class="ui-empty__hint">Try another category or clear your search.</p>
    </div>`;
  }

  return "";
}

function renderDeleteActions(doc: Document) {
  if (!isManager) return "";

  if (pendingDeleteId === doc.id) {
    return `<div class="doc-card__confirm">
      <span class="doc-card__confirm-text">Remove this document?</span>
      <div class="doc-card__confirm-actions">
        <button class="ui-btn ui-btn--destructive ui-btn--compact" type="button" data-doc-delete-confirm="${doc.id}">Yes, remove</button>
        <button class="ui-btn ui-btn--ghost ui-btn--compact" type="button" data-doc-delete-cancel>Cancel</button>
      </div>
    </div>`;
  }

  return `<button class="ui-btn ui-btn--destructive ui-btn--compact" type="button" data-doc-delete="${doc.id}">Remove</button>`;
}

function renderList() {
  if (!listEl) return;
  const visible = filteredDocuments();
  const empty = renderEmptyState();

  if (empty) {
    listEl.innerHTML = empty;
    listEl.querySelector<HTMLButtonElement>("[data-doc-upload-open-inline]")?.addEventListener("click", openModal);
    return;
  }

  listEl.innerHTML = visible
    .map((doc) => {
      const size = formatFileSize(doc.fileSizeBytes);
      const metaParts = [
        doc.uploadedByName ? `Uploaded by ${doc.uploadedByName}` : null,
        formatDate(doc.createdAt),
        size,
      ].filter(Boolean);

      return `
        <article class="doc-card ui-card">
          <div class="doc-card__top">
            <h3 class="doc-card__title">${escapeHtml(doc.title)}</h3>
            <div>${categoryBadge(doc.category)}</div>
          </div>
          ${doc.description ? `<p class="doc-card__description">${escapeHtml(doc.description)}</p>` : ""}
          <div class="doc-card__meta">
            <span>${escapeHtml(doc.fileName)}</span>
            ${metaParts.map((part) => `<span>${escapeHtml(String(part))}</span>`).join('<span class="doc-card__meta-sep" aria-hidden="true">·</span>')}
          </div>
          <div class="doc-card__actions">
            <button class="ui-btn ui-btn--secondary ui-btn--compact" type="button" data-doc-download="${doc.id}">Download</button>
            ${renderDeleteActions(doc)}
          </div>
        </article>
      `;
    })
    .join("");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function apiFetch(path: string, init?: RequestInit) {
  const response = await fetch(`${apiBase}${path}`, {
    credentials: "same-origin",
    ...init,
  });
  const data = (await response.json()) as { ok?: boolean; error?: string };
  if (!response.ok || !data.ok) {
    throw new Error(data.error ?? "Request failed");
  }
  return data;
}

async function loadDocuments() {
  clearError();
  renderSkeleton();
  const category = categoryFilter !== "all" ? `?category=${encodeURIComponent(categoryFilter)}` : "";
  try {
    const data = (await apiFetch(category)) as { documents?: Document[] };
    documents = data.documents ?? [];
    pendingDeleteId = null;
    renderList();
  } catch (error) {
    showError(error instanceof Error ? error.message : "Failed to load documents");
    if (listEl) {
      listEl.innerHTML = `<p class="docs-loading docs-loading--error">${escapeHtml(error instanceof Error ? error.message : "Could not load documents.")}</p>`;
    }
  }
}

async function downloadDocument(id: string) {
  clearError();
  try {
    const data = (await apiFetch(`/${id}/download`)) as { url?: string };
    if (!data.url) {
      throw new Error("Download link unavailable");
    }
    window.open(data.url, "_blank", "noopener,noreferrer");
    showToast("Opening document…", "info");
  } catch (error) {
    showError(friendlyError(error, "Download failed"));
  }
}

async function deleteDocument(id: string) {
  clearError();
  try {
    await apiFetch(`/${id}?soft=1`, { method: "DELETE" });
    documents = documents.filter((doc) => doc.id !== id);
    pendingDeleteId = null;
    renderList();
    showToast("Document removed.", "success");
  } catch (error) {
    showError(friendlyError(error, "Failed to remove document"));
  }
}

function openModal() {
  form?.reset();
  modal?.showModal();
}

function closeModal() {
  modal?.close();
}

searchInput?.addEventListener("input", () => {
  searchQuery = searchInput.value;
  pendingDeleteId = null;
  renderList();
});

categoryButtons.forEach((button) => {
  button.addEventListener("click", () => {
    categoryFilter = button.dataset.docCategory ?? "all";
    categoryButtons.forEach((btn) => {
      btn.classList.toggle("is-active", btn === button);
    });
    pendingDeleteId = null;
    void loadDocuments();
  });
});

uploadOpenBtn?.addEventListener("click", openModal);
closeButtons.forEach((button) => button.addEventListener("click", closeModal));

listEl?.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  const downloadId = target.closest<HTMLElement>("[data-doc-download]")?.dataset.docDownload;
  if (downloadId) {
    void downloadDocument(downloadId);
    return;
  }
  if (target.closest("[data-doc-delete-cancel]")) {
    pendingDeleteId = null;
    renderList();
    return;
  }
  const confirmId = target.closest<HTMLElement>("[data-doc-delete-confirm]")?.dataset.docDeleteConfirm;
  if (confirmId) {
    void deleteDocument(confirmId);
    return;
  }
  const deleteId = target.closest<HTMLElement>("[data-doc-delete]")?.dataset.docDelete;
  if (deleteId) {
    pendingDeleteId = deleteId;
    renderList();
  }
});

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!form || !submitBtn) return;

  clearError();
  submitBtn.disabled = true;
  submitBtn.textContent = "Uploading…";

  try {
    const formData = new FormData(form);
    const response = await fetch(apiBase, {
      method: "POST",
      body: formData,
      credentials: "same-origin",
    });
    const data = (await response.json()) as { ok?: boolean; error?: string };
    if (!response.ok || !data.ok) {
      throw new Error(data.error ?? "Upload failed");
    }
    closeModal();
    showToast("Document uploaded.", "success");
    await loadDocuments();
  } catch (error) {
    showError(friendlyError(error, "Upload failed"));
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Upload";
  }
});

void loadDocuments();
