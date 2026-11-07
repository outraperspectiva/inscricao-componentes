import { db, cicloAtual, CICLO_PADRAO } from "../lib/db.js";

// GET /api/ciclo  → { ciclo: "27.1" }
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    const sql = await db();
    return res.status(200).json({ ciclo: await cicloAtual(sql) });
  } catch (err) {
    console.error(err);
    return res.status(200).json({ ciclo: CICLO_PADRAO });
  }
}
