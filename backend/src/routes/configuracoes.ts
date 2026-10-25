import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { configuracao } from "../db/schema";
import { apenasGestor, autenticar } from "../middleware/auth";
import { responderErro } from "../utils/http";
import { textoObrigatorio } from "../utils/validacao";
import { CHAVE_TERMOS, lerTermos, TERMOS_PADRAO } from "../services/aprovacao";

// Configuracoes da empresa. Por enquanto: os termos da aprovacao da OS.

const router = Router();
router.use("/configuracoes", autenticar);

// GET /configuracoes/termos -> texto atual e o padrao (para "restaurar")
router.get("/configuracoes/termos", async (_req, res) => {
  try {
    res.json({ texto: await lerTermos(), padrao: TERMOS_PADRAO });
  } catch (err) {
    responderErro(res, err);
  }
});

// PUT /configuracoes/termos { texto } -> so o gestor. Vale para as proximas
// aprovacoes; OS ja enviadas guardam o texto da epoca.
router.put("/configuracoes/termos", apenasGestor, async (req, res) => {
  try {
    const { texto } = z.object({ texto: textoObrigatorio("Texto dos termos", 10000) }).parse(req.body);
    await db
      .insert(configuracao)
      .values({ chave: CHAVE_TERMOS, valor: texto })
      .onConflictDoUpdate({ target: configuracao.chave, set: { valor: texto, atualizadoEm: new Date() } });
    res.json({ texto, padrao: TERMOS_PADRAO });
  } catch (err) {
    responderErro(res, err);
  }
});

export default router;
