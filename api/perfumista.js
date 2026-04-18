import OpenAI from "openai";
import { buscarQuarentena, registrarSugestoes } from "./lib/db.js";
import { classificarColecao } from "./lib/classify.js";
import { checkRateLimit } from "./lib/rateLimit.js";
import { buscarCache, salvarCache } from "./lib/analysisCache.js";
import { SYSTEM_PROMPT_ANALISE, SYSTEM_PROMPT_PERGUNTA } from "./lib/prompts.js";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function setCors(res, origin) {
  const allowed = origin === "https://vguerise.github.io" ? origin : "*";
  res.setHeader("Access-Control-Allow-Origin", allowed);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");
}

function getIp(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.headers["x-real-ip"] ||
    req.socket?.remoteAddress ||
    "unknown"
  );
}

async function chamarGPT(model, systemPrompt, userMessage, maxTokens = 2000) {
  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage }
    ],
    max_tokens: maxTokens,
    temperature: 0.3,
    response_format: { type: "json_object" }
  });
  return response.choices[0]?.message?.content || "{}";
}

function parseJson(text) {
  let clean = text.trim()
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "");
  const first = clean.indexOf("{");
  const last = clean.lastIndexOf("}");
  if (first > 0) clean = clean.substring(first);
  if (last !== -1 && last < clean.length - 1) clean = clean.substring(0, last + 1);
  return JSON.parse(clean.trim());
}

