/**
 * Generate PWA icons (192/512 + apple-touch 180) and the install QR SVG
 * from the crystal brand mark in public/favicon.png.
 *
 * Usage: node scripts/generate-pwa-assets.mjs
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import QRCode from "qrcode";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const iconsDir = path.join(root, "public", "icons");
/** High-res crystal mark (JPEG). Prefer this over public/favicon.png after PNG conversion. */
const sourcePath = path.join(iconsDir, "crystal-source.jpg");

/** Canonical origin that resolves today (custom team.* DNS is currently broken). */
export const TEAM_INSTALL_ORIGIN = "https://salon-citrine-team.dbuszx.workers.dev";
export const TEAM_INSTALL_URL = `${TEAM_INSTALL_ORIGIN}/team/install`;

const BG = { r: 250, g: 249, b: 247, alpha: 1 }; // stone-50 / cream

async function pngIcon(size, { pad = 0 } = {}) {
  const inner = Math.max(1, size - pad * 2);
  const resized = await sharp(sourcePath)
    .rotate()
    .resize(inner, inner, { fit: "contain", background: BG })
    .png()
    .toBuffer();

  if (!pad) return resized;

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: BG,
    },
  })
    .composite([{ input: resized, gravity: "center" }])
    .png()
    .toBuffer();
}

await mkdir(iconsDir, { recursive: true });

const faviconPng = await pngIcon(64);
await writeFile(path.join(root, "public", "favicon.png"), faviconPng);

await writeFile(path.join(iconsDir, "icon-192.png"), await pngIcon(192));
await writeFile(path.join(iconsDir, "icon-512.png"), await pngIcon(512));
await writeFile(
  path.join(iconsDir, "icon-512-maskable.png"),
  await pngIcon(512, { pad: 64 }),
);
await writeFile(path.join(iconsDir, "apple-touch-icon.png"), await pngIcon(180));

const qrSvg = await QRCode.toString(TEAM_INSTALL_URL, {
  type: "svg",
  errorCorrectionLevel: "M",
  margin: 2,
  color: { dark: "#1a1816", light: "#faf9f7" },
});
await writeFile(path.join(iconsDir, "install-qr.svg"), qrSvg);

console.log("PWA assets written:");
console.log(`  icons/ → 192, 512, 512-maskable, apple-touch-icon`);
console.log(`  favicon.png replaced with real PNG`);
console.log(`  QR → ${TEAM_INSTALL_URL}`);
