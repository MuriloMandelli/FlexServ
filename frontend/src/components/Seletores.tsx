import { useEffect, useState } from "react";
import type { FocusEvent, KeyboardEvent, ReactNode } from "react";
import { api, mensagemDeErro } from "../api";
import { formatarCpfCnpj, formatarMoeda, formatarTelefone, ROTULO_TIPO_ITEM } from "../formatar";
import type { Cliente, Equipamento, Item, TipoEquipamento } from "../types";
import { Aviso, Botao, Campo, CampoSelecao } from "./ui";

// Busca na API conforme a pessoa digita (espera 300ms parar de digitar)
function useBusca<T>(caminho: string, termo: string, ativo = true) {
  const [resultado, setResultado] = useState<T[]>([]);
  useEffect(() => {
    if (!ativo) return;
    const espera = setTimeout(() => {
      const sep = caminho.includes("?") ? "&" : "?";
      api<T[]>(`${caminho}${termo.trim() ? `${sep}busca=${encodeURIComponent(termo.trim())}` : ""}`)
        .then(setResultado)
        .catch(() => setResultado([]));
    }, 300);
    return () => clearTimeout(espera);
  }, [caminho, termo, ativo]);
  return resultado;
}

// "Gaveta" da busca: fica fechada e abre (com animacao) quando a pessoa toca
// no campo. Mostra ate 3 resultados por vez (o resto rola), porque no uso
// normal a pessoa digita o nome e escolhe entre poucos resultados.
function useGaveta() {
  const [aberto, setAberto] = useState(false);
  return {
    aberto,
    fechar: () => setAberto(false),
    // Fecha quando o foco sai da busca e da lista (clique fora)
    props: {
      onFocus: () => setAberto(true),
      onBlur: (e: FocusEvent<HTMLDivElement>) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setAberto(false);
      },
      onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key === "Escape") setAberto(false);
      },
    },
  };
}

function Gaveta({ aberto, children }: { aberto: boolean; children: ReactNode }) {
  return (
    <div
      className={`grid transition-all duration-200 ease-out ${
        aberto ? "grid-rows-[1fr] opacity-100" : "pointer-events-none -mt-2 grid-rows-[0fr] opacity-0"
      }`}
      aria-hidden={!aberto}
    >
      <div className="flex min-h-0 flex-col gap-2 overflow-hidden">{children}</div>
    </div>
  );
}

// Altura de ~3 resultados
const listaGaveta = "max-h-[11.5rem] overflow-y-auto rounded-xl border border-borda";

const estiloBusca =
  "min-h-11 w-full rounded-xl border border-borda bg-fundo px-3 text-base outline-none placeholder:text-suave/60 focus:border-primaria";

// ---- Cliente: busca por nome/CPF e permite cadastrar na hora ----
export function SeletorCliente({
  aoEscolher,
  focoInicial = true,
}: {
  aoEscolher: (c: Cliente) => void;
  focoInicial?: boolean;
}) {
  const [termo, setTermo] = useState("");
  const [cadastrando, setCadastrando] = useState(false);
  const clientes = useBusca<Cliente>("/clientes", termo);
  const gaveta = useGaveta();

  // Cliente novo: cadastra aqui mesmo, sem sair da OS ou da venda
  if (cadastrando) {
    return <FormClienteRapido nomeInicial={termo.trim()} aoSalvar={aoEscolher} aoCancelar={() => setCadastrando(false)} />;
  }

  return (
    <div className="flex flex-col gap-2" {...gaveta.props}>
      <input
        type="search"
        autoFocus={focoInicial}
        value={termo}
        onChange={(e) => setTermo(e.target.value)}
        placeholder="Nome, CPF/CNPJ ou telefone"
        className={estiloBusca}
      />
      <Gaveta aberto={gaveta.aberto}>
      <ul className={listaGaveta}>
        {clientes.slice(0, 30).map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => aoEscolher(c)}
              className="flex min-h-12 w-full flex-col justify-center border-b border-borda px-3 py-2 text-left last:border-0 hover:bg-superficie-2"
            >
              <span className="font-medium">{c.nome}</span>
              <span className="text-xs text-suave">
                {[formatarCpfCnpj(c.cpfCnpj), c.telefone].filter(Boolean).join(" · ")}
              </span>
            </button>
          </li>
        ))}
        {clientes.length === 0 && <li className="px-3 py-3 text-sm text-suave">Nenhum cliente encontrado.</li>}
      </ul>
      <Botao type="button" variante="secundario" onClick={() => setCadastrando(true)}>
        + Cadastrar novo cliente
      </Botao>
      </Gaveta>
    </div>
  );
}

