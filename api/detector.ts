import type { VercelRequest, VercelResponse } from "@vercel/node";
import dns from "dns/promises";
import net from "net";

const RIPE_API_KEY = process.env.RIPE_ATLAS_API_KEY;

/* =========================
   TCP TEST (porta 443)
========================= */
function tcpTest(host: string, port = 443, timeout = 3000) {
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = new net.Socket();

    socket.setTimeout(timeout);

    socket.connect(port, host, () => {
      const latency = Date.now() - start;
      socket.destroy();
      resolve({
        status: "online",
        port,
        latency_ms: latency
      });
    });

    socket.on("error", () => {
      socket.destroy();
      resolve({
        status: "offline",
        port
      });
    });

    socket.on("timeout", () => {
      socket.destroy();
      resolve({
        status: "timeout",
        port
      });
    });
  });
}

/* =========================
   RIPE ATLAS – HTTP TEST
========================= */
async function ripeAtlasHttpTest(dominio: string) {
  if (!RIPE_API_KEY) {
    return { error: "RIPE Atlas API Key não configurada" };
  }

  const measurementBody = {
    definitions: [
      {
        type: "http",
        target: `https://${dominio}`,
        method: "GET",
        af: 4,
        resolve_on_probe: true,
        description: `Diagnóstico HTTP ${dominio}`
      }
    ],
    probes: [
      { requested: 5, type: "area", value: "WW" }, // Global
      { requested: 5, type: "area", value: "South America" }, // América do Sul
      { requested: 5, type: "country", value: "BR" } // Brasil
    ],
    is_oneoff: true
  };

  const createRes = await fetch("https://atlas.ripe.net/api/v2/measurements/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Key ${RIPE_API_KEY}`
    },
    body: JSON.stringify(measurementBody)
  });

  const createData = await createRes.json();
  const measurementId = createData.measurements?.[0];

  if (!measurementId) {
    return { error: "Falha ao criar medição RIPE Atlas" };
  }

  // Aguarda alguns segundos para os probes responderem
  await new Promise((r) => setTimeout(r, 5000));

  const resultRes = await fetch(
    `https://atlas.ripe.net/api/v2/measurements/${measurementId}/results/`
  );
  const results = await resultRes.json();

  let ok = 0;
  let fail = 0;

  for (const r of results) {
    if (r.result?.status === 200) ok++;
    else fail++;
  }

  return {
    measurement_id: measurementId,
    probes_total: results.length,
    sucesso: ok,
    falha: fail
  };
}

/* =========================
   HANDLER PRINCIPAL
========================= */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // 🔓 CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  try {
    const { dominio } = req.body || {};

    if (!dominio || typeof dominio !== "string") {
      return res.status(400).json({ error: "Domínio inválido" });
    }

    /* 🌐 DNS */
    let dnsResult;
    try {
      dnsResult = await dns.resolveAny(dominio);
    } catch {
      dnsResult = { error: "Falha ao resolver DNS" };
    }

    /* 📡 TCP */
    const tcpResult = await tcpTest(dominio);

    /* 🌍 RIPE ATLAS */
    const ripeAtlasResult = await ripeAtlasHttpTest(dominio);

    return res.status(200).json({
      dominio,
      status: "ok",
      origem: "vercel-serverless",
      dns: dnsResult,
      tcp: tcpResult,
      ripe_atlas: ripeAtlasResult,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return res.status(500).json({
      error: "Erro interno no diagnóstico"
    });
  }
}
