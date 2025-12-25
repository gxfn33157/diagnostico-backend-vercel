import type { VercelRequest, VercelResponse } from "@vercel/node";

const GLOBALPING_API = "https://api.globalping.io/v1";

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 🔓 CORS (resolve erro do frontend)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ erro: "Método não permitido" });
  }

  try {
    const { dominio } = req.body;

    if (!dominio) {
      return res.status(400).json({ erro: "Domínio não informado" });
    }

    // 1️⃣ Dispara medição Globalping
    const startResp = await fetch(`${GLOBALPING_API}/measurements`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "diagnostico-vercel"
      },
      body: JSON.stringify({
        type: "ping",
        target: dominio,
        limit: 50
      })
    });

    const startData = await startResp.json();
    const measurementId = startData.id;

    // 2️⃣ Aguarda até 30s a medição finalizar
    let summaryData: any = null;
    let finished = false;

    for (let i = 0; i < 10; i++) {
      await sleep(3000); // 3s x 10 = 30s

      const summaryResp = await fetch(
        `${GLOBALPING_API}/measurements/${measurementId}/summary`
      );

      const data = await summaryResp.json();

      if (data.status === "finished") {
        summaryData = data;
        finished = true;
        break;
      }
    }

    // 3️⃣ Se não finalizou → retorna Instável
    if (!finished || !summaryData?.summary) {
      return res.json({
        dominio,
        status_geral: "Instável",
        problema_rota_internacional: false,
        continentes: {},
        texto_noc: "Medição Globalping ainda em processamento. Reexecute o teste.",
        globalping: { measurement_id: measurementId },
        timestamp: new Date().toISOString()
      });
    }

    // 4️⃣ Processa por continente
    const continentes: Record<string, { ok: number; falha: number }> = {};

    for (const item of summaryData.summary) {
      const continente = item.continent || "Desconhecido";
      if (!continentes[continente]) {
        continentes[continente] = { ok: 0, falha: 0 };
      }

      if (item.success) {
        continentes[continente].ok++;
      } else {
        continentes[continente].falha++;
      }
    }

    // 5️⃣ Define status geral
    let status_geral = "Disponível";
    let problema_rota_internacional = false;

    for (const c of Object.values(continentes)) {
      if (c.falha > c.ok) {
        status_geral = "Indisponível";
        problema_rota_internacional = true;
        break;
      }
      if (c.falha > 0) {
        status_geral = "Instável";
      }
    }

    // 6️⃣ Texto para NOC
    let texto_noc = `Diagnóstico de conectividade para ${dominio}\n\n`;
    texto_noc += `Status geral: ${status_geral}\n\nResumo por continente:\n`;

    for (const [cont, dados] of Object.entries(continentes)) {
      texto_noc += `- ${cont}: ${dados.ok} OK / ${dados.falha} Falhas\n`;
    }

    if (problema_rota_internacional) {
      texto_noc += `\n⚠️ Indícios de problema de rota internacional.`;
    } else {
      texto_noc += `\nNenhum problema crítico de rota internacional detectado.`;
    }

    // 7️⃣ Resposta final
    return res.json({
      dominio,
      status_geral,
      problema_rota_internacional,
      continentes,
      texto_noc,
      globalping: {
        measurement_id: measurementId
      },
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error("Erro detector:", err);
    return res.status(500).json({
      erro: "Erro interno ao executar diagnóstico"
    });
  }
}