// ---- Cliente novo direto da OS/venda (sem <form>: fica dentro de outro formulario) ----
function FormClienteRapido({
  nomeInicial,
  aoSalvar,
  aoCancelar,
}: {
  nomeInicial: string;
  aoSalvar: (c: Cliente) => void;
  aoCancelar: () => void;
}) {
  const [dados, setDados] = useState({ nome: nomeInicial, cpfCnpj: "", telefone: "", endereco: "", cidade: "" });
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const alterar = (campo: keyof typeof dados, valor: string) => setDados({ ...dados, [campo]: valor });

  async function salvar() {
    setErro("");
    setSalvando(true);
    try {
      aoSalvar(await api<Cliente>("/clientes", "POST", dados));
    } catch (err) {
      setErro(mensagemDeErro(err));
      setSalvando(false);
    }
  }

  return (
    <div className="grid gap-3 rounded-xl border border-borda bg-fundo/50 p-3 sm:grid-cols-2">
      <p className="font-semibold sm:col-span-2">Novo cliente</p>
      <Campo rotulo="Nome *" className="sm:col-span-2" value={dados.nome} onChange={(e) => alterar("nome", e.target.value)} autoFocus />
      <Campo rotulo="CPF/CNPJ" inputMode="numeric" value={dados.cpfCnpj} onChange={(e) => alterar("cpfCnpj", e.target.value)} />
      <Campo
        rotulo="Telefone"
        type="tel"
        inputMode="tel"
        value={dados.telefone}
        onChange={(e) => alterar("telefone", formatarTelefone(e.target.value))}
        placeholder="(48) 99999-0000"
      />
      <Campo rotulo="Endereço" value={dados.endereco} onChange={(e) => alterar("endereco", e.target.value)} placeholder="Rua, número, bairro" />
      <Campo rotulo="Cidade" value={dados.cidade} onChange={(e) => alterar("cidade", e.target.value)} />
      {erro && (
        <div className="sm:col-span-2">
          <Aviso>{erro}</Aviso>
        </div>
      )}
      <div className="flex gap-2 sm:col-span-2 sm:justify-end">
        <Botao type="button" variante="secundario" onClick={aoCancelar} className="flex-1 sm:flex-none">
          Cancelar
        </Botao>
        <Botao type="button" onClick={salvar} disabled={salvando || !dados.nome.trim()} className="flex-1 sm:flex-none">
          {salvando ? "Salvando..." : "Salvar cliente"}
        </Botao>
      </div>
    </div>
  );
}

// ---- Item: busca pecas e mao de obra para adicionar na OS ----
export function SeletorItem({
  aoEscolher,
  focoInicial = true,
}: {
  aoEscolher: (i: Item) => void;
  focoInicial?: boolean;
}) {
  const [termo, setTermo] = useState("");
  const itens = useBusca<Item>("/itens", termo);
  const gaveta = useGaveta();

  // Escolheu: recolhe a gaveta e limpa a busca para o proximo item
  function escolher(i: Item) {
    aoEscolher(i);
    setTermo("");
    gaveta.fechar();
  }

  return (
    <div className="flex flex-col gap-2" {...gaveta.props}>
      <input
        type="search"
        autoFocus={focoInicial}
        value={termo}
        onChange={(e) => setTermo(e.target.value)}
        placeholder="Buscar item"
        className={estiloBusca}
      />
      <Gaveta aberto={gaveta.aberto}>
      <ul className={listaGaveta}>
        {itens.map((i) => (
          <li key={i.id}>
            <button
              type="button"
              onClick={() => escolher(i)}
              className="flex min-h-12 w-full items-center justify-between gap-3 border-b border-borda px-3 py-2 text-left last:border-0 hover:bg-superficie-2"
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">{i.nome}</span>
                <span className="text-xs text-suave">{ROTULO_TIPO_ITEM[i.tipo]}</span>
              </span>
              <span className="shrink-0 text-sm font-semibold">
                {i.valorVariavel ? <span className="font-normal text-suave">Valor variável</span> : formatarMoeda(i.valorUnitario)}
              </span>
            </button>
          </li>
        ))}
        {itens.length === 0 && <li className="px-3 py-3 text-sm text-suave">Nenhum item encontrado.</li>}
      </ul>
      </Gaveta>
    </div>
  );
}

