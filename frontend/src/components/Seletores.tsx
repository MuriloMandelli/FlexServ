import { useEffect, useState } from "react";
import { api, mensagemDeErro } from "../api";
import { formatarCpfCnpj, formatarMoeda, ROTULO_TIPO_ITEM } from "../formatar";
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

const estiloBusca =
  "min-h-11 w-full rounded-xl border border-borda bg-fundo px-3 text-base outline-none placeholder:text-suave/60 focus:border-primaria";

// ---- Cliente: busca por nome/CPF e permite cadastrar na hora ----
export function SeletorCliente({ aoEscolher }: { aoEscolher: (c: Cliente) => void }) {
  const [termo, setTermo] = useState("");
  const [erro, setErro] = useState("");
  const clientes = useBusca<Cliente>("/clientes", termo);

  async function cadastrarRapido() {
    setErro("");
    try {
      aoEscolher(await api<Cliente>("/clientes", "POST", { nome: termo }));
    } catch (err) {
      setErro(mensagemDeErro(err));
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        type="search"
        autoFocus
        value={termo}
        onChange={(e) => setTermo(e.target.value)}
        placeholder="Buscar cliente por nome ou CPF/CNPJ"
        className={estiloBusca}
      />
      <ul className="max-h-64 overflow-y-auto rounded-xl border border-borda">
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
      {termo.trim().length >= 3 && (
        <Botao type="button" variante="secundario" onClick={cadastrarRapido}>
          + Cadastrar "{termo.trim()}" como novo cliente
        </Botao>
      )}
      {erro && <Aviso>{erro}</Aviso>}
    </div>
  );
}

// ---- Item: busca pecas e mao de obra para adicionar na OS ----
export function SeletorItem({ aoEscolher }: { aoEscolher: (i: Item) => void }) {
  const [termo, setTermo] = useState("");
  const itens = useBusca<Item>("/itens", termo);

  return (
    <div className="flex flex-col gap-2">
      <input
        type="search"
        autoFocus
        value={termo}
        onChange={(e) => setTermo(e.target.value)}
        placeholder="Buscar peça ou mão de obra"
        className={estiloBusca}
      />
      <ul className="max-h-72 overflow-y-auto rounded-xl border border-borda">
        {itens.map((i) => (
          <li key={i.id}>
            <button
              type="button"
              onClick={() => aoEscolher(i)}
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
      <Campo rotulo="Marca *" value={marca} onChange={(e) => setMarca(e.target.value)} placeholder="Ex.: Juki" />
      <Campo rotulo="Modelo *" value={modelo} onChange={(e) => setModelo(e.target.value)} placeholder="Ex.: DDL-8700" />
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
