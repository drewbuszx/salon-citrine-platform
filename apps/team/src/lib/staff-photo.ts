export type PhotoCrop = {
  x: number;
  y: number;
  scale: number;
};

export const DEFAULT_PHOTO_CROP: PhotoCrop = { x: 50, y: 50, scale: 1 };

const MIN_SCALE = 1;
const MAX_SCALE = 3;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function parsePhotoCrop(value: unknown): PhotoCrop | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (
    typeof record.x !== "number" ||
    typeof record.y !== "number" ||
    typeof record.scale !== "number"
  ) {
    return null;
  }

  return {
    x: clamp(record.x, 0, 100),
    y: clamp(record.y, 0, 100),
    scale: clamp(record.scale, MIN_SCALE, MAX_SCALE),
  };
}

export function normalizePhotoCrop(
  crop: PhotoCrop | null | undefined,
): PhotoCrop {
  return crop ?? DEFAULT_PHOTO_CROP;
}

export function staffPhotoStyle(crop: PhotoCrop | null | undefined): string {
  const { x, y, scale } = normalizePhotoCrop(crop);
  return `object-fit:cover;object-position:${x}% ${y}%;transform:scale(${scale});transform-origin:center center;`;
}

export function parseCropFormFields(form: FormData): PhotoCrop {
  const x = Number(form.get("crop_x"));
  const y = Number(form.get("crop_y"));
  const scale = Number(form.get("crop_scale"));

  return {
    x: clamp(Number.isFinite(x) ? x : DEFAULT_PHOTO_CROP.x, 0, 100),
    y: clamp(Number.isFinite(y) ? y : DEFAULT_PHOTO_CROP.y, 0, 100),
    scale: clamp(
      Number.isFinite(scale) ? scale : DEFAULT_PHOTO_CROP.scale,
      MIN_SCALE,
      MAX_SCALE,
    ),
  };
}