export default async function handler(req, res) {
  const origin = req.headers.origin;
  setCors(res, origin);
  console.log("📥 Recebido:", req.method, "de", origin);

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido" });

  try {
    // Rate limiting
    const ip = getIp(req);
    const allowed = await checkRateLimit(ip);
    if (!allowed) {
      console.warn("🚫 Rate limit atingido para IP:", ip);
      return res.status(429).json({ error: "Muitas requisições. Aguarde um momento e tente novamente." });
    }

    const {
      diagnostico, pergunta, iniciar_colecao, contexto,
      colecao, wishlist, clima, ambiente, idade, orcamento,
      _proxy, system, messages, max_tokens
    } = req.body;

    // Formato genérico (Chat, Missão, Desejos do Perfumap)
    if (_proxy) {
      const msgs = [];
      if (system) msgs.push({ role: "system", content: system });
      if (messages?.length) msgs.push(...messages);
      const completion = await client.chat.completions.create({
        model: "gpt-4o-mini",
        max_tokens: max_tokens || 1000,
        messages: msgs,
        temperature: 0.7
      });
      const text = completion.choices?.[0]?.message?.content || "";
      return res.status(200).json({ text, content: [{ type: "text", text }] });
    }

    const quarentena = await buscarQuarentena();
    const quarentenaTexto = quarentena.length > 0
      ? quarentena.join(", ")
      : "Nenhum perfume em quarentena no momento.";

    let prompt = "";
    let userMessage = "";

    if (iniciar_colecao) {
      console.log("✅ Iniciar coleção");
      prompt = `Você é "O Perfumista" - especialista em perfumaria masculina brasileira.

SITUAÇÃO: O usuário quer COMEÇAR uma coleção do zero.

CONTEXTO DO USUÁRIO:
Clima: ${clima || "Temperado"}
Ambiente: ${ambiente || "Ambos"}
Idade: ${idade || "25-35"} anos
Orçamento: ${orcamento || "R$ 300-500"}

OBJETIVO:
Sugira 3 perfumes ESSENCIAIS para começar uma coleção, cobrindo as 3 funções básicas:
1. DIA/TRABALHO - Versátil, discreto, profissional
2. NOITE/SOCIAL - Marcante, sofisticado, sexy
3. VERSÁTIL - Funciona tanto dia quanto noite

REGRAS:
- Considere a IDADE do usuário
- Respeite o ORÇAMENTO
- Priorize nichos acessíveis (<5k reviews Fragrantica)
- Considere o CLIMA

💰 PRECIFICAÇÃO REALISTA (100ml - BRASIL 2025):
Clones árabes (Lattafa, Armaf): R$ 150-400
Designers mainstream (Versace, PR): R$ 300-800
Designers premium (Dior, Chanel): R$ 600-1.500
Nichos acessíveis (Lalique, Rochas): R$ 400-1.200
Nichos intermediários (Bulgari, Acqua di Parma): R$ 800-2.000
Nichos premium (Nishane, PDM, Initio): R$ 1.500-4.000
Ultra-premium (Creed, Roja): R$ 2.500-6.000

RETORNE JSON (apenas isso, sem \`\`\`):
{
  "recomendacoes": [
    {
      "nome": "Nome do Perfume",
      "familia": "Família Olfativa",
      "faixa_preco": "R$ X-Y",
      "por_que": "Explicação (máx 120 caracteres)",
      "quando_usar": "Ocasiões (máx 80 caracteres)"
    }
  ]
}`;
      userMessage = contexto || "Sugira 3 perfumes para começar minha coleção";

    } else if (diagnostico) {
      console.log("✅ Análise completa");

      // Cache de análise — evita chamada GPT para coleção já analisada
      const ctxCache = { clima: clima || "", ambiente: ambiente || "", idade: idade || "", orcamento: orcamento || "" };
      const colecaoNomes = (colecao || []).map(p => typeof p === "string" ? p : p.nome).filter(Boolean);

      if (colecaoNomes.length > 0) {
        const cached = await buscarCache(colecaoNomes, ctxCache);
        if (cached) {
          console.log("✅ Cache hit — análise retornada sem GPT");
          return res.status(200).json(cached);
        }
      }

      // Quarentena vai na mensagem do usuário (não no system prompt) → caching ativo
      prompt = SYSTEM_PROMPT_ANALISE;
      let userMessage_base = `${diagnostico}\n\n🔄 PERFUMES EM QUARENTENA (muito sugeridos recentemente — NÃO use):\n${quarentenaTexto}`;

      // Pré-classificação via Gemini + cache Supabase
      if (colecaoNomes.length > 0) {
        try {
          const classifs = await classificarColecao(colecaoNomes);
          const temClassif = Object.values(classifs).some(v => v);
          if (temClassif) {
            const linhas = Object.entries(classifs)
              .filter(([, f]) => f)
              .map(([n, f]) => `- ${n}: ${f}`)
              .join("\n");
            userMessage_base += `\n\n🎯 CLASSIFICAÇÕES CONFIRMADAS (USE EXATAMENTE ESTAS - NÃO RECLASSIFIQUE):\n${linhas}`;
            console.log("✅ Pré-classificação OK:", colecaoNomes.length, "perfumes");
          }
        } catch (e) {
          console.error("Pré-classificação falhou:", e.message);
        }
      }
      userMessage = userMessage_base;

    } else if (pergunta) {
      console.log("✅ Pergunta livre");
      const colecaoTexto = colecao?.length ? colecao.join(", ") : "Nenhum perfume ainda";
      const wishlistTexto = wishlist?.length ? wishlist.join(", ") : "Nenhum perfume na lista de desejos";

      prompt = SYSTEM_PROMPT_PERGUNTA
        .replace("[COLECAO_ATUAL]", colecaoTexto)
        .replace("[WISHLIST]", wishlistTexto)
        .replace("[CLIMA]", clima || "Temperado")
        .replace("[AMBIENTE]", ambiente || "Ambos")
        .replace("[IDADE]", idade || "25-35")
        .replace("[ORCAMENTO]", orcamento || "R$ 300-500")
        .replace("[PERGUNTA]", pergunta);

      userMessage = `${pergunta}\n\n🔄 PERFUMES EM QUARENTENA (muito sugeridos — NÃO use):\n${quarentenaTexto}`;

    } else {
      return res.status(400).json({ error: "Envie 'diagnostico' ou 'pergunta'" });
    }

    console.log("🤖 Chamando OpenAI");
    const model = diagnostico ? "gpt-4o" : "gpt-4o-mini";
    const text = await chamarGPT(model, prompt, userMessage);

    let data;
    try {
      data = parseJson(text);
    } catch (parseErr) {
      console.error("❌ JSON.parse falhou:", text.substring(0, 300));
      return res.status(500).json({ error: "O Perfumista não conseguiu gerar a resposta neste momento. Tente novamente em alguns segundos." });
    }

    console.log("✅ Resposta OK");

    // Salvar cache da análise
    if (diagnostico && colecao?.length > 0) {
      const ctxCache = { clima: clima || "", ambiente: ambiente || "", idade: idade || "", orcamento: orcamento || "" };
      const colecaoNomes = colecao.map(p => typeof p === "string" ? p : p.nome).filter(Boolean);
      salvarCache(colecaoNomes, ctxCache, data).catch(() => {});
    }

    // Registrar sugestões para quarentena
    try {
      const nomesParaLogar = [
        ...(data.recomendacoes || []).map(r => r.nome).filter(Boolean),
        ...(data.sugestoes || []).map(s => s.nome).filter(Boolean)
      ];
      if (nomesParaLogar.length) await registrarSugestoes(nomesParaLogar);
    } catch (_) {}

    return res.status(200).json(data);

  } catch (err) {
    console.error("❌ Erro geral:", err.message);
    return res.status(500).json({ error: "Erro interno. Tente novamente em alguns segundos." });
  }
}
