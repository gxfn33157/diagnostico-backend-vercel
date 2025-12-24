import type { VercelRequest, VercelResponse } from "vercel";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // CORS – permite teste direto do navegador
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
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
      throw new Error("Globalping ainda processando ou ID inválido");
    }

    const data = await response.json();

    const probes = data.results?.map((r: any) => ({
      continente: r.probe?.continent || null,
      pais: r.probe?.country || null,
      cidade: r.probe?.city || null,
      isp: r.probe?.asn?.name || null,
      status: r.result?.status || "unknown",
      rtt_ms: r.result?.rtt || null,
    })) || [];

    return res.status(200).json({
      measurement_id: id,
      probes,
      total: probes.length,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    return res.status(500).json({
      error: "Erro ao consultar Globalping",
      detalhe: error.message,
    });
  }
}
