// api/detector.ts
export default function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  const { dominio } = req.body || {};
  if (!dominio) return res.status(400).json({ error: "Informe um domínio" });

  res.status(200).json({ dominio, status: "ok", info: "Diagnóstico simulado" });
}
