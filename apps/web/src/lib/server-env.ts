/**
 * Server-side env for API routes and SSR.
 * Prefer process.env (runtime) over import.meta.env (Vite build-time inlining).
 */
export function getServerEnv(name: string): string | undefined {
  const fromProcess = process.env[name];
  if (fromProcess !== undefined && fromProcess !== "") {
    return fromProcess;
  }

  const fromMeta = import.meta.env[name as keyof ImportMetaEnv];
  if (typeof fromMeta === "string" && fromMeta !== "") {
    return fromMeta;
  }

  return undefined;
}
