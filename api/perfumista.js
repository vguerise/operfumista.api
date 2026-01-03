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

const SYSTEM_PROMPT = `Você é "O Perfumista" - especialista em perfumaria masculina brasileira com foco em ANÁLISE DE COLEÇÃO e EQUILÍBRIO OLFATIVO.

**REGRA CRÍTICA DAS RECOMENDAÇÕES:**
NUNCA sugira perfumes da FAMÍLIA DOMINANTE! Se 66% da coleção é "Doce/Gourmand", NÃO sugira perfume doce!

Seu papel é:
1. Analisar a coleção de perfumes
2. Identificar família de CADA perfume
3. Calcular família DOMINANTE
4. Identificar TOP 3 famílias que FALTAM
5. Sugerir 3 perfumes que EQUILIBREM (das famílias que faltam)

## REGRAS DAS RECOMENDAÇÕES:

1. ❌ NUNCA sugerir da família DOMINANTE
2. ✅ PRIORIZAR famílias com 0 perfumes (faltam)
3. ✅ Cada recomendação de família DIFERENTE
4. ✅ Respeitar clima/ambiente/orçamento

Exemplo:
- Dominante: Doce/Gourmand (66%)
- Faltam: Fresco, Aquático, Amadeirado
- Recomendações: ✅ Prada Luna Rossa (Fresco), ✅ Acqua di Gio (Aquático), ✅ Bleu de Chanel (Amadeirado)
- ERRADO: ❌ Eros (Doce) - É da família dominante!

Responda APENAS com JSON válido, sem markdown.`;

export default async function handler(req, res) {
  // Configurar CORS
  setCors(req, res);

  // Tratar preflight OPTIONS
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Apenas POST permitido
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  try {
    const { diagnostico } = req.body;

    if (!diagnostico || typeof diagnostico !== "string") {
      return res.status(400).json({ error: "Campo 'diagnostico' é obrigatório" });
    }

    console.log('📋 Diagnóstico recebido (primeiros 100 chars):', diagnostico.substring(0, 100));

    // Usar chat.completions.create com gpt-4o-mini
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: diagnostico },
      ],
      max_tokens: 1200,
      temperature: 0.7,
    });

    // Extrair resposta
    const text = response.choices[0]?.message?.content || "";
    console.log('✅ Resposta da IA (primeiros 200 chars):', text.substring(0, 200));

    // Limpar possível markdown
    const cleanText = text.replace(/```json\n?|\n?```/g, '').trim();

    let data;
    try {
      data = JSON.parse(cleanText);
      console.log('✅ JSON parseado com sucesso');
    } catch (e) {
      console.error('❌ Erro ao parsear JSON:', e);
      console.error('Texto recebido:', cleanText);
      // fallback se o modelo sair do formato
      data = {
        error: "Erro ao processar resposta da IA",
        raw: text,
      };
    }

    // Retornar JSON
    return res.status(200).json(data);

  } catch (err) {
    console.error('❌ Erro na API:', err);
    const status = err?.status || 500;
    const msg = err?.message || "Erro desconhecido";
    return res.status(status).json({ error: msg });
  }
}
