import "dotenv/config";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { z } from "zod";
import { db } from "./index";
import { cliente } from "./schema";
import { lerCsv } from "./csv";
import type { Linha } from "./csv";

// Importa os clientes da TecFlex a partir da exportacao de contatos do
// Tiny ERP (CSV).
//   npm run db:importar-clientes -- <arquivo.csv>
//       -> so CONFERE: mostra o que seria cadastrado e salva a lista em
//          clientes-conferencia.csv, na pasta do CSV (nada e gravado no banco)
//   npm run db:importar-clientes -- <arquivo.csv> --gravar
//       -> cadastra (cliente com o mesmo CPF/CNPJ, ou mesmo nome quando nao
//          tem documento, ja cadastrado e pulado)
//
// Regras combinadas com a TecFlex:
//   - entram so os contatos do tipo "Cliente" (fornecedores, funcionarios e
//     contatos sem tipo ficam de fora)
//   - nome: o nome fantasia, quando existir (e como o balcao conhece o
//     cliente); senao, o nome/razao social
//   - telefone: celular (WhatsApp) ou, sem ele, o fixo; sem telefone o
//     cliente entra assim mesmo e o numero e completado depois

// Contatos genericos que nao sao clientes de verdade
const IGNORAR = /consumidor final|^fornecedores$|transporte|transportadora/i;

const digitos = (v: string) => v.replace(/\D/g, "");

// Na exportacao do Tiny a classificacao (Cliente/Fornecedor/Funcionario)
// vem na coluna do e-mail de nota fiscal; "Tipos de Contatos" tambem marca alguns
function ehCliente(l: Linha) {
  const colunaNf = Object.keys(l).find((k) => k.startsWith("E-mail para envio"));
  return (colunaNf && l[colunaNf] === "Cliente") || l["Tipos de Contatos"] === "Cliente";
}

// Telefone so com zeros, ou curto demais, nao conta
function telefoneValido(v: string) {
  const d = digitos(v);
  return d.length >= 10 && /[1-9]/.test(d) ? v : null;
}

function montarEndereco(l: Linha) {
  const numero = /^s\/?n$/i.test(l["Número"]) ? "S/N" : l["Número"];
  return [l["Endereço"], numero, l["Complemento"], l["Bairro"]].filter(Boolean).join(", ").slice(0, 255) || null;
}

function montarClientes(linhas: Linha[]) {
  const vistos = new Set<string>();
  const clientes: (typeof cliente.$inferInsert)[] = [];
  for (const l of linhas) {
    if (!ehCliente(l) || l["Situação"] !== "Ativo") continue;
    const nome = (l["Fantasia"] || l["Nome"]).replace(/\s+/g, " ").trim().slice(0, 120);
    if (!nome || IGNORAR.test(nome) || IGNORAR.test(l["Nome"])) continue;

    const doc = digitos(l["CNPJ / CPF"]);
    const cpfCnpj = doc.length === 11 || doc.length === 14 ? doc : null;
    const chave = cpfCnpj ?? nome.toUpperCase();
    if (vistos.has(chave)) continue;
    vistos.add(chave);

    const cep = digitos(l["CEP"]);
    const email = l["E-mail"].trim();
    clientes.push({
      nome,
      cpfCnpj,
      telefone: (telefoneValido(l["Celular"]) ?? telefoneValido(l["Fone"]))?.slice(0, 20) ?? null,
      email: email && z.string().email().safeParse(email).success ? email.slice(0, 160) : null,
      endereco: montarEndereco(l),
      cidade: [l["Cidade"], l["Estado"]].filter(Boolean).join("/").slice(0, 80) || null,
      cep: cep.length === 8 ? cep : null,
    });
  }
  return clientes.sort((a, b) => a.nome.localeCompare(b.nome));
}

async function importar() {
  const arquivo = process.argv.slice(2).find((a) => !a.startsWith("--"));
  if (!arquivo) throw new Error("Informe o arquivo CSV exportado do Tiny.");
  const gravar = process.argv.includes("--gravar");

  const clientes = montarClientes(lerCsv(readFileSync(arquivo, "utf8").replace(/^﻿/, "")));
  const comTelefone = clientes.filter((c) => c.telefone).length;
  console.log(`${clientes.length} clientes (${comTelefone} com telefone, ${clientes.length - comTelefone} sem).`);

  if (!gravar) {
    const csv = ["nome;cpf_cnpj;telefone;email;endereco;cidade;cep"]
      .concat(clientes.map((c) => [c.nome, c.cpfCnpj, c.telefone, c.email, c.endereco, c.cidade, c.cep].map((v) => v ?? "").join(";")))
      .join("\n");
    const saida = join(dirname(arquivo), "clientes-conferencia.csv");
    writeFileSync(saida, "﻿" + csv);
    console.log(`Conferência salva em ${saida}. Nada foi gravado (use --gravar).`);
    return;
  }

  const inseridos = await db.transaction(async (tx) => {
    const existentes = await tx.select({ nome: cliente.nome, cpfCnpj: cliente.cpfCnpj }).from(cliente);
    const docs = new Set(existentes.map((c) => c.cpfCnpj).filter(Boolean));
    const nomes = new Set(existentes.map((c) => c.nome.toUpperCase()));
    const novos = clientes.filter((c) => (c.cpfCnpj ? !docs.has(c.cpfCnpj) : !nomes.has(c.nome.toUpperCase())));
    if (novos.length) await tx.insert(cliente).values(novos);
    return novos.length;
  });
  console.log(`${inseridos} clientes cadastrados.`);
}

importar()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Erro ao importar:", err.message);
    process.exit(1);
  });
