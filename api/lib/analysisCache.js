import { DB } from "./db.js";
import { createHash } from "crypto";

const TTL_HOURS = 24;

function hashColecao(colecao, contexto) {
  const sorted = [...colecao].sort().join("|");
  const key = `${sorted}::${contexto.clima}::${contexto.ambiente}::${contexto.idade}::${contexto.orcamento}`;
  return createHash("md5").update(key).digest("hex");
}

export async function buscarCache(colecao, contexto) {
  try {
    const hash = hashColecao(colecao, contexto);
    const expiry = new Date(Date.now() - TTL_HOURS * 3600 * 1000).toISOString();

    const { data } = await DB
      .from("analises_cache")
      .select("resultado")
      .eq("hash", hash)
      .gte("created_at", expiry)
      .limit(1)
      .single();

    return data?.resultado || null;
  } catch (_) { return null; }
}

export async function salvarCache(colecao, contexto, resultado) {
  try {
    const hash = hashColecao(colecao, contexto);
    await DB.from("analises_cache").upsert(
      { hash, resultado, created_at: new Date().toISOString() },
      { onConflict: "hash" }
    );
  } catch (_) {}
}
