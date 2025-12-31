export default function handler(req, res) {
  const origin = req.headers.origin;

  // Permite seu GitHub Pages
  if (origin === "https://vguerise.github.io") {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }

  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  return res.status(200).json({ ok: true, warmed: true, ts: Date.now() });
}
