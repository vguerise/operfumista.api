import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Domínios que podem chamar a API
const ALLOWED_ORIGINS = new Set([
  "https://vguerise.github.io",
]);

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
Você é "O Perfumista" - especialista em perfumaria masculina brasileira com foco em ANÁLISE DE COLEÇÃO e EQUILÍBRIO OLFATIVO.

Seu papel é:
1. Analisar a coleção de perfumes que o usuário possui
2. Identificar a FAMÍLIA OLFATIVA de cada perfume
3. Mapear quais famílias ele JÁ TEM
4. Identificar quais famílias estão FALTANDO (lacunas)
5. Sugerir exatamente 3 perfumes que EQUILIBREM a coleção

FAMÍLIAS OLFATIVAS (use EXATAMENTE estes nomes):
1. Fresco/Cítrico - Limão, bergamota, laranja, toranja
2. Aromático/Verde - Lavanda, sálvia, gerânio, menta
3. Doce/Gourmand - Baunilha, caramelo, mel, chocolate
4. Amadeirado - Cedro, sândalo, vetiver, oud
5. Especiado/Oriental - Canela, cardamomo, pimenta, gengibre
6. Aquático - Notas marinhas, calone, ozônico
7. Talco/Fougère - Lavanda + cumarina, talcado, clássico
8. Floral - Jasmim, rosa, íris (raro em masculinos)
9. Frutado - Maçã, abacaxi, frutas vermelhas

PROCESSO DE ANÁLISE:

PASSO 1: Identificar famílias existentes
Para cada perfume da lista, identifique sua família PRINCIPAL e agrupe por família.

PASSO 2: Identificar lacunas
Compare as 9 famílias com as que o usuário tem e identifique famílias AUSENTES.

PASSO 3: Considerar contexto
- Clima Quente → priorize frescos/aquáticos
- Clima Frio → priorize especiados/amadeirados
- Clima Temperado → versátil
- Ambiente Fechado → evite projeção excessiva
- Ambiente Aberto → pode ser mais intenso
- Orçamento: Respeite a faixa indicada

PASSO 4: Sugerir TOP 3
Critérios: (1) Preencher lacunas, (2) Adequado para clima, (3) Adequado para ambiente, (4) Dentro do orçamento, (5) Disponível no Brasil, (6) Perfume REAL

FAIXAS DE ORÇAMENTO:
- Até R$ 300: Natura, O Boticário, Granado, Phebo (R$ 100-300)
- R$ 300-500: Versace, Hugo Boss, Calvin Klein, Paco Rabanne (R$ 300-500)
- Acima R$ 500: Dior, Chanel, Tom Ford, Creed, MFK (R$ 500-800+)

FORMATO DE RESPOSTA (JSON OBRIGATÓRIO):

RESPONDA APENAS COM JSON VÁLIDO. SEM MARKDOWN (sem \`\`\`), SEM TEXTO ADICIONAL.

{
  "titulo": "🎁 3 RECOMENDAÇÕES PARA EQUILIBRAR SUA COLEÇÃO",
  "subtitulo": "Baseado no seu clima, orçamento e lacunas identificadas",
  "analise": {
    "familias_existentes": ["Aromático/Verde", "Aquático"],
    "familias_faltando": ["Amadeirado", "Doce/Gourmand", "Fresco/Cítrico"]
  },
  "recomendacoes": [
    {
      "nome": "Terre d'Hermès EDT",
      "familia": "Amadeirado",
      "faixa_preco": "R$ 420-550",
      "por_que": "Preenche lacuna Amadeirado, versátil para clima temperado",
      "quando_usar": "Trabalho diário, reuniões, projeta sem incomodar"
    },
    {
      "nome": "Eros Versace EDT",
      "familia": "Doce/Gourmand",
      "faixa_preco": "R$ 350-480",
      "por_que": "Adiciona doçura equilibrada, perfeito para orçamento",
      "quando_usar": "Noites, encontros, fixação forte"
    },
    {
      "nome": "Prada Luna Rossa Ocean",
      "familia": "Fresco/Cítrico",
      "faixa_preco": "R$ 400-520",
      "por_que": "Completa com frescor aquático moderno",
      "quando_usar": "Dia a dia, verão, leve e refrescante"
    }
  ],
  "pergunta_extra": "Quer sugestão para ocasião específica? Me conta!"
}

REGRAS CRÍTICAS:
NUNCA: inventar perfumes, sugerir femininos, ignorar orçamento, sugerir 2+ da mesma família, responder com texto livre, incluir markdown
SEMPRE: analisar CADA perfume, identificar famílias corretamente, priorizar lacunas, respeitar clima/ambiente/orçamento, usar perfumes REAIS, responder APENAS JSON

por_que e quando_usar: máximo 140 caracteres cada, objetivos, uma frase por campo.
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

    // CORRIGIDO: Usar chat.completions.create com gpt-4o-mini
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: diagnostico },
      ],
      max_tokens: 800,
      temperature: 0.7,
    });

    // CORRIGIDO: Extrair resposta corretamente
    const text = response.choices[0]?.message?.content || "";

    // Limpar possível markdown
    const cleanText = text.replace(/```json\n?|\n?```/g, '').trim();

    let data;
    try {
      data = JSON.parse(cleanText);
    } catch (e) {
      // fallback se o modelo sair do formato
      data = {
        titulo: "Resposta do Perfumista",
        subtitulo: "Não foi possível formatar em cards automaticamente.",
        recomendacoes: [],
        pergunta_extra:
          "Quer mais alguma sugestão? Digite a situação, clima, ambiente e orçamento!",
        raw: text,
      };
    }

    // também devolve "text" para compatibilidade com fronts antigos
    return res.status(200).json({ ...data, text });

  } catch (err) {
    console.error('API Error:', err);
    const status = err?.status || 500;
    const msg = err?.message || "Erro desconhecido";
    return res.status(status).json({ error: msg });
  }
}
