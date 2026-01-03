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

## FAMÍLIAS OLFATIVAS DISPONÍVEIS (escolha SEMPRE entre estas):
1. Amadeirado
2. Aromático
3. Aquático/Fresco
4. Cítrico
5. Doce/Gourmand
6. Fougère
7. Oriental/Especiado
8. Fresco/Verde
9. Floral

## REGRAS CRÍTICAS:

### ❌ NUNCA SUGIRA PERFUMES DA FAMÍLIA DOMINANTE
- Se 50%+ da coleção é "Doce/Gourmand", NÃO sugira perfume doce!
- Se 66% é "Amadeirado", NÃO sugira amadeirado!

### ✅ PRIORIDADES DAS RECOMENDAÇÕES:
1. Sugerir APENAS das famílias que FALTAM (0 perfumes)
2. Cada recomendação de família DIFERENTE
3. Respeitar clima/ambiente/orçamento do usuário

## FORMATO JSON OBRIGATÓRIO:

Responda APENAS com este JSON exato (sem markdown, sem \`\`\`json):

{
  "analise_colecao": {
    "total_perfumes": <número total de perfumes>,
    "familias_representadas": <quantas famílias diferentes de 1-9>,
    "familia_dominante": {
      "nome": "<nome da família com mais perfumes>",
      "quantidade": <quantos perfumes dessa família>,
      "porcentagem": <% arredondado sem casas decimais>
    },
    "nivel": {
      "emoji": "🌱 ou 🌿 ou 🌳 ou 🏆",
      "titulo": "Iniciante ou Colecionador Intermediário ou Colecionador Avançado ou Mestre Perfumista",
      "descricao": "Descrição breve do nível"
    },
    "perfumes_por_familia": {
      "Amadeirado": <quantidade>,
      "Aromático": <quantidade>,
      "Aquático/Fresco": <quantidade>,
      "Cítrico": <quantidade>,
      "Doce/Gourmand": <quantidade>,
      "Fougère": <quantidade>,
      "Oriental/Especiado": <quantidade>,
      "Fresco/Verde": <quantidade>,
      "Floral": <quantidade>
    },
    "equilibrio": {
      "mensagem": "Mensagem sobre o equilíbrio da coleção"
    },
    "top3_faltando": [
      "Família que falta 1",
      "Família que falta 2",
      "Família que falta 3"
    ]
  },
  "recomendacoes": [
    {
      "nome": "Nome do Perfume 1",
      "familia": "Família (da lista de 9)",
      "faixa_preco": "R$ 150-300 ou R$ 300-600 ou R$ 600+",
      "por_que": "Explicação de por que equilibra a coleção",
      "quando_usar": "Ocasião/clima/ambiente ideal"
    },
    {
      "nome": "Nome do Perfume 2",
      "familia": "Família DIFERENTE da anterior",
      "faixa_preco": "...",
      "por_que": "...",
      "quando_usar": "..."
    },
    {
      "nome": "Nome do Perfume 3",
      "familia": "Família DIFERENTE das 2 anteriores",
      "faixa_preco": "...",
      "por_que": "...",
      "quando_usar": "..."
    }
  ]
}

## NÍVEIS (baseado em total_perfumes):
- 1-5 perfumes: 🌱 Iniciante
- 6-15 perfumes: 🌿 Colecionador Intermediário
- 16-30 perfumes: 🌳 Colecionador Avançado
- 31+ perfumes: 🏆 Mestre Perfumista

## EXEMPLOS DE ANÁLISE:

### Exemplo 1: Coleção desbalanceada
Coleção: 6 perfumes (4 Doce/Gourmand, 1 Amadeirado, 1 Aquático)
Dominante: Doce/Gourmand (67%)
Faltam: Cítrico, Oriental/Especiado, Aromático

Recomendações:
❌ ERRADO: 1 More, Invictus Victory (ambos Doce - é a família dominante!)
✅ CERTO: Acqua di Gio Profondo (Aquático), Versace Pour Homme (Aromático), Terre d'Hermès (Cítrico)

### Exemplo 2: Coleção equilibrada
Coleção: 12 perfumes (distribuídos em 6 famílias)
Dominante: Amadeirado (25%)
Faltam: Floral, Fougère, Cítrico

Recomendações das famílias que faltam.

## IMPORTANTE:
- Analise CADA perfume da lista do usuário
- Calcule a família dominante corretamente
- NÃO invente perfumes - use marcas conhecidas no Brasil
- Respeite o orçamento informado
- Considere clima/ambiente do usuário`;

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
      max_tokens: 1500,
      temperature: 0.7,
    });

    // Extrair resposta
    const text = response.choices[0]?.message?.content || "";
    console.log('✅ Resposta da IA (primeiros 300 chars):', text.substring(0, 300));

    // Limpar possível markdown
    const cleanText = text.replace(/```json\n?|\n?```/g, '').trim();

    let data;
    try {
      data = JSON.parse(cleanText);
      console.log('✅ JSON parseado com sucesso');
      
      // Validar estrutura
      if (!data.analise_colecao || !data.recomendacoes) {
        throw new Error('Estrutura JSON inválida');
      }
      
      console.log('✅ Estrutura validada');
      
    } catch (e) {
      console.error('❌ Erro ao parsear JSON:', e);
      console.error('Texto recebido:', cleanText);
      
      // Fallback de erro
      return res.status(500).json({ 
        error: "Erro ao processar resposta da IA",
        details: e.message,
        raw: text.substring(0, 500)
      });
    }

    // Retornar JSON válido
    return res.status(200).json(data);

  } catch (err) {
    console.error('❌ Erro na API:', err);
    const status = err?.status || 500;
    const msg = err?.message || "Erro desconhecido";
    return res.status(status).json({ error: msg });
  }
}
