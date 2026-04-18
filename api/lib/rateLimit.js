import { DB } from "./db.js";

const MAX_REQUESTS = 20;
const WINDOW_SECONDS = 60;

export async function checkRateLimit(ip) {
  try {
    const windowStart = new Date(Date.now() - WINDOW_SECONDS * 1000).toISOString();

    const { count } = await DB
      .from("rate_limits")
      .select("*", { count: "exact", head: true })
      .eq("ip", ip)
      .gte("created_at", windowStart);

    if (count >= MAX_REQUESTS) return false;

    await DB.from("rate_limits").insert({ ip });

    // Limpeza assíncrona de registros antigos
    DB.from("rate_limits")
      .delete()
      .lt("created_at", windowStart)
      .then(() => {}).catch(() => {});

    return true;
  } catch (_) {
    return true; // Em caso de erro no banco, não bloqueia o usuário
  }
}
