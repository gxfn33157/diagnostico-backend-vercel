import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // ===============================
  // CORS (obrigatório para navegador)
  // ===============================
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Preflight
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { id } = req.query;

  if (!id || typeof id !== "string") {
    return res.status(400).json({ error: "Measurement ID inválido" });
  }

  try {
    const response = await fetch(
      `https://api.globalping.io/v1/measurements/${id}`
    );

    if (!response.ok) {
      return res.status(response.status).json({
        error: "Erro ao consultar Globalping",
      });
    }

    const data = await response.json();

    const probes =
      data.results?.map((r: any) => ({
        continente: r.probe?.continent,
        pais: r.probe?.country,
        cidade: r.probe?.city,
        rtt_ms: r.result?.rtt,
        status: r.result?.status,
      })) || [];

    return res.status(200).json({
      measurement_id: id,
      status: data.status,
      probes,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return res.status(500).json({
      error: "Erro interno",
      details: err.message,
    });
  }
}
