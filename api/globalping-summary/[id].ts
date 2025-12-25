import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  const { id } = req.query;

  if (!id || typeof id !== "string") {
    return res.status(400).json({ error: "measurement_id inválido" });
  }

  try {
    // chama o endpoint atual (que já funciona)
    const response = await fetch(
      `https://diagnostico-backend-vercel.vercel.app/api/globalping/${id}`
    );

    if (!response.ok) {
      return res.status(502).json({ error: "Erro ao consultar Globalping" });
    }

    const data = await response.json();
    const results = data?.results?.results || [];

    const summary = results.map((item: any) => ({
      continent: item.probe?.continent,
      country: item.probe?.country,
      city: item.probe?.city,
      network: item.probe?.network,
      avg_rtt: item.result?.stats?.avg ?? null,
      loss: item.result?.stats?.loss ?? null
    }));

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(200).json({
      target: data.results?.target,
      status: data.results?.status,
      summary
    });
  } catch (error) {
    res.status(500).json({ error: "Erro interno" });
  }
}
