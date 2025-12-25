import type { VercelRequest, VercelResponse } from "@vercel/node";

const GLOBALPING_TOKEN = process.env.GLOBALPING_TOKEN!;
const GLOBALPING_API = "https://api.globalping.io/v1";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ erro: "Método não permitido" });
    }

    const { dominio } = req.body;
    if (!dominio) {
      return res.status(400).json({ erro: "Domínio não informado" });
    }

    /* 1️⃣ CRIA MEDIÇÃO GLOBALPING */
    const createResp = await fetch(`${GLOBALPING_API}/measurements`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GLOBALPING_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "ping",
        target: dominio,
        locations: [{ magic: "world" }],
        limit: 1,
      }),
    });

    const createData = await createResp.json();
    const measurementId = createData.id;

    /* 2️⃣ AGUARDA CONCLUSÃO (até 30s) */
    let summary: any = null;
    let status = "in-progress";

    for (let i = 0; i < 15; i++) {
      await sleep(2000);

      const checkResp = await fetch(
        `${GLOBALPING_API}/measurements/${measurementId}`,
        {
          headers: { Authorization: `Bearer ${GLOBALPING_TOKEN}` },
        }
      );

      const checkData = await checkResp.json();
      status = checkData.status;

      if (status === "finished") {
        summary = checkData.results;
        break;
      }
    }

    if (!summary) {
      return res.json({
        dominio,
        status_geral: "Instável",
        problema_rota_internacional: false,
        continentes: {},
        texto_noc: "Medição Globalping ainda em processamento. Reexecute o teste.",
        globalping: { measurement_id: measurementId },
        timestamp: new Date().toISOString(),
      });
    }

    /* 3️⃣ AGRUPA POR CONTINENTE */
    const continentes: Record<string, any> = {};

    for (const r of summary) {
      const cont = r.location?.continent || "Desconhecido";

      if (!continentes[cont]) {
        continentes[cont] = {
          total: 0,
          ok: 0,
          falha: 0,
        };
      }

      continentes[cont].total++;

      if (r.result?.status === "finished") {
        continentes[cont].ok++;
      } else {
        continentes[cont].falha++;
      }
    }

    /* 4️⃣ CALCULA STATUS GERAL */
    let status_geral: "OK" | "Instável" | "Indisponível" = "OK";
    let continentes_com_falha = 0;

    for (const c of Object.values(continentes)) {
      if (c.falha > 0) continentes_com_falha++;
    }

    if (continentes_com_falha === 1) status_geral = "Instável";
    if (continentes_com_falha > 1) status_geral = "Indisponível";

    /* 5️⃣ DETECTA PROBLEMA DE ROTA INTERNACIONAL */
    const problema_rota_internacional =
      continentes["SA"] &&
      continentes["SA"].falha === 0 &&
      continentes_com_falha > 0;

    /* 6️⃣ TEXTO AUTOMÁTICO NOC */
    let texto_noc = `Diagnóstico de conectividade para ${dominio}\n\n`;
    texto_noc += `Status geral: ${status_geral}\n\nResumo por continente:\n`;

    for (const [c, v] of Object.entries(continentes)) {
      texto_noc += `- ${c}: ${v.ok}/${v.total} OK\n`;
    }

    if (problema_rota_internacional) {
      texto_noc +=
        "\nPossível problema de rota internacional detectado. Acesso local normal.";
    }

    /* 7️⃣ RESPOSTA FINAL */
    return res.json({
      dominio,
      status_geral,
      problema_rota_internacional,
      continentes,
      texto_noc,
      globalping: {
        target: dominio,
        status: "finished",
        summary,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    console.error(e);
    return res
      .status(500)
      .json({ erro: "Erro interno ao executar diagnóstico" });
  }
}
