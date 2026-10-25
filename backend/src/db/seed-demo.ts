import "dotenv/config";
import { eq, sql } from "drizzle-orm";
import { db } from "./index";
import {
  avisoCliente,
  cliente,
  equipamento,
  item,
  servico,
  servicoItem,
  statusOs,
  venda,
  vendaItem,
  vendedor,
} from "./schema";
import { recalcularTotal } from "../services/os";
import { TERMOS_PADRAO } from "../services/aprovacao";

// Dados FICTICIOS para demonstracao e testes.
//   npm run db:seed-demo            -> so cria se ainda nao houver itens
//   npm run db:seed-demo -- --recriar -> APAGA OS, vendas, itens, maquinas e
//                                       clientes e cria tudo de novo
// Rode antes o npm run db:seed (loja e usuario de teste).

const STATUS_PADRAO = [
  { nome: "Aberto", cor: "azul", fase: "aberta", ordem: 1, padrao: true },
  { nome: "Em andamento", cor: "amarelo", fase: "execucao", ordem: 2, padrao: false },
  { nome: "Aguardando peça", cor: "laranja", fase: "execucao", ordem: 3, padrao: false },
  { nome: "Concluído", cor: "verde", fase: "concluida", ordem: 4, padrao: false },
  { nome: "Entregue", cor: "cinza", fase: "entregue", ordem: 5, padrao: false },
  { nome: "Cancelado", cor: "vermelho", fase: "cancelada", ordem: 6, padrao: false },
] as const;

const ITENS = [
  { nome: "Agulha DBx1 (pacote com 10)", tipo: "peca", valorUnitario: "18.00", valorCusto: "7.50" },
  { nome: "Lançadeira industrial", tipo: "peca", valorUnitario: "85.90", valorCusto: "42.00" },
  { nome: "Caixa de bobina", tipo: "peca", valorUnitario: "32.00", valorCusto: "14.00" },
  { nome: "Bobina", tipo: "peca", valorUnitario: "4.50", valorCusto: "1.60" },
  { nome: "Calcador", tipo: "peca", valorUnitario: "45.00", valorCusto: "19.00" },
  { nome: "Dente impelente", tipo: "peca", valorUnitario: "55.00", valorCusto: "24.00" },
  { nome: "Correia", tipo: "peca", valorUnitario: "28.00", valorCusto: "11.00" },
  { nome: "Motor servo 550W", tipo: "peca", valorUnitario: "650.00", valorCusto: "390.00" },
  { nome: "Óleo para máquina de costura 1L", tipo: "peca", valorUnitario: "39.90", valorCusto: "17.00" },
  { nome: "Máquina reta industrial Juki DDL-8700", tipo: "maquina", valorUnitario: "3890.00", valorCusto: "2950.00" },
  { nome: "Máquina doméstica Singer Facilita Pro", tipo: "maquina", valorUnitario: "1290.00", valorCusto: "930.00" },
  { nome: "Revisão completa", tipo: "mao_de_obra", valorUnitario: "120.00", valorCusto: "0" },
  { nome: "Regulagem de ponto", tipo: "mao_de_obra", valorUnitario: "60.00", valorCusto: "0" },
  { nome: "Limpeza e lubrificação", tipo: "mao_de_obra", valorUnitario: "50.00", valorCusto: "0" },
  { nome: "Troca de motor", tipo: "mao_de_obra", valorUnitario: "90.00", valorCusto: "0" },
  { nome: "Visita técnica", tipo: "mao_de_obra", valorUnitario: "80.00", valorCusto: "0" },
] as const;

const CLIENTES = [
  {
    nome: "Confecções Rio Maina Ltda",
    telefone: "(48) 3400-1122",
    endereco: "Rua das Indústrias, 450 - Rio Maina",
    cidade: "Criciúma",
    maquinas: [
      { tipo: "industrial", marca: "Juki", modelo: "DDL-8700", numeroSerie: "JK870-0001" },
      { tipo: "industrial", marca: "Siruba", modelo: "747K", numeroSerie: "SR747-0102" },
    ],
  },
  {
    nome: "Uniformes Içara",
    telefone: "(48) 3432-5566",
    endereco: "Av. Brasil, 1200 - Centro",
    cidade: "Içara",
    maquinas: [{ tipo: "industrial", marca: "Brother", modelo: "S-7100A", numeroSerie: null }],
  },
  {
    nome: "Maria Aparecida Souza",
    telefone: "(48) 99911-2233",
    endereco: "Rua São José, 87 - Pinheirinho",
    cidade: "Criciúma",
    maquinas: [{ tipo: "domestica", marca: "Singer", modelo: "Facilita Pro", numeroSerie: null }],
  },
  {
    nome: "Malharia Próspera",
    telefone: "(48) 3438-7788",
    endereco: "Rodovia SC-445, km 3 - Próspera",
    cidade: "Criciúma",
    maquinas: [
      { tipo: "industrial", marca: "Yamata", modelo: "FY5550", numeroSerie: "YM-5550-77" },
      { tipo: "industrial", marca: "Juki", modelo: "MO-6814S", numeroSerie: "JK6814-12" },
    ],
  },
] as const;

