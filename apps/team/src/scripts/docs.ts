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

function categoryBadge(category: string | null) {
  if (!category) return "";
  const label = category.replace("_", " ");
  return `<span class="doc-badge doc-badge--${category}">${label}</span>`;
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

function renderList() {
  if (!listEl) return;
  const visible = filteredDocuments();

  if (visible.length === 0) {
    listEl.innerHTML = `<p class="empty-state">${documents.length === 0 ? "No documents yet." : "No documents match your filters."}</p>`;
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

      const managerActions = isManager
        ? `<button class="team-list-layout__btn-destructive" type="button" data-doc-delete="${doc.id}">Remove</button>`
        : "";

      return `
        <article class="doc-card">
          <div class="doc-card__top">
            <h3 class="doc-card__title">${escapeHtml(doc.title)}</h3>
            <div>${categoryBadge(doc.category)}</div>
          </div>
          ${doc.description ? `<p class="doc-card__description">${escapeHtml(doc.description)}</p>` : ""}
          <div class="doc-card__meta">
            <span>${escapeHtml(doc.fileName)}</span>
            ${metaParts.map((part) => `<span>${escapeHtml(String(part))}</span>`).join("")}
          </div>
          <div class="doc-card__actions">
            <button class="team-list-layout__btn-secondary" type="button" data-doc-download="${doc.id}">Download</button>
            ${managerActions}
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
  const category = categoryFilter !== "all" ? `?category=${encodeURIComponent(categoryFilter)}` : "";
  try {
    const data = (await apiFetch(category)) as { documents?: Document[] };
    documents = data.documents ?? [];
    renderList();
  } catch (error) {
    showError(error instanceof Error ? error.message : "Failed to load documents");
    if (listEl) {
      listEl.innerHTML = `<p class="empty-state">Could not load documents.</p>`;
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
  } catch (error) {
    showError(error instanceof Error ? error.message : "Download failed");
  }
}

async function deleteDocument(id: string) {
  if (!confirm("Remove this document? This cannot be undone.")) {
    return;
  }
  clearError();
  try {
    await apiFetch(`/${id}?soft=1`, { method: "DELETE" });
    documents = documents.filter((doc) => doc.id !== id);
    renderList();
  } catch (error) {
    showError(error instanceof Error ? error.message : "Failed to remove document");
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
  renderList();
});

categoryButtons.forEach((button) => {
  button.addEventListener("click", () => {
    categoryFilter = button.dataset.docCategory ?? "all";
    categoryButtons.forEach((btn) => {
      btn.classList.toggle("is-active", btn === button);
    });
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
  const deleteId = target.closest<HTMLElement>("[data-doc-delete]")?.dataset.docDelete;
  if (deleteId) {
    void deleteDocument(deleteId);
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
    await loadDocuments();
  } catch (error) {
    showError(error instanceof Error ? error.message : "Upload failed");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Upload";
  }
});

void loadDocuments();
