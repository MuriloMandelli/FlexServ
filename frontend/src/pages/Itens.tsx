import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, mensagemDeErro } from "../api";
import { useAuth } from "../auth";
import { formatarMoeda, ROTULO_TIPO_ITEM, dataLocalISO } from "../formatar";
import type { Item, TipoItem } from "../types";
import { Tabela } from "../components/Tabela";
import type { Coluna } from "../components/Tabela";
import { Icone } from "../components/Icones";
import { Aviso, Botao, Busca, CabecalhoPagina, Carregando, Filtros, Vazio } from "../components/ui";

type FiltroTipo = TipoItem | "todos";

const margem = (i: Item) =>
  Number(i.valorCusto) > 0 && Number(i.valorUnitario) > 0
    ? ((Number(i.valorUnitario) - Number(i.valorCusto)) / Number(i.valorUnitario)) * 100
    : null;

export default function Itens() {
  const navegar = useNavigate();
  const gestor = useAuth().usuario?.papel === "gestor";
  const [busca, setBusca] = useState("");
  const [tipo, setTipo] = useState<FiltroTipo>("todos");
  const [itens, setItens] = useState<Item[] | null>(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    const espera = setTimeout(() => {
      const query = new URLSearchParams();
      if (busca.trim()) query.set("busca", busca.trim());
      if (tipo !== "todos") query.set("tipo", tipo);
      api<Item[]>(`/itens?${query}`)
        .then((r) => {
          setItens(r);
          setErro("");
        })
        .catch((err) => setErro(mensagemDeErro(err)));
    }, 250);
    return () => clearTimeout(espera);
  }, [busca, tipo]);

  // Custo e margem so aparecem para o gestor
  const colunas: Coluna<Item>[] = [
    { titulo: "Nome", valor: (i) => i.nome, exibir: (i) => <span className="font-medium">{i.nome}</span> },
    { titulo: "Tipo", valor: (i) => ROTULO_TIPO_ITEM[i.tipo], exibir: (i) => <span className="text-suave">{ROTULO_TIPO_ITEM[i.tipo]}</span> },
    {
      titulo: "Preço",
      valor: (i) => Number(i.valorUnitario),
      exibir: (i) => (i.valorVariavel ? <span className="text-suave">Variável</span> : formatarMoeda(i.valorUnitario)),
      pdf: (i) => (i.valorVariavel ? "Variável" : formatarMoeda(i.valorUnitario)),
      direita: true,
    },
    ...(gestor
      ? ([
          {
            titulo: "Custo",
            valor: (i) => Number(i.valorCusto),
            exibir: (i) => <span className="text-suave">{Number(i.valorCusto) ? formatarMoeda(i.valorCusto) : "-"}</span>,
            pdf: (i) => (Number(i.valorCusto) ? formatarMoeda(i.valorCusto) : "-"),
            direita: true,
          },
          {
            titulo: "Margem",
            valor: (i) => margem(i),
            exibir: (i) => <span className="text-suave">{margem(i) === null ? "-" : `${margem(i)!.toFixed(0)}%`}</span>,
            pdf: (i) => (margem(i) === null ? "-" : `${margem(i)!.toFixed(0)}%`),
            direita: true,
          },
        ] as Coluna<Item>[])
      : []),
  ];

  return (
    <div>
      <CabecalhoPagina
        titulo="Peças e serviços"
        subtitulo="Catálogo de peças, máquinas e mão de obra"
        acao={
          gestor && (
            <Botao onClick={() => navegar("/itens/novo")}>
              <Icone.mais_sinal tamanho={18} /> Novo item
            </Botao>
          )
        }
      />

      <div className="mb-4 flex flex-col gap-3">
        <Busca valor={busca} aoMudar={setBusca} placeholder="Buscar pelo nome" className="sm:max-w-md" />
        <Filtros
          opcoes={[
            { valor: "todos", rotulo: "Todos" },
            { valor: "peca", rotulo: "Peças" },
            { valor: "maquina", rotulo: "Máquinas" },
            { valor: "mao_de_obra", rotulo: "Mão de obra" },
          ]}
          valor={tipo}
          aoMudar={setTipo}
        />
      </div>

      {erro && <Aviso>{erro}</Aviso>}
      {!itens && !erro && <Carregando />}
      {itens?.length === 0 && <Vazio>Nenhum item encontrado.</Vazio>}

      {itens && itens.length > 0 && (
        <Tabela
          colunas={colunas}
          linhas={itens}
          chave={(i) => i.id}
          aoClicar={gestor ? (i) => navegar(`/itens/${i.id}`) : undefined}
          pdf={{
            titulo: "Catálogo de peças e serviços",
            subtitulo: tipo === "todos" ? "Todos os itens" : ROTULO_TIPO_ITEM[tipo],
            nomeArquivo: `catalogo-${dataLocalISO()}`,
          }}
          cartao={(i) => (
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold">{i.nome}</p>
                <p className="text-sm text-suave">{ROTULO_TIPO_ITEM[i.tipo]}</p>
              </div>
              <p className="shrink-0 font-semibold tabular-nums">{i.valorVariavel ? <span className="text-suave">Variável</span> : formatarMoeda(i.valorUnitario)}</p>
            </div>
          )}
        />
      )}
    </div>
  );
}
