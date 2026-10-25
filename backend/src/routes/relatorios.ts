import { Router } from "express";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { autenticar } from "../middleware/auth";
import { responderErro } from "../utils/http";

// GET /relatorios?de=2026-05-01&ate=2026-10-31
//
// Regras usadas nos numeros:
// - Receita de servico = OS concluidas ou entregues, pela data de conclusao.
// - Receita de venda   = vendas nao canceladas, pela data da venda.
// - Lucro              = receita - custo das pecas (preco de custo congelado).
// - Contagens de OS (status, oficina/campo, vendedor) = OS abertas no periodo.
// - A receber          = tudo que ja foi faturado e ainda esta "pendente" (sem filtro de data).

const router = Router();
router.use("/relatorios", autenticar);

const DATA = /^\d{4}-\d{2}-\d{2}$/;

// "2026-10-15" no horario local (toISOString usaria o horario de Greenwich)
function dataLocal(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function periodo(de: unknown, ate: unknown) {
  const hoje = new Date();
  const inicioPadrao = new Date(hoje.getFullYear(), hoje.getMonth() - 5, 1); // ultimos 6 meses
  const inicio = typeof de === "string" && DATA.test(de) ? de : dataLocal(inicioPadrao);
  const fim = typeof ate === "string" && DATA.test(ate) ? ate : dataLocal(hoje);
  return { inicio, fim };
}

async function linhas<T>(consulta: ReturnType<typeof sql>) {
  const r = await db.execute(consulta);
  return r.rows as T[];
}

router.get("/relatorios", async (req, res) => {
  try {
    const { inicio, fim } = periodo(req.query.de, req.query.ate);
    // Intervalo [inicio 00:00, fim + 1 dia)
    const de = sql`${inicio}::date`;
    const ate = sql`(${fim}::date + interval '1 day')`;

    // OS faturadas no periodo (concluidas/entregues)
    const osFaturadas = sql`
      select s.* from servico s join status_os st on st.id = s.status_id
      where st.fase in ('concluida','entregue')
        and coalesce(s.data_conclusao, s.data_abertura) >= ${de}
        and coalesce(s.data_conclusao, s.data_abertura) < ${ate}`;
    const vendasPeriodo = sql`
      select * from venda where status <> 'cancelada' and data >= ${de} and data < ${ate}`;

    const [resumo] = await linhas<Record<string, string | number>>(sql`
      with osf as (${osFaturadas}), vp as (${vendasPeriodo})
      select
        (select coalesce(sum(valor_total),0) from osf)::numeric(12,2) as "receitaServicos",
        (select coalesce(sum(valor_total),0) from vp)::numeric(12,2) as "receitaVendas",
        (select count(*) from osf)::int as "osFaturadas",
        (select count(*) from vp)::int as "vendas",
        (select coalesce(avg(valor_total),0) from osf)::numeric(12,2) as "ticketMedioOs",
        (select coalesce(avg(extract(epoch from (data_conclusao - data_abertura)) / 86400), 0)
           from osf where data_conclusao is not null)::numeric(6,1) as "tempoMedioDias",
        (
          (select coalesce(sum(si.quantidade * si.valor_custo),0) from servico_item si where si.servico_id in (select id from osf))
          + (select coalesce(sum(vi.quantidade * vi.valor_custo),0) from venda_item vi where vi.venda_id in (select id from vp))
        )::numeric(12,2) as "custo",
        (select count(*) from servico s join status_os st on st.id = s.status_id
           where st.fase in ('aberta','execucao'))::int as "osEmAberto",
        (
          (select coalesce(sum(s.valor_total),0) from servico s join status_os st on st.id = s.status_id
             where st.fase in ('concluida','entregue') and s.pagamento_status = 'pendente')
          + (select coalesce(sum(valor_total),0) from venda where status <> 'cancelada' and pagamento_status = 'pendente')
        )::numeric(12,2) as "aReceber"
    `);

    const porMes = await linhas(sql`
      with meses as (
        select to_char(m, 'YYYY-MM') as mes
        from generate_series(date_trunc('month', ${de}), date_trunc('month', ${fim}::date), interval '1 month') m
      ),
      osf as (${osFaturadas}), vp as (${vendasPeriodo})
      select meses.mes,
        coalesce((select sum(valor_total) from osf where to_char(coalesce(data_conclusao, data_abertura),'YYYY-MM') = meses.mes),0)::numeric(12,2) as "servicos",
        coalesce((select sum(valor_total) from vp where to_char(data,'YYYY-MM') = meses.mes),0)::numeric(12,2) as "vendas"
      from meses order by meses.mes`);

    const porStatus = await linhas(sql`
      select st.nome, st.cor, st.fase, count(s.id)::int as quantidade
      from status_os st
      left join servico s on s.status_id = st.id and s.data_abertura >= ${de} and s.data_abertura < ${ate}
      where st.ativo or s.id is not null
      group by st.id order by st.ordem, st.id`);

    const oficinaCampo = await linhas(sql`
      select tipo_atendimento as tipo, count(*)::int as quantidade
      from servico where data_abertura >= ${de} and data_abertura < ${ate}
      group by tipo_atendimento`);

    const topItens = await linhas(sql`
      with osf as (${osFaturadas}), vp as (${vendasPeriodo}),
      usados as (
        select item_id, quantidade, quantidade * valor_unitario as receita from servico_item where servico_id in (select id from osf)
        union all
        select item_id, quantidade, quantidade * valor_unitario from venda_item where venda_id in (select id from vp)
      )
      select i.nome, i.tipo, sum(u.quantidade)::int as quantidade, sum(u.receita)::numeric(12,2) as receita
      from usados u join item i on i.id = u.item_id
      group by i.id order by receita desc limit 8`);

    const porVendedor = await linhas(sql`
      with osf as (${osFaturadas}), vp as (${vendasPeriodo})
      select v.nome,
        (select count(*) from servico s where s.vendedor_id = v.id and s.data_abertura >= ${de} and s.data_abertura < ${ate})::int as "osAbertas",
        ((select coalesce(sum(valor_total),0) from osf where vendedor_id = v.id)
          + (select coalesce(sum(valor_total),0) from vp where vendedor_id = v.id))::numeric(12,2) as receita
      from vendedor v order by receita desc`);

    const formasPagamento = await linhas(sql`
      with osf as (${osFaturadas}), vp as (${vendasPeriodo})
      select forma_pagamento as forma, sum(valor_total)::numeric(12,2) as total from (
        select forma_pagamento, valor_total from osf where pagamento_status = 'pago'
        union all
        select forma_pagamento, valor_total from vp where pagamento_status = 'pago'
      ) t where forma_pagamento is not null group by forma_pagamento order by total desc`);

    const receitaTotal = Number(resumo.receitaServicos) + Number(resumo.receitaVendas);
    res.json({
      periodo: { de: inicio, ate: fim },
      resumo: {
        ...resumo,
        receitaTotal: receitaTotal.toFixed(2),
        lucro: (receitaTotal - Number(resumo.custo)).toFixed(2),
      },
      porMes,
      porStatus,
      oficinaCampo,
      topItens,
      porVendedor,
      formasPagamento,
    });
  } catch (err) {
    responderErro(res, err);
  }
});

export default router;
