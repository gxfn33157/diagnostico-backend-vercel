import type { VercelRequest, VercelResponse } from "vercel";
import dns from "dns/promises";
import net from "net";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  const { dominio } = req.body;

  if (!dominio) {
    return res.status(400).json({ error: "Domínio não informado" });
  }

  /* =========================
     1️⃣ DNS LOCAL (Node)
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
  } catch (e) {
    dnsResults.push({ error: "Falha ao resolver DNS local" });
  }

  /* =========================
     2️⃣ TCP TEST (443)
  ========================= */
  const tcpTest = await new Promise(resolve => {
    const start = Date.now();
    const socket = net.createConnection(443, dominio);

    socket.setTimeout(5000);

    socket.on("connect", () => {
      const latency = Date.now() - start;
      socket.destroy();
      resolve({ status: "online", port: 443, latency_ms: latency });
    });

    socket.on("error", () => {
      resolve({ status: "offline", port: 443 });
    });

    socket.on("timeout", () => {
      socket.destroy();
      resolve({ status: "timeout", port: 443 });
    });
  });

  /* =========================
     3️⃣ GLOBALPING (GRÁTIS)
  ========================= */
  let globalping: any = {};

  try
