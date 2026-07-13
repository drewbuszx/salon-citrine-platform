import type { APIRoute } from "astro";
import { parseCropFormFields } from "../../../lib/staff-photo";
import { teamUrl } from "../../../lib/supabase-server";

const STAFF_PHOTOS_BUCKET = "staff-photos";
const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function extensionForMime(mime: string) {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const { supabase, staff } = locals;

  if (!staff) {
    return new Response("Unauthorized", { status: 401 });
  }

  const form = await request.formData();
  const file = form.get("photo");
  const photoCrop = parseCropFormFields(form);

  let photoUrl: string | null | undefined = undefined;

  if (file instanceof File && file.size > 0) {
    if (!ALLOWED_TYPES.has(file.type)) {
      return redirect(teamUrl("/account?error=photo_type"));
    }

    if (file.size > MAX_BYTES) {
      return redirect(teamUrl("/account?error=photo_size"));
    }

    const extension = extensionForMime(file.type);
    const path = `${staff.id}/avatar.${extension}`;
    const buffer = new Uint8Array(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from(STAFF_PHOTOS_BUCKET)
      .upload(path, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error("Staff photo upload failed", uploadError);
      return redirect(teamUrl("/account?error=photo_upload"));
    }

    const { data: publicUrlData } = supabase.storage
      .from(STAFF_PHOTOS_BUCKET)
      .getPublicUrl(path);

    photoUrl = publicUrlData.publicUrl;
  }

  const { error: staffError } = await supabase.rpc("update_own_staff_photo", {
    p_photo_url: photoUrl ?? null,
    p_photo_crop: photoCrop,
  });

  if (staffError) {
    console.error("Staff photo metadata update failed", staffError);
    return redirect(teamUrl("/account?error=photo_save"));
  }

  return redirect(teamUrl("/account?saved=1&photo=1"));
};
