import { staffPhotoStyle, type PhotoCrop } from "../lib/staff-photo";

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MIN_SCALE = 1;
const MAX_SCALE = 3;
/** Square avatars need zoom before object-position pan is visible. */
const DRAG_MIN_SCALE = 1.2;

type Crop = PhotoCrop;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function parseCrop(root: HTMLElement): Crop {
  return {
    x: clamp(Number(root.dataset.cropX ?? "50"), 0, 100),
    y: clamp(Number(root.dataset.cropY ?? "50"), 0, 100),
    scale: clamp(Number(root.dataset.cropScale ?? "1"), MIN_SCALE, MAX_SCALE),
  };
}

function applyCrop(img: HTMLImageElement, crop: Crop) {
  img.setAttribute("style", staffPhotoStyle(crop));
}

function syncCropFields(form: HTMLFormElement, crop: Crop) {
  const xField = form.querySelector<HTMLInputElement>('input[name="crop_x"]');
  const yField = form.querySelector<HTMLInputElement>('input[name="crop_y"]');
  const scaleField = form.querySelector<HTMLInputElement>(
    'input[name="crop_scale"]',
  );
  if (xField) xField.value = String(crop.x);
  if (yField) yField.value = String(crop.y);
  if (scaleField) scaleField.value = String(crop.scale);
}

