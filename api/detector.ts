import type { VercelRequest, VercelResponse } from "@vercel/node";
import dns from "dns/promises";
import net from "net";

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

async function runGlobalPing(domain: string) {
  const response = await fetch("https://api.globalping.io/v1/measurements", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "ping",
      target: domain,
      locations: [
        { continent: "NA" },
        { continent: "SA" },
        { continent: "EU" },
        { continent: "AS" },
        { continent: "AF" }
      ],
      limit: 15
    })
  });

  if (!response.ok) {
    throw new Error("Falha ao criar medição Globalping");
  }

  return response.json();
}

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

  const { dominio } = req.body || {};

  if (!dominio || typeof dominio !== "string") {
    return res.status(400).json({ error: "Domínio inválido" });
  }

  // 🌐 DNS
  let dnsResult;
  try {
    dnsResult = await dns.resolveAny(dominio);
  } catch {
    dnsResult = { error: "Falha ao resolver DNS" };
  }

  // 📡 TCP
  const tcpResult = await tcpTest(dominio);

  // 🌍 Globalping
  let globalping;
  try {
    const measurement = await runGlobalPing(dominio);

    globalping = {
      measurement_id: measurement.id,
      probes: measurement.probes || []
    };
  } catch {
    globalping = { error: "Falha ao iniciar Globalping" };
  }

  return res.status(200).json({
    dominio,
    status: "ok",
    origem: "vercel-serverless",
    dns: dnsResult,
    tcp: tcpResult,
    globalping,
    timestamp: new Date().toISOString()
  });
}