type NomeStatus = (typeof STATUS_PADRAO)[number]["nome"];

// [cliente, maquina, dias atras, status, oficina/campo, pago?, forma, desconto, defeito, itens [indice, qtd]]
const ORDENS: [number, number, number, NomeStatus, "oficina" | "campo", boolean, string | null, string, string, [number, number][]][] = [
  [0, 0, 160, "Entregue", "oficina", true, "pix", "0", "Pulando ponto em tecido grosso.", [[1, 1], [12, 1]]],
  [3, 0, 140, "Entregue", "campo", true, "boleto", "20", "Três máquinas da linha com ponto irregular.", [[4, 2], [12, 3], [15, 1]]],
  [2, 0, 120, "Entregue", "oficina", true, "dinheiro", "0", "Linha enrolando embaixo do tecido.", [[3, 2], [13, 1]]],
  [1, 0, 100, "Entregue", "oficina", true, "credito", "0", "Motor fraco, perdendo força.", [[7, 1], [14, 1]]],
  [0, 1, 85, "Entregue", "campo", true, "pix", "15", "Overloque cortando irregular.", [[4, 1], [11, 1], [15, 1]]],
  [3, 1, 70, "Entregue", "oficina", true, "debito", "0", "Correia arrebentada.", [[6, 1], [13, 1]]],
  [2, 0, 55, "Cancelado", "oficina", false, null, "0", "Cliente desistiu do conserto.", [[11, 1]]],
  [0, 0, 40, "Entregue", "oficina", false, null, "0", "Revisão preventiva.", [[11, 1], [8, 1]]],
  [1, 0, 28, "Concluído", "campo", false, null, "0", "Máquina travando no início da costura.", [[5, 1], [12, 1], [15, 1]]],
  [3, 0, 18, "Concluído", "oficina", true, "pix", "0", "Agulha quebrando com frequência.", [[0, 2], [12, 1]]],
  [0, 1, 9, "Aguardando peça", "oficina", false, null, "0", "Motor fazendo barulho e esquentando.", [[7, 1], [14, 1]]],
  [2, 0, 6, "Em andamento", "oficina", false, null, "0", "Costura frouxa e linha arrebentando.", [[12, 1], [3, 3]]],
  [3, 1, 3, "Aberto", "campo", false, null, "0", "Pedido de revisão geral da linha de produção.", [[11, 2], [15, 1]]],
  [1, 0, 1, "Aberto", "oficina", false, null, "0", "Máquina não liga.", []],
];

// [cliente (null = consumidor final), dias atras, pago?, forma, desconto, itens [indice, qtd]]
const VENDAS: [number | null, number, boolean, string, string, [number, number][]][] = [
  [null, 150, true, "dinheiro", "0", [[0, 3], [3, 10]]],
  [3, 130, true, "boleto", "200", [[9, 1]]],
  [2, 110, true, "credito", "0", [[10, 1]]],
  [null, 90, true, "pix", "0", [[8, 2], [0, 2]]],
  [0, 75, true, "pix", "0", [[1, 2], [2, 2]]],
  [null, 60, true, "debito", "0", [[0, 5]]],
  [1, 45, false, "boleto", "0", [[6, 3], [4, 2]]],
  [null, 30, true, "pix", "0", [[8, 1], [3, 6]]],
  [3, 14, true, "pix", "150", [[9, 1], [8, 2]]],
  [null, 4, true, "dinheiro", "0", [[0, 1], [3, 4]]],
  [2, 2, false, "pix", "0", [[8, 1]]],
];

const DIA = 24 * 60 * 60 * 1000;

async function garantirStatus() {
  const [existe] = await db.select({ id: statusOs.id }).from(statusOs).limit(1);
  if (!existe) await db.insert(statusOs).values(STATUS_PADRAO.map((s) => ({ ...s })));
  const lista = await db.select().from(statusOs);
  return new Map(lista.map((s) => [s.nome, s]));
}

async function apagarDemonstracao() {
  // Ordem importa por causa das chaves estrangeiras
  await db.execute(
    sql`TRUNCATE aviso_cliente, venda_item, venda, servico_item, servico, equipamento, item, cliente RESTART IDENTITY`
  );
}

