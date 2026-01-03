// VERSÃO DE TESTE - Retorna JSON fake sem chamar OpenAI
// Use para testar se o CORS está funcionando ANTES de ativar a IA

export default async function handler(req, res) {
  // CORS PRIMEIRO
  const origin = req.headers.origin;
  
  if (origin === "https://vguerise.github.io") {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }
  
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");
  
  console.log("📥 Recebido:", req.method, "de", origin);
  
  // Preflight OPTIONS
  if (req.method === "OPTIONS") {
    console.log("✅ OPTIONS - respondendo 200");
    return res.status(200).end();
  }
  
  // POST - retorna JSON FAKE para testar
  if (req.method === "POST") {
    console.log("✅ POST - retornando JSON fake");
    
    // JSON fake no formato que o frontend espera
    const jsonFake = {
      "analise_colecao": {
        "total_perfumes": 3,
        "familias_representadas": 2,
        "perfumes_por_familia": {
          "Amadeirado": 1,
          "Aromático/Verde": 1,
          "Aquático": 1,
          "Doce/Gourmand": 0,
          "Especiado/Oriental": 0,
          "Floral": 0,
          "Fresco/Cítrico": 0,
          "Frutado": 0,
          "Talco/Fougère": 0
        },
        "familia_dominante": {
          "nome": "🌳 Aromático/Verde",
          "quantidade": 1,
          "porcentagem": 33
        },
        "top3_faltando": [
          "🍋 Fresco/Cítrico",
          "🍯 Doce/Gourmand",
          "🔥 Especiado/Oriental"
        ],
        "nivel": {
          "emoji": "🎯",
          "titulo": "INICIANTE",
          "descricao": "TESTE: Esta é uma resposta fake para testar CORS. Você está começando sua jornada."
        },
        "equilibrio": {
          "status": "equilibrada",
          "emoji": "✅",
          "mensagem": "TESTE: Coleção equilibrada (resposta fake para teste de CORS)"
        }
      },
      "recomendacoes": [
        {
          "nome": "TESTE - Prada Luna Rossa Ocean",
          "familia": "Fresco/Cítrico",
          "faixa_preco": "R$ 400-520",
          "por_que": "TESTE DE CORS: Esta é uma recomendação fake",
          "quando_usar": "TESTE: Para verificar se o CORS está funcionando"
        },
        {
          "nome": "TESTE - Acqua di Gio Profumo",
          "familia": "Aquático",
          "faixa_preco": "R$ 450-600",
          "por_que": "TESTE DE CORS: Segunda recomendação fake",
          "quando_usar": "TESTE: Verificando estrutura JSON"
        },
        {
          "nome": "TESTE - 1 Million Prive",
          "familia": "Doce/Gourmand",
          "faixa_preco": "R$ 350-480",
          "por_que": "TESTE DE CORS: Terceira recomendação fake",
          "quando_usar": "TESTE: Se você vê isso, o CORS funciona!"
        }
      ],
      "contexto_aplicado": {
        "clima": "🌡️ Temperado",
        "ambiente": "🏢 Fechado",
        "orcamento": "R$ 300-500"
      }
    };
    
    return res.status(200).json(jsonFake);
  }
  
  // Outros métodos
  return res.status(405).json({ error: "Método não permitido" });
}
