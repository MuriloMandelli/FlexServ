import {
  pgTable,
  serial,
  text,
  varchar,
  integer,
  numeric,
  timestamp,
  date,
  boolean,
  pgEnum,
  unique,
} from "drizzle-orm/pg-core";

export const papelVendedorEnum = pgEnum("papel_vendedor", [
  "vendedor",
  "gestor",
]);

// Fases fixas do ciclo de vida da OS. Os status (nomes, cores) sao
// configuraveis pela empresa, mas cada status pertence a uma fase, e as
// regras do sistema (travar itens, datas, relatorios) olham a fase.
export const faseStatusEnum = pgEnum("fase_status", [
  "aberta", // aguardando aprovacao do cliente
  "execucao", // aprovada, em trabalho
  "concluida", // servico pronto, itens travados
  "entregue", // final: maquina devolvida ao cliente
  "cancelada", // final
]);

const dinheiro = (nome: string) => numeric(nome, { precision: 10, scale: 2 });

export const loja = pgTable("loja", {
  id: serial("id").primaryKey(),
  nome: varchar("nome", { length: 120 }).notNull(),
  endereco: text("endereco"),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
});

export const vendedor = pgTable("vendedor", {
  id: serial("id").primaryKey(),
  nome: varchar("nome", { length: 120 }).notNull(),
  email: varchar("email", { length: 160 }).notNull().unique(),
  senhaHash: varchar("senha_hash", { length: 255 }).notNull(),
  papel: papelVendedorEnum("papel").default("vendedor").notNull(),
  lojaId: integer("loja_id")
    .references(() => loja.id)
    .notNull(),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
});

export const cliente = pgTable("cliente", {
  id: serial("id").primaryKey(),
  nome: varchar("nome", { length: 120 }).notNull(),
  // CPF (pessoa fisica) ou CNPJ (confeccoes/empresas). Opcional, mas
  // unico quando preenchido. Guardado so com digitos.
  cpfCnpj: varchar("cpf_cnpj", { length: 14 }).unique(),
  telefone: varchar("telefone", { length: 20 }),
  email: varchar("email", { length: 160 }),
  endereco: text("endereco"),
  cidade: varchar("cidade", { length: 80 }),
  cep: varchar("cep", { length: 8 }),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
});

// Maquina de costura de um cliente. Um cliente pode ter varias, e cada
// OS e aberta para uma maquina (permite ver o historico de manutencao).
export const equipamento = pgTable("equipamento", {
  id: serial("id").primaryKey(),
  clienteId: integer("cliente_id")
    .references(() => cliente.id)
    .notNull(),
  tipo: varchar("tipo", { length: 20 }).notNull(), // "industrial" ou "domestica"
  marca: varchar("marca", { length: 60 }).notNull(),
  modelo: varchar("modelo", { length: 80 }).notNull(),
  numeroSerie: varchar("numero_serie", { length: 60 }),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
});

export const item = pgTable("item", {
  id: serial("id").primaryKey(),
  nome: varchar("nome", { length: 120 }).notNull(),
  tipo: varchar("tipo", { length: 20 }).notNull(), // "peca", "maquina" ou "mao_de_obra"
  descricao: text("descricao"),
  valorUnitario: dinheiro("valor_unitario").notNull(), // preco de venda
  valorCusto: dinheiro("valor_custo").default("0").notNull(), // para calcular lucro
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
});

// Status configuraveis da OS (tela "Gerenciar status")
export const statusOs = pgTable("status_os", {
  id: serial("id").primaryKey(),
  nome: varchar("nome", { length: 40 }).notNull().unique(),
  cor: varchar("cor", { length: 20 }).default("azul").notNull(),
  fase: faseStatusEnum("fase").notNull(),
  ordem: integer("ordem").default(0).notNull(),
  // Status que toda OS nova recebe (sempre da fase "aberta")
  padrao: boolean("padrao").default(false).notNull(),
  ativo: boolean("ativo").default(true).notNull(),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
});

