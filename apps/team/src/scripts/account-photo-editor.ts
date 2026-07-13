const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MIN_SCALE = 1;
const MAX_SCALE = 3;

type Crop = { x: number; y: number; scale: number };

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function parseCrop(root: HTMLElement): Crop {
  return {
    x: Number(root.dataset.cropX ?? "50"),
    y: Number(root.dataset.cropY ?? "50"),
    scale: Number(root.dataset.cropScale ?? "1"),
  };
}

function applyCrop(img: HTMLImageElement, crop: Crop) {
  img.style.objectFit = "cover";
  img.style.objectPosition = `${crop.x}% ${crop.y}%`;
  img.style.transform = `scale(${crop.scale})`;
  img.style.transformOrigin = "center center";
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
  const form = root.querySelector<HTMLFormElement>("[data-photo-form]");
  const fileInput = root.querySelector<HTMLInputElement>("[data-photo-input]");
  const editor = root.querySelector<HTMLElement>("[data-photo-editor]");
  const editorFrame = root.querySelector<HTMLElement>("[data-editor-frame]");
  const previewFrame = root.querySelector<HTMLElement>("[data-preview-frame]");
  const editorImg = editorFrame?.querySelector<HTMLImageElement>(
    ".staff-avatar-frame__img",
  );
  const previewImg = previewFrame?.querySelector<HTMLImageElement>(
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
    !editorImg ||
    !previewImg ||
    !zoomInput ||
    !changeBtn ||
    !cancelBtn ||
    !saveBtn
  ) {
    return;
  }

  let crop = parseCrop(root);
  let initialCrop = { ...crop };
  let initialSrc = editorImg.src;
  let pendingFile: File | null = null;
  let dragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragCropX = crop.x;
  let dragCropY = crop.y;

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
    zoomInput.value = String(crop.scale);
    syncCropFields(form, crop);
  }

  function openEditor(source?: string) {
    if (source) {
      editorImg.src = source;
      previewImg.src = source;
    }
    editor.hidden = false;
    setError(null);
    setStatus("Drag the photo or use the arrow keys to reposition it within the circle.");
    updateUi();
    editorImg.focus();
  }

  function closeEditor(reset: boolean) {
    editor.hidden = true;
    setError(null);
    setStatus(null);
    pendingFile = null;
    fileInput.value = "";

    if (reset) {
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
      initialSrc = editorImg.src;
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

    pendingFile = file;
    crop = { x: 50, y: 50, scale: 1 };
    initialCrop = { ...crop };

    const objectUrl = URL.createObjectURL(file);
    initialSrc = objectUrl;
    openEditor(objectUrl);
  });

  zoomInput.addEventListener("input", () => {
    crop.scale = clamp(Number(zoomInput.value), MIN_SCALE, MAX_SCALE);
    updateUi();
  });

  function onPointerDown(event: PointerEvent) {
    if (editor.hidden) return;
    dragging = true;
    dragStartX = event.clientX;
    dragStartY = event.clientY;
    dragCropX = crop.x;
    dragCropY = crop.y;
    editorImg.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function onPointerMove(event: PointerEvent) {
    if (!dragging) return;

    const frame = editorImg.closest(".staff-avatar-frame");
    const frameWidth = frame?.clientWidth ?? 160;
    const frameHeight = frame?.clientHeight ?? 160;
    const deltaX = event.clientX - dragStartX;
    const deltaY = event.clientY - dragStartY;

    crop.x = clamp(dragCropX - (deltaX / frameWidth) * 100, 0, 100);
    crop.y = clamp(dragCropY - (deltaY / frameHeight) * 100, 0, 100);
    updateUi();
  }

  function onPointerUp(event: PointerEvent) {
    if (!dragging) return;
    dragging = false;
    editorImg.releasePointerCapture(event.pointerId);
  }

  editorImg.addEventListener("pointerdown", onPointerDown);
  editorImg.addEventListener("pointermove", onPointerMove);
  editorImg.addEventListener("pointerup", onPointerUp);
  editorImg.addEventListener("pointercancel", onPointerUp);
  editorImg.tabIndex = 0;
  editorImg.setAttribute("role", "img");
  editorImg.setAttribute(
    "aria-label",
    "Photo crop. Use arrow keys to move the photo; hold Shift for larger steps.",
  );
  editorImg.addEventListener("keydown", (event) => {
    const step = event.shiftKey ? 5 : 1;
    if (event.key === "ArrowLeft") crop.x = clamp(crop.x - step, 0, 100);
    else if (event.key === "ArrowRight") crop.x = clamp(crop.x + step, 0, 100);
    else if (event.key === "ArrowUp") crop.y = clamp(crop.y - step, 0, 100);
    else if (event.key === "ArrowDown") crop.y = clamp(crop.y + step, 0, 100);
    else return;
    event.preventDefault();
    updateUi();
    setStatus(`Photo position: ${Math.round(crop.x)}% horizontal, ${Math.round(crop.y)}% vertical.`);
  });

  form.addEventListener("submit", () => {
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving…";
    setError(null);

    if (pendingFile) {
      const transfer = new DataTransfer();
      transfer.items.add(pendingFile);
      fileInput.files = transfer.files;
    }
  });

  updateUi();
}

document.querySelectorAll<HTMLElement>("[data-account-photo]").forEach(initPhotoEditor);
