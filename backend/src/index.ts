import "dotenv/config";
import express from "express";
import { db } from "./db";
import { loja } from "./db/schema";
import authRouter from "./routes/auth";
import clientesRouter from "./routes/clientes";
import lojasRouter from "./routes/lojas";
import vendedoresRouter from "./routes/vendedores";
import itensRouter from "./routes/itens";
import equipamentosRouter from "./routes/equipamentos";
import osRouter from "./routes/os";
import statusRouter from "./routes/status";
import vendasRouter from "./routes/vendas";
import relatoriosRouter from "./routes/relatorios";
import aprovacaoRouter from "./routes/aprovacao";
import configuracoesRouter from "./routes/configuracoes";

const app = express();
app.use(express.json());
app.use(authRouter);
app.use(clientesRouter);
app.use(lojasRouter);
app.use(vendedoresRouter);
app.use(itensRouter);
app.use(equipamentosRouter);
app.use(osRouter);
app.use(statusRouter);
app.use(vendasRouter);
app.use(relatoriosRouter);
app.use(configuracoesRouter);
// Publica (sem login): pagina de aprovacao da OS aberta pelo link do WhatsApp
app.use(aprovacaoRouter);

// Rota simples pra confirmar que a API sobe e que a conexao com o
// banco (Neon) esta funcionando. Serve tambem pra tirar o print
// de evidencia no relatorio.
app.get("/health", async (_req, res) => {
  try {
    const lojas = await db.select().from(loja);
    res.json({ status: "ok", lojasCadastradas: lojas.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: "erro", detalhe: String(err) });
  }
});

// No computador, sobe o servidor na porta do .env.
// Na Vercel (variavel VERCEL definida por ela), quem cuida do servidor e a
// propria Vercel: o app so precisa ser exportado.
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`FlexServ API rodando em http://localhost:${PORT}`);
  });
}

export default app;