// ---- Maquina: formulario curto para cadastrar uma maquina do cliente ----
export function FormMaquina({
  clienteId,
  aoSalvar,
  aoCancelar,
}: {
  clienteId: number;
  aoSalvar: (e: Equipamento) => void;
  aoCancelar?: () => void;
}) {
  const [tipo, setTipo] = useState<TipoEquipamento>("industrial");
  const [marca, setMarca] = useState("");
  const [modelo, setModelo] = useState("");
  const [numeroSerie, setNumeroSerie] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  // Nao usa <form> porque pode aparecer dentro de outro formulario
  async function salvar() {
    setErro("");
    setSalvando(true);
    try {
      aoSalvar(
        await api<Equipamento>(`/clientes/${clienteId}/equipamentos`, "POST", { tipo, marca, modelo, numeroSerie })
      );
    } catch (err) {
      setErro(mensagemDeErro(err));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="grid gap-3 rounded-xl border border-borda bg-fundo/50 p-3 sm:grid-cols-2">
      <CampoSelecao rotulo="Tipo *" value={tipo} onChange={(e) => setTipo(e.target.value as TipoEquipamento)}>
        <option value="industrial">Industrial</option>
        <option value="domestica">Doméstica</option>
      </CampoSelecao>
      <Campo rotulo="Marca *" value={marca} onChange={(e) => setMarca(e.target.value)} />
      <Campo rotulo="Modelo *" value={modelo} onChange={(e) => setModelo(e.target.value)} />
      <Campo rotulo="Nº de série" value={numeroSerie} onChange={(e) => setNumeroSerie(e.target.value)} />
      {erro && (
        <div className="sm:col-span-2">
          <Aviso>{erro}</Aviso>
        </div>
      )}
      <div className="flex gap-2 sm:col-span-2 sm:justify-end">
        {aoCancelar && (
          <Botao type="button" variante="secundario" onClick={aoCancelar} className="flex-1 sm:flex-none">
            Cancelar
          </Botao>
        )}
        <Botao type="button" onClick={salvar} disabled={salvando} className="flex-1 sm:flex-none">
          {salvando ? "Salvando..." : "Salvar máquina"}
        </Botao>
      </div>
    </div>
  );
}

// Controle de quantidade com botoes grandes (bom para o dedo no celular)
export function Quantidade({
  valor,
  aoMudar,
  desabilitado = false,
}: {
  valor: number;
  aoMudar: (n: number) => void;
  desabilitado?: boolean;
}) {
  const estilo =
    "flex h-10 w-10 items-center justify-center rounded-lg border border-borda text-lg hover:bg-superficie-2 disabled:opacity-40";
  return (
    <div className="flex items-center gap-1">
      <button type="button" className={estilo} disabled={desabilitado || valor <= 1} onClick={() => aoMudar(valor - 1)} aria-label="Diminuir">
        −
      </button>
      <span className="w-8 text-center font-semibold tabular-nums">{valor}</span>
      <button type="button" className={estilo} disabled={desabilitado} onClick={() => aoMudar(valor + 1)} aria-label="Aumentar">
        +
      </button>
    </div>
  );
}
