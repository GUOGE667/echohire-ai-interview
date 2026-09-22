export async function tryGetD1() {
  try {
    const { env } = await import("cloudflare:workers");
    return env.DB ?? null;
  } catch {
    return null;
  }
}

export async function getD1() {
  const db = await tryGetD1();
  if (!db) throw new Error("Cloudflare D1 binding `DB` is unavailable.");
  return db;
}
