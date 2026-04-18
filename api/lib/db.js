import { createClient } from "@supabase/supabase-js";

export const DB = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export async function buscarQuarentena() {
  try {
    const seteDiasAtras = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

    const { data } = await DB
      .from("sugestoes_log")
      .select("perfume_nome")
      .gte("created_at", seteDiasAtras)
      .order("created_at", { ascending: false })
      .limit(100);
    if (!data || !data.length) return [];
    const contagem = {};
    data.forEach(({ perfume_nome }) => {
      contagem[perfume_nome] = (contagem[perfume_nome] || 0) + 1;
    });
    return Object.entries(contagem)
      .filter(([_, n]) => n >= 2)
      .map(([nome]) => nome);
  } catch (_) { return []; }
}

export async function registrarSugestoes(nomes) {
  try {
    const rows = nomes.map(perfume_nome => ({ perfume_nome }));
    await DB.from("sugestoes_log").insert(rows);
  } catch (_) {}
}
