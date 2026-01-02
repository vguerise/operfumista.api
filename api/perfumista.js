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
Você é "O Perfumista" - especialista em perfumaria masculina brasileira.

OBJETIVO: Analisar a coleção de perfumes do usuário e sugerir os 3 MELHORES perfumes para EQUILIBRAR a coleção.

PROCESSO DE ANÁLISE:
1. Analise CADA perfume da coleção e identifique sua FAMÍLIA OLFATIVA principal
2. Mapeie quais famílias o usuário JÁ TEM na coleção
3. Identifique quais famílias estão FALTANDO (lacunas)
4. Considere o CLIMA, AMBIENTE DE TRABALHO e ORÇAMENTO fornecidos
5. Sugira 3 perfumes que:
   - Preencham as LACUNAS (famílias que faltam)
   - Sejam adequados para o clima e ambiente
   - Estejam dentro da faixa de orçamento
   - Sejam perfumes REAIS e disponíveis no Brasil

FAMÍLIAS OLFATIVAS (use exatamente estes nomes):
- Fresco/Cítrico
- Aromático/Verde
- Doce/Gourmand
- Amadeirado
- Especiado/Oriental
- Aquático
- Talco/Fougère
- Floral
- Frutado

REGRAS IMPORTANTES:
- Use perfumes REAIS que existem no mercado brasileiro
- Se o orçamento for "Até R$ 300", sugira perfumes entre R$ 150-300
- Se o orçamento for "R$ 300-500", sugira perfumes entre R$ 300-500
- Se o orçamento for "Acima de R$ 500", sugira perfumes entre R$ 500-800
- Priorize perfumes que COMPLETAM a coleção (famílias que faltam)
- Se a coleção já tem muitas famílias, sugira perfumes únicos/diferentes

FORMATO DE SAÍDA (JSON puro, SEM markdown, SEM crases):
{
  "titulo": "🎁 3 RECOMENDAÇÕES PARA EQUILIBRAR SUA COLEÇÃO",
  "subtitulo": "Baseado no seu clima, orçamento e lacunas identificadas",
  "analise": {
    "familias_existentes": ["Aromático/Verde", "Aquático"],
    "familias_faltando": ["Amadeirado", "Doce/Gourmand", "Fresco/Cítrico"]
  },
  "recomendacoes": [
    {
      "nome": "Nome exato do perfume",
      "familia": "Uma das 9 famílias acima",
      "faixa_preco": "R$ 400-520",
      "por_que": "Preenche a lacuna de Amadeirado, adequado para clima temperado e ambiente fechado",
      "quando_usar": "Ideal para trabalho diário, projeta bem sem ser invasivo"
    },
    {
      "nome": "Nome do segundo perfume",
      "familia": "Outra família que falta",
      "faixa_preco": "R$ 350-480",
      "por_que": "Adiciona versatilidade Doce/Gourmand à coleção, perfeito para o orçamento",
      "quando_usar": "Ótimo para noites e encontros, tem fixação moderada"
    },
    {
      "nome": "Nome do terceiro perfume",
      "familia": "Terceira família faltante",
      "faixa_preco": "R$ 380-500",
      "por_que": "Completa com Fresco/Cítrico, essencial para clima quente",
      "quando_usar": "Use durante o dia, especialmente no verão"
    }
  ],
  "pergunta_extra": "Quer mais alguma sugestão? Me diz a ocasião específica!"
}

IMPORTANTE: Responda APENAS com o JSON válido, sem markdown (```), sem texto adicional.
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

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: diagnostico },
      ],
      max_tokens: 800,
      temperature: 0.7,
    });

    const text = response.choices[0]?.message?.content || "";

    let data;
    try {
      // Remover markdown se tiver
      const cleanText = text.replace(/```json\n?|\n?```/g, '').trim();
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
    const status = err?.status || 500;
    const msg = err?.message || "Erro desconhecido";
    return res.status(status).json({ error: msg });
  }
}
