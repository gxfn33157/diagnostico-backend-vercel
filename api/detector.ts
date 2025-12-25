import type { VercelRequest, VercelResponse } from "@vercel/node";

const GLOBALPING_API = "https://api.globalping.io/v1";

const CONTINENTES: Record<string, string> = {
  SA: "América do Sul",
  NA: "América do Norte",
  EU: "Europa",
  AS: "Ásia",
  AF: "África",
  OC: "Oceania"
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // ✅ CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const { dominio } = req.body;

    if (!dominio) {
      return res.status(400).json({ error: "Domínio não informado" });
    }

    // 1️⃣ Criar medição Globalping
    const create = await fetch(`${GLOBALPING_API}/measurements`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "ping",
        target: dominio,
        locations: [{ magic: "world" }],
        limit: 1
      })
    });

    const measurement = await create.json();
    const measurement_id = measurement.id;

    // 2️⃣ Aguardar processamento
    await new Promise(r => setTimeout(r, 4000));

    // 3️⃣ Buscar resultado
    const result = await fetch(
      `${GLOBALPING_API}/measurements/${measurement_id}`
    );
    const data = await result.json();

    // 4️⃣ Processar probes
    const continentes: Record<string, { ok: number; fail: number }> = {};
    let falhaInternacional = false;

    for (const probe of data.probes || []) {
      const code = probe.location?.continent;
      const nome = CONTINENTES[code] || "Desconhecido";

      if (!continentes[nome]) {
        continentes[nome] = { ok: 0, fail: 0 };
      }

      if (probe.result?.status === "ok") {
        continentes[nome].ok++;
      } else {
        continentes[nome].fail++;
        falhaInternacional = true;
      }
    }

    // 5️⃣ Status geral
    let status_geral = "OK";
    if (falhaInternacional && Object.keys(continentes).length > 1) {
      status_geral = "Instável";
    }
    if (
      Object.values(continentes).every(c => c.fail > 0)
    ) {
      status_geral = "Indisponível";
    }

    // 6️⃣ Texto técnico NOC
    const texto_noc = `
Diagnóstico de conectividade para ${dominio}

Status geral: ${status_geral}

Resumo por continente:
${Object.entries(continentes)
  .map(
    ([c, v]) =>
      `- ${c}: ${v.ok} OK / ${v.fail} falhas`
  )
  .join("\n")}

${
  falhaInternacional
    ? "Detectado possível problema de rota internacional."
    : "Não foram detectados problemas de rota internacional."
}
`.trim();

    // 7️⃣ Resposta final
    res.status(200).json({
      dominio,
      status_geral,
      problema_rota_internacional: falhaInternacional,
      continentes,
      texto_noc,
      globalping: {
        measurement_id
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao executar diagnóstico" });
  }
}