export const servico = pgTable("servico", {
  id: serial("id").primaryKey(),
  clienteId: integer("cliente_id")
    .references(() => cliente.id)
    .notNull(),
  equipamentoId: integer("equipamento_id")
    .references(() => equipamento.id)
    .notNull(),
  vendedorId: integer("vendedor_id")
    .references(() => vendedor.id)
    .notNull(),
  lojaId: integer("loja_id")
    .references(() => loja.id)
    .notNull(),
  statusId: integer("status_id")
    .references(() => statusOs.id)
    .notNull(),

  // Onde o servico e feito: na oficina da TecFlex ou em campo (no cliente)
  tipoAtendimento: varchar("tipo_atendimento", { length: 10 }).default("oficina").notNull(),
  enderecoAtendimento: text("endereco_atendimento"),
  dataVisita: timestamp("data_visita"),

  // Dados do atendimento
  defeitoRelatado: text("defeito_relatado").notNull(),
  diagnostico: text("diagnostico"),
  servicoExecutado: text("servico_executado"),
  observacoes: text("observacoes"),
  garantiaDias: integer("garantia_dias"),

  // Valores: sempre recalculados pelo back-end (nunca vem prontos do front)
  valorItens: dinheiro("valor_itens").default("0").notNull(),
  desconto: dinheiro("desconto").default("0").notNull(),
  valorTotal: dinheiro("valor_total").default("0").notNull(),

  // Pagamento
  formaPagamento: varchar("forma_pagamento", { length: 20 }), // dinheiro, pix, debito, credito, boleto
  pagamentoStatus: varchar("pagamento_status", { length: 10 }).default("pendente").notNull(),
  dataPagamento: timestamp("data_pagamento"),

  // Aprovacao do cliente (assinaturas em imagem PNG, base64)
  aprovadoEm: timestamp("aprovado_em"),
  aprovadoPorNome: varchar("aprovado_por_nome", { length: 120 }),
  assinaturaCliente: text("assinatura_cliente"),
  assinaturaTecnico: text("assinatura_tecnico"),

  dataAbertura: timestamp("data_abertura").defaultNow().notNull(),
  previsaoEntrega: date("previsao_entrega"),
  dataConclusao: timestamp("data_conclusao"),
  dataEntrega: timestamp("data_entrega"),
});

export const servicoItem = pgTable(
  "servico_item",
  {
    id: serial("id").primaryKey(),
    servicoId: integer("servico_id")
      .references(() => servico.id)
      .notNull(),
    itemId: integer("item_id")
      .references(() => item.id)
      .notNull(),
    quantidade: integer("quantidade").default(1).notNull(),
    // Precos "congelados" no momento em que o item entrou na OS. Se o preco
    // do item mudar depois, as OS antigas continuam com o valor original.
    valorUnitario: dinheiro("valor_unitario").notNull(),
    valorCusto: dinheiro("valor_custo").default("0").notNull(),
  },
  // O mesmo item nao se repete na OS: adicionar de novo soma a quantidade
  (t) => [unique("servico_item_servico_item_unique").on(t.servicoId, t.itemId)]
);

// Venda de balcao (pecas e maquinas), separada das OS de servico
export const venda = pgTable("venda", {
  id: serial("id").primaryKey(),
  clienteId: integer("cliente_id").references(() => cliente.id), // vazio = consumidor final
  vendedorId: integer("vendedor_id")
    .references(() => vendedor.id)
    .notNull(),
  lojaId: integer("loja_id")
    .references(() => loja.id)
    .notNull(),
  status: varchar("status", { length: 12 }).default("concluida").notNull(), // concluida ou cancelada
  valorItens: dinheiro("valor_itens").default("0").notNull(),
  desconto: dinheiro("desconto").default("0").notNull(),
  valorTotal: dinheiro("valor_total").default("0").notNull(),
  formaPagamento: varchar("forma_pagamento", { length: 20 }),
  pagamentoStatus: varchar("pagamento_status", { length: 10 }).default("pendente").notNull(),
  dataPagamento: timestamp("data_pagamento"),
  observacoes: text("observacoes"),
  data: timestamp("data").defaultNow().notNull(),
});

export const vendaItem = pgTable(
  "venda_item",
  {
    id: serial("id").primaryKey(),
    vendaId: integer("venda_id")
      .references(() => venda.id)
      .notNull(),
    itemId: integer("item_id")
      .references(() => item.id)
      .notNull(),
    quantidade: integer("quantidade").default(1).notNull(),
    valorUnitario: dinheiro("valor_unitario").notNull(),
    valorCusto: dinheiro("valor_custo").default("0").notNull(),
  },
  (t) => [unique("venda_item_venda_item_unique").on(t.vendaId, t.itemId)]
);

// Registro de "ja avisei o cliente pelo WhatsApp" (OS ou venda)
export const avisoCliente = pgTable("aviso_cliente", {
  id: serial("id").primaryKey(),
  servicoId: integer("servico_id").references(() => servico.id),
  vendaId: integer("venda_id").references(() => venda.id),
  vendedorId: integer("vendedor_id")
    .references(() => vendedor.id)
    .notNull(),
  mensagem: text("mensagem").notNull(),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
});
