import type { VercelRequest, VercelResponse } from "vercel";
import dns from "dns/promises";
import net from "net";

export default async function handler(req: VercelRequest, res: VercelResponse) {

  /* =========================
     🔓 CORS (OBRIGATÓRIO)
  ========================= */
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  const { dominio } = req.body;

  if (!dominio || typeof dominio !== "string") {
    return res.status(400).json({ error: "Domínio inválido" });
  }

  /* =========================
     1️⃣ DNS LOCAL
  ========================= */
  let dnsResults: any[] = [];

  try {
    const [a, aaaa, ns] = await Promise.allSettled([
      dns.resolve4(dominio, { ttl: true }),
      dns.resolve6(dominio, { ttl: true }),
      dns.resolveNs(dominio)
    ]);

    if (a.status === "fulfilled") {
      a.value.forEach(r =>
        dnsResults.push({ type: "A", address: r.address, ttl: r.ttl })
      );
    }

    if (aaaa.status === "fulfilled") {
      aaaa.value.forEach(r =>
        dnsResults.push({ type: "AAAA", address: r.address, ttl: r.ttl })
      );
    }

    if (ns.status === "fulfilled") {
      ns.value.forEach(n =>
        dnsResults.push({ type: "NS", value: n })
      );
    }
  } catch {
    dnsResults.push({ error: "Falha ao resolver DNS" });
  }

  /* =========================
     2️⃣ TCP TEST (443)
  ========================= */
  const tcpTest = await new Promise(resolve => {
    const start = Date.now();
    const socket = net.createConnection(443, dominio);

    socket.setTimeout(5000);

    socket.on("connect", () => {
      socket.destroy();
      resolve({
        status: "online",
        port: 443,
        latency_ms: Date.now() - start
      });
    });

    socket.on("error", () => {
      socket.destroy();
      resolve({ status: "offline", port: 443 });
    });

    socket.on("timeout", () => {
      socket.destroy();
      resolve({ status: "timeout", port: 443 });
    });
  });

  /* =========================
     3️⃣ GLOBALPING (100% GRÁTIS)
  ========================= */
  let globalping: any = {};

  try {
    const create = await fetch("https://api.globalping.io/v1/measurements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "ping",
        target: dominio,
        limit: 15,
        locations: [
          { continent: "NA" },
          { continent: "SA" },
          { continent: "EU" },
          { continent: "AS" },
          { continent: "AF" }
        ]
      })
    });

    const created = await create.json();

    if (!created.id) {
      throw new Error("Erro ao criar medição");
    }

    const result = await fetch(
      `https://api.globalping.io/v1/measurements/${created.id}`
    );

    const data = await result.json();

    globalping = {
      measurement_id: created.id,
      probes: (data.results || []).map((r: any) => ({
        continente: r.probe.continent,
        pais: r.probe.country,
        cidade: r.probe.city,
        isp: r.probe.asn?.name || "Desconhecido",
        status: r.result?.status || "erro",
        rtt_ms: r.result?.rtt || null
      }))
    };
  } catch {
    globalping = { error: "Falha ao executar Globalping" };
  }

  /* =========================
     ✅ RESPOSTA FINAL
  ========================= */
  return res.status(200).json({
    dominio,
    status: "ok",
    origem: "vercel-serverless",
    dns: dnsResults,
    tcp: tcpTest,
    globalping,
    timestamp: new Date().toISOString()
  });
}