async function seedDemo() {
  const recriar = process.argv.includes("--recriar");
  const status = await garantirStatus();

  if (recriar) {
    await apagarDemonstracao();
  } else {
    const [jaTem] = await db.select({ id: item.id }).from(item).limit(1);
    if (jaTem) {
      console.log("Já existem itens cadastrados. Use --recriar para apagar e criar de novo.");
      process.exit(0);
    }
  }

  const [responsavel] = await db.select().from(vendedor).where(eq(vendedor.email, "vendedor@tecflex.com"));
  if (!responsavel) throw new Error("Rode antes o npm run db:seed (vendedor de teste).");

  const itens = await db.insert(item).values(ITENS.map((i) => ({ ...i }))).returning();

  const clienteIds: number[] = [];
  const maquinasPorCliente: number[][] = [];
  for (const c of CLIENTES) {
    const { maquinas, ...dados } = c;
    const [novo] = await db.insert(cliente).values(dados).returning();
    clienteIds.push(novo.id);
    const criadas = await db
      .insert(equipamento)
      .values(maquinas.map((m) => ({ ...m, clienteId: novo.id })))
      .returning();
    maquinasPorCliente.push(criadas.map((m) => m.id));
  }

  for (const [ci, mi, diasAtras, nomeStatus, tipo, pago, forma, desconto, defeito, linhas] of ORDENS) {
    const st = status.get(nomeStatus)!;
    const abertura = new Date(Date.now() - diasAtras * DIA);
    const passouDaAbertura = st.fase !== "aberta";
    const concluida = st.fase === "concluida" || st.fase === "entregue";
    const conclusao = concluida ? new Date(abertura.getTime() + 3 * DIA) : null;

    const aprovada = passouDaAbertura && st.fase !== "cancelada";
    const [os] = await db
      .insert(servico)
      .values({
        clienteId: clienteIds[ci],
        // Algumas OS com maquina definida, outras gerais (sem maquina)
        equipamentoId: diasAtras % 2 === 0 ? maquinasPorCliente[ci][mi] : null,
        vendedorId: responsavel.id,
        tecnicoId: responsavel.id,
        lojaId: responsavel.lojaId,
        statusId: st.id,
        tipoAtendimento: tipo,
        enderecoAtendimento: tipo === "campo" ? CLIENTES[ci].endereco : null,
        dataVisita: tipo === "campo" ? new Date(abertura.getTime() + DIA) : null,
        defeitoRelatado: defeito,
        diagnostico: passouDaAbertura ? "Peça desgastada pelo uso." : null,
        servicoExecutado: concluida ? "Troca da peça e regulagem geral." : null,
        garantiaDias: concluida ? 90 : null,
        desconto,
        formaPagamento: forma,
        pagamentoStatus: pago ? "pago" : "pendente",
        dataPagamento: pago && conclusao ? conclusao : null,
        // OS que ja passaram da abertura foram aprovadas (aceite do cliente e do tecnico)
        termosAprovacao: aprovada ? TERMOS_PADRAO : null,
        aceiteClienteEm: aprovada ? abertura : null,
        aceiteClienteNome: aprovada ? CLIENTES[ci].nome : null,
        aceiteTecnicoEm: aprovada ? abertura : null,
        aceiteTecnicoNome: aprovada ? responsavel.nome : null,
        aceiteTecnicoMeio: aprovada ? "sistema" : null,
        aprovadoEm: aprovada ? abertura : null,
        aprovadoPorNome: aprovada ? CLIENTES[ci].nome : null,
        dataAbertura: abertura,
        dataConclusao: conclusao,
        dataEntrega: st.fase === "entregue" ? new Date(abertura.getTime() + 4 * DIA) : null,
      })
      .returning();

    if (linhas.length) {
      await db.insert(servicoItem).values(
        linhas.map(([ii, quantidade]) => ({
          servicoId: os.id,
          itemId: itens[ii].id,
          quantidade,
          valorUnitario: itens[ii].valorUnitario,
          valorCusto: itens[ii].valorCusto,
        }))
      );
    }
    await recalcularTotal(db, os.id);

    if (concluida) {
      await db.insert(avisoCliente).values({
        servicoId: os.id,
        vendedorId: responsavel.id,
        mensagem: `Olá! Sua máquina da OS #${os.id} está pronta para retirada.`,
        criadoEm: conclusao!,
      });
    }
  }

  for (const [ci, diasAtras, pago, forma, desconto, linhas] of VENDAS) {
    const data = new Date(Date.now() - diasAtras * DIA);
    const [v] = await db
      .insert(venda)
      .values({
        clienteId: ci === null ? null : clienteIds[ci],
        vendedorId: responsavel.id,
        lojaId: responsavel.lojaId,
        desconto,
        formaPagamento: forma,
        pagamentoStatus: pago ? "pago" : "pendente",
        dataPagamento: pago ? data : null,
        data,
      })
      .returning();
    await db.insert(vendaItem).values(
      linhas.map(([ii, quantidade]) => ({
        vendaId: v.id,
        itemId: itens[ii].id,
        quantidade,
        valorUnitario: itens[ii].valorUnitario,
        valorCusto: itens[ii].valorCusto,
      }))
    );
    const soma = sql`(select coalesce(sum(${vendaItem.quantidade} * ${vendaItem.valorUnitario}), 0) from ${vendaItem} where ${vendaItem.vendaId} = ${v.id})`;
    await db
      .update(venda)
      .set({ valorItens: soma, valorTotal: sql`greatest(${soma} - ${venda.desconto}, 0)` })
      .where(eq(venda.id, v.id));
  }

  console.log(
    `Seed de demonstração concluído: ${itens.length} itens, ${CLIENTES.length} clientes, ${ORDENS.length} OS, ${VENDAS.length} vendas.`
  );
  process.exit(0);
}

seedDemo().catch((err) => {
  console.error(err);
  process.exit(1);
});
