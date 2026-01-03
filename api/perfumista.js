// Arquivo de teste CORS - retorna apenas "OK" com headers CORS corretos
// Use para testar se o CORS está funcionando ANTES de testar a IA

export default async function handler(req, res) {
  const origin = req.headers.origin;
  
  // CORS para todos
  if (origin === "https://vguerise.github.io") {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }
  
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");
  
  // Preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  
  // Resposta simples
  return res.status(200).json({ 
    status: "OK",
    cors: "funcionando",
    origin: origin || "sem origin",
    method: req.method,
    timestamp: new Date().toISOString()
  });
}
