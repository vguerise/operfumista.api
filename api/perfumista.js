// API de TESTE - verificar se Vercel está funcionando
// Coloque em: /api/test.js

export default function handler(req, res) {
  console.log("🧪 TEST endpoint chamado");
  
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  
  if (req.method === "OPTIONS") {
    console.log("✅ OPTIONS request");
    return res.status(200).end();
  }
  
  // Informações de diagnóstico
  const diagnostico = {
    success: true,
    message: "✅ API Vercel está funcionando!",
    timestamp: new Date().toISOString(),
    environment: {
      nodeVersion: process.version,
      hasOpenAIKey: !!process.env.OPENAI_API_KEY,
      openAIKeyLength: process.env.OPENAI_API_KEY?.length || 0,
      openAIKeyPrefix: process.env.OPENAI_API_KEY?.substring(0, 8) || "NOT_SET"
    },
    request: {
      method: req.method,
      headers: {
        origin: req.headers.origin,
        userAgent: req.headers["user-agent"]
      }
    }
  };
  
  console.log("✅ Respondendo:", JSON.stringify(diagnostico));
  
  return res.status(200).json(diagnostico);
}
