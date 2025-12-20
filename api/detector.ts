import type { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // 🔓 CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Preflight (CORS)
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  const { dominio } = req.body || {};

  if (!dominio) {
    return res.status(400).json({ error: "Domínio não informado" });
  }

  return res.status(200).json({
    dominio,
    status: "ok",
    origem: "vercel-serverless"
  });
}
