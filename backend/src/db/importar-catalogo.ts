import "dotenv/config";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { sql } from "drizzle-orm";
import { db } from "./index";
import { item } from "./schema";
import { lerCsv } from "./csv";
import type { Linha } from "./csv";

// Importa o catalogo real da TecFlex a partir da exportacao de produtos do
// Tiny ERP (CSV).
//   npm run db:importar-catalogo -- <arquivo.csv>
//       -> so CONFERE: mostra o que seria cadastrado e salva a lista em
//          catalogo-conferencia.csv, na pasta do CSV (nada e gravado no banco)
//   npm run db:importar-catalogo -- <arquivo.csv> --gravar
//       -> cadastra (itens com o mesmo nome ja cadastrados sao pulados)
//   npm run db:importar-catalogo -- <arquivo.csv> --gravar --limpar-demo
//       -> antes de cadastrar, APAGA os dados de demonstracao (OS, vendas,
//          avisos, clientes, maquinas de clientes e itens). Usuarios, lojas,
//          status e termos continuam.
//
// Regras combinadas com a TecFlex:
//   - produto sem preco de custo (ou sem margem) fica de fora
//   - maquinas: todas (inclui ferros, usadas e seminovas)
//   - pecas: so as basicas (lista PECAS_BASICAS abaixo)
//   - mao de obra: itens de valor variavel (o valor e informado em cada OS)

// Pecas basicas: o nome comeca com uma destas palavras
const PECAS_BASICAS = [
  "AGULHA",
  "CALCADOR",
  "LANÇADEIRA",
  "LOOPER",
  "BOBINA",
  "CAIXA DE BOBINA",
  "CHAPA",
  "DENTE",
  "IMPELENTE",
  "NAVALHA",
  "CORREIA",
  "TENSOR",
  "MOLA",
  "ÓLEO",
];

// Nao vem do Tiny: o preco e informado na hora de lancar na OS
const MAO_DE_OBRA: (typeof item.$inferInsert)[] = [
  { nome: "Mão de obra", tipo: "mao_de_obra", valorUnitario: "0", valorVariavel: true },
  { nome: "Visita técnica / deslocamento", tipo: "mao_de_obra", valorUnitario: "0", valorVariavel: true },
];

type Tipo = "maquina" | "peca";

// "1.234,56" -> 1234.56
const numero = (v: string) => Number(v.replace(/\./g, "").replace(",", ".")) || 0;

function classificar(l: Linha): Tipo | null {
  const nome = l["Descrição"].toUpperCase();
  const categoria = l["Categoria"];
  if (nome.startsWith("MÁQUINA") || nome.startsWith("MAQUINA") || nome.startsWith("FERRO ")) return "maquina";
  if (categoria === "MAQUINAS DE COSTURA" || categoria === "Ferro de Passar") return "maquina";
  if (PECAS_BASICAS.some((p) => nome.startsWith(p + " "))) return "peca";
  return null;
}

function montarCatalogo(linhas: Linha[]) {
  const vistos = new Set<string>();
  const catalogo: (typeof item.$inferInsert & { tipo: Tipo })[] = [];
  for (const l of linhas) {
    const tipo = classificar(l);
    if (!tipo || l["Situação"] !== "Ativo") continue;
    const preco = numero(l["Preço"]);
    const custo = numero(l["Preço de custo"]);
    if (custo <= 0 || preco <= custo) continue; // sem custo ou sem margem
    const nome = l["Descrição"].slice(0, 120);
    if (vistos.has(nome.toUpperCase())) continue;
    vistos.add(nome.toUpperCase());
    const detalhes = [l["Código (SKU)"] && `SKU ${l["Código (SKU)"]}`, l["Marca"]].filter(Boolean).join(" · ");
    catalogo.push({
      nome,
      tipo,
      descricao: detalhes || null,
      valorUnitario: preco.toFixed(2),
      valorCusto: custo.toFixed(2),
    });
  }
  return catalogo.sort((a, b) => a.tipo.localeCompare(b.tipo) || a.nome.localeCompare(b.nome));
}

async function importar() {
  const arquivo = process.argv.slice(2).find((a) => !a.startsWith("--"));
  if (!arquivo) throw new Error("Informe o arquivo CSV exportado do Tiny.");
  const gravar = process.argv.includes("--gravar");
  const limparDemo = process.argv.includes("--limpar-demo");

  const catalogo: (typeof item.$inferInsert)[] = [
    ...montarCatalogo(lerCsv(readFileSync(arquivo, "utf8").replace(/^\uFEFF/, ""))),
    ...MAO_DE_OBRA,
  ];
  const conta = (tipo: string) => catalogo.filter((i) => i.tipo === tipo).length;
  console.log(
    `${catalogo.length} itens: ${conta("maquina")} máquinas, ${conta("peca")} peças e ${conta("mao_de_obra")} de mão de obra.`
  );

  if (!gravar) {
    const csv = ["tipo;nome;preco;custo;detalhes"]
      .concat(catalogo.map((i) => [i.tipo, i.nome, i.valorUnitario, i.valorCusto ?? "0", i.descricao ?? ""].join(";")))
      .join("\n");
    const saida = join(dirname(arquivo), "catalogo-conferencia.csv");
    writeFileSync(saida, "\uFEFF" + csv);
    console.log(`Conferência salva em ${saida}. Nada foi gravado (use --gravar).`);
    return;
  }

  const inseridos = await db.transaction(async (tx) => {
    if (limparDemo) {
      // Ordem importa por causa das chaves estrangeiras
      await tx.execute(
        sql`TRUNCATE aviso_cliente, venda_item, venda, servico_item, servico, equipamento, item, cliente RESTART IDENTITY`
      );
    }
    const existentes = new Set((await tx.select({ nome: item.nome }).from(item)).map((i) => i.nome.toUpperCase()));
    const novos = catalogo.filter((i) => !existentes.has(i.nome.toUpperCase()));
    if (novos.length) await tx.insert(item).values(novos);
    return novos.length;
  });
  console.log(`${limparDemo ? "Dados de demonstração apagados. " : ""}${inseridos} itens cadastrados.`);
}

importar()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Erro ao importar:", err.message);
    process.exit(1);
  });
