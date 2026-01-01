import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Domínios que podem chamar a API
const ALLOWED_ORIGINS = new Set([
  "https://vguerise.github.io",
]);



// Chaves fixas do radar (sempre presentes no output)
const FAMILIAS_TEMPLATE = {
  fresco_citrico: 0,
  amadeirado: 0,
  doce_gourmand: 0,
  especiado_oriental: 0,
  aquatico: 0,
  aromatico_verde: 0,
  floral: 0,
  frutado: 0,
  talco_fougere: 0,
};

function coerceNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function normalizeFamiliasTo100(obj) {
  const out = { ...FAMILIAS_TEMPLATE };
  if (!obj || typeof obj !== "object") return out;

  // copia apenas as chaves conhecidas
  for (const k of Object.keys(out)) out[k] = coerceNumber(obj[k]);

  const total = Object.values(out).reduce((a, b) => a + b, 0);

  // se vier tudo zerado ou inválido, deixa zerado
  if (!Number.isFinite(total) || total <= 0) return out;

  // normaliza para somar 100
  for (const k of Object.keys(out)) out[k] = (out[k] / total) * 100;

  // arredonda e corrige drift para fechar em 100
  const keys = Object.keys(out);
  for (const k of keys) out[k] = Math.round(out[k]);

  let sum = keys.reduce((a, k) => a + out[k], 0);
  if (sum !== 100) {
    // ajusta na maior família
    let maxK = keys[0];
    for (const k of keys) if (out[k] > out[maxK]) maxK = k;
    out[maxK] += (100 - sum);
  }

  return out;
}

function setCors(req, res) {
  const origin = req.headers.origin;

  if (!origin) {
    res.setHeader("Access-Control-Allow-Origin", "*");
  } else if (ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Max-Age", "86400");
}

const SYSTEM_PROMPT = `
Você é "O Perfumista".
Objetivo: gerar (1) diagnóstico da coleção + (2) distribuição de famílias para o radar + (3) 3 recomendações para equilibrar.

REGRAS:
- Sem introdução longa.
- Saída SEMPRE em JSON válido (sem markdown, sem crases).
- Sempre retorne exatamente 3 recomendações.
- Use perfumes reais (preferência: disponíveis no Brasil).
- Considere clima + ambiente + orçamento + lista de perfumes.
- Se faltar informação, faça a melhor inferência possível e mantenha coerência.

FAMÍLIAS (chaves fixas do radar):
fresco_citrico
amadeirado
doce_gourmand
especiado_oriental
aquatico
aromatico_verde
floral
frutado
talco_fougere

SAÍDA (schema obrigatório):
{
  "titulo": "Mapa da Coleção Perfeita — Análise e Recomendações",
  "subtitulo": "Baseado no seu diagnóstico e nas lacunas identificadas.",
  "diagnostico": {
    "nivel": "INICIANTE | INTERMEDIÁRIO | AVANÇADO (com complemento se necessário)",
    "equilibrada": true,
    "dominante": "nome humano da família dominante (ex: Fresco/Cítrico)",
    "top_faltantes": ["...", "...", "..."],
    "texto": "1 parágrafo curto e direto (sem enrolação)."
  },
  "familias_percentuais": {
    "fresco_citrico": 0,
    "amadeirado": 0,
    "doce_gourmand": 0,
    "especiado_oriental": 0,
    "aquatico": 0,
    "aromatico_verde": 0,
    "floral": 0,
    "frutado": 0,
    "talco_fougere": 0
  },
  "recomendacoes": [
    {
      "nome": "Nome do perfume",
      "familia": "Fresco/Cítrico | Amadeirado | Doce/Gourmand | Especiado/Oriental | Aquático | Aromático/Verde | Floral | Frutado | Talco/Fougère",
      "faixa_preco": "R$ 400–550",
      "por_que": "1 frase objetiva",
      "quando_usar": "1 frase objetiva"
    }
  ],
  "pergunta_extra": "Quer mais alguma sugestão? Diga clima, ambiente e orçamento!"
}

RESTRIÇÃO IMPORTANTE:
- As porcentagens em familias_percentuais devem somar 100.
- Sempre inclua todas as 9 chaves, mesmo que seja 0.
`;

export default async function handler(req, res) {
  setCors(req, res);

  // Preflight
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Use POST" });
  }

  try {
    // Parse defensivo (Vercel às vezes manda string)
    const body =
      typeof req.body === "string"
        ? JSON.parse(req.body)
        : (req.body || {});

    // Compatibilidade total com fronts antigos e novos
    const incoming =
      (body.diagnostico ?? body.prompt ?? body.text ?? "").toString().trim();

    if (!incoming) {
      return res.status(400).json({ error: "Campo 'diagnostico' vazio." });
    }

    const diagnostico =
      incoming.length > 6000 ? incoming.slice(0, 6000) : incoming;

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: diagnostico },
      ],
      max_output_tokens: 450,
    });

    const text =
      response.output
        ?.flatMap(o => o.content || [])
        ?.filter(c => c.type === "output_text")
        ?.map(c => c.text)
        ?.join("") || "";

    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
            // fallback se o modelo sair do formato
      data = {
        titulo: "Resposta do Perfumista",
        subtitulo: "Não foi possível formatar em cards automaticamente.",
        diagnostico: null,
        familias_percentuais: { ...FAMILIAS_TEMPLATE },
        recomendacoes: [],
        pergunta_extra:
          "Quer mais alguma sugestão? Digite a situação, clima, ambiente e orçamento!",
        raw: text,
      };
    }

    
    // Sanitização / compatibilidade com o mapa
    // - garante 3 recomendações
    // - garante diagnóstico
    // - garante familias_percentuais com as 9 chaves e somando 100
    if (!data || typeof data !== "object") data = {};

    if (!Array.isArray(data.recomendacoes)) data.recomendacoes = [];
    data.recomendacoes = data.recomendacoes.slice(0, 3);
    if (data.diagnostico == null) data.diagnostico = null;

    // aceita também 'familias' como alias
    const famIn = data.familias_percentuais || data.familias || null;
    data.familias_percentuais = normalizeFamiliasTo100(famIn);

// também devolve "text" para compatibilidade com fronts antigos
    return res.status(200).json({ ...data, text });

  } catch (err) {
    const status = err?.status || 500;
    const msg = err?.message || "Erro desconhecido";
    return res.status(status).json({ error: msg });
  }
}
