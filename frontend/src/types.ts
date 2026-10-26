// Tipos dos dados que a API devolve (espelham o schema do back-end).
// Valores "numeric" do Postgres chegam como texto ("85.90").

export type Papel = "vendedor" | "gestor";

export type Usuario = {
  id: number;
  nome: string;
  email: string;
  papel: Papel;
};

export type Cliente = {
  id: number;
  nome: string;
  cpfCnpj: string | null;
  telefone: string | null;
  email: string | null;
  endereco: string | null;
  cidade: string | null;
  cep: string | null;
  criadoEm: string;
};

export type Loja = {
  id: number;
  nome: string;
  endereco: string | null;
  criadoEm: string;
};

export type Vendedor = {
  id: number;
  nome: string;
  email: string;
  telefone: string | null;
  papel: Papel;
  lojaId: number;
  criadoEm: string;
};

export type TipoEquipamento = "industrial" | "domestica";

export type Equipamento = {
  id: number;
  clienteId: number;
  tipo: TipoEquipamento;
  marca: string;
  modelo: string;
  numeroSerie: string | null;
  criadoEm: string;
};

export type TipoItem = "peca" | "maquina" | "mao_de_obra";

export type Item = {
  id: number;
  nome: string;
  tipo: TipoItem;
  descricao: string | null;
  valorUnitario: string;
  valorCusto: string;
  valorVariavel: boolean;
  criadoEm: string;
};

// ---- Status configuraveis ----

export type Fase = "aberta" | "execucao" | "concluida" | "entregue" | "cancelada";
export type CorStatus = "azul" | "amarelo" | "laranja" | "verde" | "cinza" | "vermelho" | "roxo" | "rosa";

export type StatusResumo = { id: number; nome: string; cor: CorStatus; fase: Fase };

export type StatusOS = StatusResumo & {
  ordem: number;
  padrao: boolean;
  ativo: boolean;
  quantidadeOs: number;
};

// ---- Pagamento ----

export type FormaPagamento = "dinheiro" | "pix" | "debito" | "credito" | "boleto";
export type PagamentoStatus = "pendente" | "pago";
export type TipoAtendimento = "oficina" | "campo";

export type Aviso = { id: number; mensagem: string; criadoEm: string; vendedor: string };

export type ItemLancado = {
  id: number;
  itemId: number;
  nome: string;
  tipo: TipoItem;
  valorVariavel?: boolean;
  quantidade: number;
  valorUnitario: string;
  subtotal: string;
};

// ---- OS ----

export type OSResumo = {
  id: number;
  status: StatusResumo;
  tipoAtendimento: TipoAtendimento;
  valorTotal: string;
  pagamentoStatus: PagamentoStatus;
  aprovada: boolean;
  dataAbertura: string;
  previsaoEntrega: string | null;
  defeitoRelatado: string | null;
  clienteId: number;
  clienteNome: string;
  clienteTelefone: string | null;
  equipamentoId: number | null;
  equipamento: string | null;
  tecnicoNome: string | null;
};

export type OSDetalhe = {
  id: number;
  status: StatusResumo;
  tipoAtendimento: TipoAtendimento;
  enderecoAtendimento: string | null;
  dataVisita: string | null;
  defeitoRelatado: string | null;
  diagnostico: string | null;
  servicoExecutado: string | null;
  observacoes: string | null;
  garantiaDias: number | null;
  valorItens: string;
  desconto: string;
  valorTotal: string;
  formaPagamento: FormaPagamento | null;
  pagamentoStatus: PagamentoStatus;
  dataPagamento: string | null;
  // Aprovacao eletronica (aceite por link ou no sistema)
  termosAprovacao: string | null;
  tokenCliente: string | null;
  tokenTecnico: string | null;
  aceiteClienteEm: string | null;
  aceiteClienteNome: string | null;
  aceiteClienteIp: string | null;
  aceiteClienteDispositivo: string | null;
  aceiteTecnicoEm: string | null;
  aceiteTecnicoNome: string | null;
  aceiteTecnicoIp: string | null;
  aceiteTecnicoDispositivo: string | null;
  aceiteTecnicoMeio: "sistema" | "link" | null;
  aprovadoEm: string | null;
  aprovadoPorNome: string | null;
  dataAbertura: string;
  previsaoEntrega: string | null;
  dataConclusao: string | null;
  dataEntrega: string | null;
  cliente: {
    id: number;
    nome: string;
    telefone: string | null;
    cpfCnpj: string | null;
    endereco: string | null;
    cidade: string | null;
  };
  equipamento: Equipamento | null;
  vendedor: { id: number; nome: string };
  tecnico: { id: number; nome: string; telefone: string | null };
  itens: ItemLancado[];
  avisos: Aviso[];
  aprovada: boolean;
  itensEditaveis: boolean;
  finalizada: boolean;
};

// Pagina publica de aprovacao (link do WhatsApp)
export type AprovacaoPublica = {
  papel: "cliente" | "tecnico";
  os: {
    id: number;
    dataAbertura: string;
    tipoAtendimento: TipoAtendimento;
    defeitoRelatado: string | null;
    previsaoEntrega: string | null;
    garantiaDias: number | null;
    valorItens: string;
    desconto: string;
    valorTotal: string;
    itens: { nome: string; quantidade: number; valorUnitario: string; subtotal: string }[];
  };
  clienteNome: string;
  tecnicoNome: string;
  nomeSugerido: string;
  termos: string | null;
  aceite: { em: string; nome: string } | null;
  podeAssinar: boolean;
};

export type MembroEquipe = { id: number; nome: string };

// ---- Vendas ----

export type VendaResumo = {
  id: number;
  data: string;
  status: "concluida" | "cancelada";
  valorTotal: string;
  formaPagamento: FormaPagamento | null;
  pagamentoStatus: PagamentoStatus;
  clienteId: number | null;
  clienteNome: string;
  quantidadeItens: number;
  vendedorNome: string;
};

export type VendaDetalhe = {
  id: number;
  data: string;
  status: "concluida" | "cancelada";
  valorItens: string;
  desconto: string;
  valorTotal: string;
  formaPagamento: FormaPagamento | null;
  pagamentoStatus: PagamentoStatus;
  dataPagamento: string | null;
  observacoes: string | null;
  cliente: { id: number; nome: string; telefone: string | null; cpfCnpj: string | null } | null;
  vendedor: { id: number; nome: string };
  itens: ItemLancado[];
  avisos: Aviso[];
};

// ---- Relatorios ----

export type Relatorio = {
  periodo: { de: string; ate: string };
  resumo: {
    receitaServicos: string;
    receitaVendas: string;
    receitaTotal: string;
    custo: string;
    lucro: string;
    osFaturadas: number;
    vendas: number;
    ticketMedioOs: string;
    tempoMedioDias: string;
    osEmAberto: number;
    aReceber: string;
  };
  porMes: { mes: string; servicos: string; vendas: string }[];
  porStatus: { nome: string; cor: CorStatus; fase: Fase; quantidade: number }[];
  oficinaCampo: { tipo: TipoAtendimento; quantidade: number }[];
  topItens: { nome: string; tipo: TipoItem; quantidade: number; receita: string }[];
  porVendedor: { nome: string; osAbertas: number; receita: string }[];
  formasPagamento: { forma: FormaPagamento; total: string }[];
};
