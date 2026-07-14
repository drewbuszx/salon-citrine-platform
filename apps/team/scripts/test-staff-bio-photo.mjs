import assert from "node:assert/strict";
import {
  bioEditorValue,
  bioStatusLabel,
  normalizeBioStatus,
  sanitizeBioInput,
} from "../src/lib/staff-bio.ts";
import {
  DEFAULT_PHOTO_CROP,
  normalizePhotoCrop,
  parseCropFormFields,
  parsePhotoCrop,
  staffPhotoStyle,
} from "../src/lib/staff-photo.ts";

assert.equal(normalizeBioStatus("pending"), "pending");
assert.equal(normalizeBioStatus("nope"), "none");
assert.equal(bioStatusLabel("pending"), "Pending approval");
assert.equal(bioStatusLabel("declined"), "Declined — edit & resubmit");

assert.equal(
  bioEditorValue({
    bio: "Live",
    bio_pending: "Draft",
    bio_status: "pending",
  }),
  "Draft",
);
assert.equal(
  bioEditorValue({
    bio: "Live",
    bio_pending: null,
    bio_status: "approved",
  }),
  "Live",
);

assert.equal(sanitizeBioInput("  hello  "), "hello");
assert.equal(sanitizeBioInput(""), null);
assert.equal(sanitizeBioInput("x".repeat(2001)), null);

assert.deepEqual(parsePhotoCrop({ x: 10, y: 90, scale: 2 }), {
  x: 10,
  y: 90,
  scale: 2,
});
assert.deepEqual(normalizePhotoCrop(null), DEFAULT_PHOTO_CROP);

const form = new FormData();
form.set("crop_x", "25.5");
form.set("crop_y", "75");
form.set("crop_scale", "1.5");
assert.deepEqual(parseCropFormFields(form), {
  x: 25.5,
  y: 75,
  scale: 1.5,
});

const style = staffPhotoStyle({ x: 20, y: 40, scale: 1.5 });
assert.match(style, /object-position:20% 40%/);
assert.match(style, /transform:scale\(1\.5\)/);

console.log("staff-bio + staff-photo helpers ok");
