import type { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(
  req: VercelRequest,
  res: VercelResponse
) {
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
