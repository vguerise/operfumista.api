import { DB } from "./db.js";

const GEMINI_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`;

async function buscarClassificacoesSupabase(nomes) {
  try {
    const { data } = await DB
      .from("perfumes_classificados")
      .select("nome, familia_olfativa")
      .in("nome", nomes);
    if (!data) return {};
    const map = {};
    data.forEach(({ nome, familia_olfativa }) => {
      map[nome.toLowerCase()] = familia_olfativa;
    });
    return map;
  } catch (_) { return {}; }
}

async function salvarClassificacoes(classificacoes) {
  try {
    const rows = classificacoes.map(({ nome, familia }) => ({
      nome,
      familia_olfativa: familia,
      fonte: "gemini",
      confirmado: false,
      updated_at: new Date().toISOString()
    }));
    await DB.from("perfumes_classificados").upsert(rows, { onConflict: "nome" });
  } catch (_) {}
}

async function classificarViGemini(nomes) {
  if (!nomes.length || !GEMINI_KEY) return {};
  try {
    const lista = nomes.map((n, i) => `${i + 1}. ${n}`).join("\n");
    const prompt = `Você é especialista em perfumaria. Classifique cada perfume abaixo na família olfativa correta segundo o Fragrantica. Use busca na web para confirmar cada um.\n\nPerfumes:\n${lista}\n\nFamílias aceitas: Fresco/Cítrico, Aromático/Verde, Doce/Gourmand, Amadeirado, Especiado/Oriental, Aquático/Mineral, Talco/Fougère, Floral/Floral Branco, Frutado, Couro, Chypre\n\nResponda APENAS com JSON sem markdown:\n{"classificacoes": [{"nome": "nome exato", "familia": "família olfativa"}]}`;

    const resp = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tools: [{ google_search: {} }],
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1 }
      })
    });

    const json = await resp.json();
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}") + 1;
    const parsed = JSON.parse(text.slice(start, end));

    const map = {};
    (parsed.classificacoes || []).forEach(({ nome, familia }) => {
      if (nome && familia) map[nome.toLowerCase()] = familia;
    });
    return map;
  } catch (e) {
    console.error("Gemini erro:", e.message);
    return {};
  }
}

export async function classificarColecao(nomes) {
  if (!nomes || !nomes.length) return {};

  const cached = await buscarClassificacoesSupabase(nomes);
  const semCache = nomes.filter(n => !cached[n.toLowerCase()]);

  let geminiMap = {};
  if (semCache.length) {
    geminiMap = await classificarViGemini(semCache);
    const novas = semCache
      .filter(n => geminiMap[n.toLowerCase()])
      .map(n => ({ nome: n, familia: geminiMap[n.toLowerCase()] }));
    if (novas.length) await salvarClassificacoes(novas);
  }

  const resultado = {};
  nomes.forEach(n => {
    resultado[n] = cached[n.toLowerCase()] || geminiMap[n.toLowerCase()] || null;
  });
  return resultado;
}
