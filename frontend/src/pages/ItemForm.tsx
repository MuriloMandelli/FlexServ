import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, mensagemDeErro } from "../api";
import type { Item, TipoItem } from "../types";
import { AreaTexto, Aviso, Botao, CabecalhoPagina, Campo, CampoSelecao, Carregando, Cartao } from "../components/ui";

export default function ItemForm() {
  const { id } = useParams();
  const editando = id !== undefined;
  const navegar = useNavigate();

  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<TipoItem>("peca");
  const [valor, setValor] = useState("");
  const [custo, setCusto] = useState("");
  const [variavel, setVariavel] = useState(false);
  const [descricao, setDescricao] = useState("");
  const [carregando, setCarregando] = useState(editando);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!editando) return;
    api<Item>(`/itens/${id}`)
      .then((i) => {
        setNome(i.nome);
        setTipo(i.tipo);
        setValor(i.valorUnitario.replace(".", ","));
        setCusto(Number(i.valorCusto) ? i.valorCusto.replace(".", ",") : "");
        setVariavel(i.valorVariavel);
        setDescricao(i.descricao ?? "");
      })
      .catch((err) => setErro(mensagemDeErro(err)))
      .finally(() => setCarregando(false));
  }, [editando, id]);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErro("");
    setSalvando(true);
    try {
      const dados = { nome, tipo, valorUnitario: valor || "0", valorCusto: custo || "0", valorVariavel: variavel, descricao };
      if (editando) await api(`/itens/${id}`, "PUT", dados);
      else await api("/itens", "POST", dados);
      navegar("/itens");
    } catch (err) {
      setErro(mensagemDeErro(err));
      setSalvando(false);
    }
  }

  async function excluir() {
    if (!confirm(`Excluir o item "${nome}"?`)) return;
    setErro("");
    try {
      await api(`/itens/${id}`, "DELETE");
      navegar("/itens");
    } catch (err) {
      setErro(mensagemDeErro(err));
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <CabecalhoPagina titulo={editando ? "Editar item" : "Novo item"} voltarPara="/itens" voltarRotulo="Peças e serviços" />

      {carregando ? (
        <Carregando />
      ) : (
        <form onSubmit={salvar} className="flex flex-col gap-4">
          <Cartao className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
            <Campo
              rotulo="Nome *"
              className="sm:col-span-2"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Lançadeira, Revisão completa"
              required
            />
            <CampoSelecao
              rotulo="Tipo *"
              className="sm:col-span-2"
              value={tipo}
              onChange={(e) => setTipo(e.target.value as TipoItem)}
            >
              <option value="peca">Peça (vai em OS e em vendas)</option>
              <option value="maquina">Máquina (vai em vendas)</option>
              <option value="mao_de_obra">Mão de obra (só em OS)</option>
            </CampoSelecao>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-borda p-3 sm:col-span-2">
              <input
                type="checkbox"
                checked={variavel}
                onChange={(e) => setVariavel(e.target.checked)}
                className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-primaria)]"
              />
              <span>
                <span className="block text-sm font-medium">Valor variável</span>
                <span className="text-xs text-suave">
                  O preço muda a cada serviço (ex.: mão de obra, transporte, combustível). O valor é informado na hora de
                  lançar na OS ou na venda.
                </span>
              </span>
            </label>
            <Campo
              rotulo={variavel ? "Valor sugerido (R$)" : "Valor de venda (R$) *"}
              inputMode="decimal"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="0,00"
              required={!variavel}
              dica={variavel ? "Opcional: vem preenchido ao lançar e pode ser alterado." : undefined}
            />
            <Campo
              rotulo="Custo (R$)"
              inputMode="decimal"
              value={custo}
              onChange={(e) => setCusto(e.target.value)}
              placeholder="0,00"
              dica="Quanto a TecFlex paga. Usado no relatório de lucro."
            />
            <AreaTexto
              rotulo="Descrição"
              rows={2}
              className="sm:col-span-2"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
            />
          </Cartao>

          {editando && (
            <p className="text-sm text-suave">
              Alterar o valor não muda as OS já abertas: cada OS guarda o preço do dia em que o item foi lançado.
            </p>
          )}
          {erro && <Aviso>{erro}</Aviso>}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            {editando ? (
              <Botao type="button" variante="perigo" onClick={excluir}>
                Excluir
              </Botao>
            ) : (
              <span />
            )}
            <Botao type="submit" disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar item"}
            </Botao>
          </div>
        </form>
      )}
    </div>
  );
}
