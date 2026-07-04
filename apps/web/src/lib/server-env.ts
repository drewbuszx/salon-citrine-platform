import { loadEnv } from "vite";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// apps/web/src/lib -> four levels up = monorepo root (where .env lives; matches vite envDir)
const platformRoot = path.resolve(__dirname, "../../../..");

if (!import.meta.env?.PROD) {
  const mode =
    process.env.NODE_ENV ??
    (typeof import.meta.env?.MODE === "string" ? import.meta.env.MODE : "development");

  const loadedEnv = loadEnv(mode, platformRoot, "");

  for (const [key, value] of Object.entries(loadedEnv)) {
    if (value && (process.env[key] === undefined || process.env[key] === "")) {
      process.env[key] = value;
    }
  }
}

/**
 * Server-side env for API routes and SSR.
 * In dev, loads platform root .env via Vite loadEnv; in prod, uses runtime process.env.
 */
export function getServerEnv(name: string): string | undefined {
  const fromProcess = process.env[name];
  if (fromProcess !== undefined && fromProcess !== "") {
    return fromProcess;
  }

  const fromMeta = import.meta.env?.[name as keyof ImportMetaEnv];
  if (typeof fromMeta === "string" && fromMeta !== "") {
    return fromMeta;
  }

  return undefined;
}