function initPhotoEditor(root: HTMLElement) {
  if (root.dataset.photoEditorReady === "1") return;
  root.dataset.photoEditorReady = "1";

  const form = root.querySelector<HTMLFormElement>("[data-photo-form]");
  const fileInput = root.querySelector<HTMLInputElement>("[data-photo-input]");
  const editor = root.querySelector<HTMLElement>("[data-photo-editor]");
  const cropSurface = root.querySelector<HTMLElement>("[data-crop-surface]");
  const editorFrame = root.querySelector<HTMLElement>("[data-editor-frame]");
  const previewFrame = root.querySelector<HTMLElement>("[data-preview-frame]");
  const currentFrame = root.querySelector<HTMLElement>("[data-current-frame]");
  const editorImg =
    cropSurface?.querySelector<HTMLImageElement>(".staff-avatar-frame__img") ??
    editorFrame?.querySelector<HTMLImageElement>(".staff-avatar-frame__img");
  const previewImg = previewFrame?.querySelector<HTMLImageElement>(
    ".staff-avatar-frame__img",
  );
  const currentImg = currentFrame?.querySelector<HTMLImageElement>(
    ".staff-avatar-frame__img",
  );
  const zoomInput = root.querySelector<HTMLInputElement>("[data-zoom-input]");
  const changeBtn = root.querySelector<HTMLButtonElement>("[data-change-photo]");
  const editBtn = root.querySelector<HTMLButtonElement>("[data-edit-position]");
  const cancelBtn = root.querySelector<HTMLButtonElement>("[data-cancel-editor]");
  const saveBtn = root.querySelector<HTMLButtonElement>("[data-save-photo]");
  const errorEl = root.querySelector<HTMLElement>("[data-photo-error]");
  const statusEl = root.querySelector<HTMLElement>("[data-photo-status]");

  if (
    !form ||
    !fileInput ||
    !editor ||
    !cropSurface ||
    !editorImg ||
    !previewImg ||
    !zoomInput ||
    !changeBtn ||
    !cancelBtn ||
    !saveBtn
  ) {
    root.dataset.photoEditorReady = "0";
    return;
  }

  let crop = parseCrop(root);
  let initialCrop = { ...crop };
  let initialSrc = editorImg.src;
  let pendingFile: File | null = null;
  let pendingObjectUrl: string | null = null;
  let dragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragCropX = crop.x;
  let dragCropY = crop.y;
  let activePointerId: number | null = null;

  function setError(message: string | null) {
    if (!errorEl) return;
    errorEl.textContent = message ?? "";
    errorEl.hidden = !message;
  }

  function setStatus(message: string | null) {
    if (!statusEl) return;
    statusEl.textContent = message ?? "";
    statusEl.hidden = !message;
  }

  function updateUi() {
    applyCrop(editorImg, crop);
    applyCrop(previewImg, crop);
    if (currentImg) applyCrop(currentImg, crop);
    zoomInput.value = String(crop.scale);
    zoomInput.setAttribute("aria-valuenow", String(crop.scale));
    syncCropFields(form, crop);
    root.dataset.cropX = String(crop.x);
    root.dataset.cropY = String(crop.y);
    root.dataset.cropScale = String(crop.scale);
  }

  function revokePendingUrl() {
    if (pendingObjectUrl) {
      URL.revokeObjectURL(pendingObjectUrl);
      pendingObjectUrl = null;
    }
  }

  function openEditor(source?: string) {
    if (source) {
      editorImg.src = source;
      previewImg.src = source;
    }
    editor.hidden = false;
    setError(null);
    setStatus(
      crop.scale <= 1
        ? "Zoom in, then drag to reposition. Arrow keys also move the photo."
        : "Drag the photo or use arrow keys to reposition it within the circle.",
    );
    updateUi();
    cropSurface.focus({ preventScroll: true });
  }

  function closeEditor(reset: boolean) {
    editor.hidden = true;
    setError(null);
    setStatus(null);
    pendingFile = null;
    fileInput.value = "";
    cropSurface.classList.remove("is-dragging");
    dragging = false;
    activePointerId = null;

    if (reset) {
      revokePendingUrl();
      crop = { ...initialCrop };
      editorImg.src = initialSrc;
      previewImg.src = initialSrc;
      updateUi();
    }
  }

  changeBtn.addEventListener("click", () => {
    fileInput.click();
  });

  editBtn?.addEventListener("click", () => {
    initialCrop = { ...crop };
    initialSrc = editorImg.currentSrc || editorImg.src;
    openEditor();
  });

  cancelBtn.addEventListener("click", () => {
    closeEditor(true);
  });

  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (!file) return;

    if (!ALLOWED_TYPES.has(file.type)) {
      setError("Use a JPEG, PNG, or WebP image.");
      fileInput.value = "";
      return;
    }

    if (file.size > MAX_BYTES) {
      setError("Image must be 2 MB or smaller.");
      fileInput.value = "";
      return;
    }

    revokePendingUrl();
    pendingFile = file;
    crop = { x: 50, y: 50, scale: DRAG_MIN_SCALE };
    initialCrop = { ...crop };

    const objectUrl = URL.createObjectURL(file);
    pendingObjectUrl = objectUrl;
    initialSrc = objectUrl;
    openEditor(objectUrl);
  });

  zoomInput.addEventListener("input", () => {
    crop.scale = clamp(Number(zoomInput.value), MIN_SCALE, MAX_SCALE);
    updateUi();
    setStatus(
      `Zoom ${crop.scale.toFixed(2)}× — drag to frame the face in the circle.`,
    );
  });

  function onPointerDown(event: PointerEvent) {
    if (editor.hidden) return;
    if (event.button !== 0 && event.pointerType === "mouse") return;
    dragging = true;
    activePointerId = event.pointerId;
    dragStartX = event.clientX;
    dragStartY = event.clientY;
    dragCropX = crop.x;
    dragCropY = crop.y;
    if (crop.scale < DRAG_MIN_SCALE) {
      crop.scale = DRAG_MIN_SCALE;
      updateUi();
    }
    cropSurface.classList.add("is-dragging");
    cropSurface.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function onPointerMove(event: PointerEvent) {
    if (!dragging || activePointerId !== event.pointerId) return;

    const frameWidth = cropSurface.clientWidth || 160;
    const frameHeight = cropSurface.clientHeight || 160;
    const deltaX = event.clientX - dragStartX;
    const deltaY = event.clientY - dragStartY;

    // Dragging the photo with the pointer (Instagram-style).
    crop.x = clamp(dragCropX - (deltaX / frameWidth) * 100, 0, 100);
    crop.y = clamp(dragCropY - (deltaY / frameHeight) * 100, 0, 100);
    updateUi();
  }

  function onPointerUp(event: PointerEvent) {
    if (activePointerId !== event.pointerId) return;
    dragging = false;
    activePointerId = null;
    cropSurface.classList.remove("is-dragging");
    if (cropSurface.hasPointerCapture(event.pointerId)) {
      cropSurface.releasePointerCapture(event.pointerId);
    }
    setStatus(
      `Photo position: ${Math.round(crop.x)}% horizontal, ${Math.round(crop.y)}% vertical.`,
    );
  }

  cropSurface.addEventListener("pointerdown", onPointerDown);
  cropSurface.addEventListener("pointermove", onPointerMove);
  cropSurface.addEventListener("pointerup", onPointerUp);
  cropSurface.addEventListener("pointercancel", onPointerUp);
  cropSurface.tabIndex = 0;
  cropSurface.setAttribute("role", "slider");
  cropSurface.setAttribute("aria-label", "Photo crop position");
  cropSurface.setAttribute(
    "aria-description",
    "Drag to reposition. Use arrow keys to nudge; hold Shift for larger steps. Use the zoom slider to scale.",
  );

  cropSurface.addEventListener("keydown", (event) => {
    if (editor.hidden) return;
    const step = event.shiftKey ? 5 : 1;
    if (event.key === "ArrowLeft") crop.x = clamp(crop.x - step, 0, 100);
    else if (event.key === "ArrowRight") crop.x = clamp(crop.x + step, 0, 100);
    else if (event.key === "ArrowUp") crop.y = clamp(crop.y - step, 0, 100);
    else if (event.key === "ArrowDown") crop.y = clamp(crop.y + step, 0, 100);
    else return;
    event.preventDefault();
    if (crop.scale < DRAG_MIN_SCALE) crop.scale = DRAG_MIN_SCALE;
    updateUi();
    setStatus(
      `Photo position: ${Math.round(crop.x)}% horizontal, ${Math.round(crop.y)}% vertical.`,
    );
  });

  form.addEventListener("submit", () => {
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving…";
    setError(null);
    syncCropFields(form, crop);

    if (pendingFile) {
      const transfer = new DataTransfer();
      transfer.items.add(pendingFile);
      fileInput.files = transfer.files;
    }
  });

  updateUi();
}

function bootPhotoEditors() {
  document
    .querySelectorAll<HTMLElement>("[data-account-photo]")
    .forEach(initPhotoEditor);
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootPhotoEditors);
  } else {
    bootPhotoEditors();
  }
  document.addEventListener("astro:page-load", bootPhotoEditors);
}
