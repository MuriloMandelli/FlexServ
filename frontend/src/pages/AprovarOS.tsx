import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useParams } from "react-router-dom";
import { api, mensagemDeErro } from "../api";
import { formatarData, formatarDataHora, formatarDataSimples, formatarMoeda, ROTULO_ATENDIMENTO } from "../formatar";
import type { AprovacaoPublica } from "../types";
import { Marca } from "../components/Marca";
import { Icone } from "../components/Icones";
import { Aviso, Botao, Campo, Carregando, Cartao } from "../components/ui";

// Pagina publica (sem login) aberta pelo link do WhatsApp.
// O cliente (ou o tecnico) le o orcamento e os termos e toca em "Assinar".
export default function AprovarOS() {
  const { token } = useParams();
  const [dados, setDados] = useState<AprovacaoPublica | null>(null);
  const [erroCarga, setErroCarga] = useState("");
  const [nome, setNome] = useState("");
  const [concordo, setConcordo] = useState(false);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  function carregar() {
    return api<AprovacaoPublica>(`/publico/aprovacao/${token}`)
      .then((d) => {
        setDados(d);
        // Tecnico: nome ja preenchido. Cliente: quem assina digita o proprio nome
        // (em empresa, quem assina e uma pessoa, nao a razao social)
        if (d.papel === "tecnico") setNome((atual) => atual || d.nomeSugerido);
      })
      .catch((err) => setErroCarga(mensagemDeErro(err)));
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function assinar(e: FormEvent) {
    e.preventDefault();
    setErro("");
    if (!nome.trim()) return setErro("Informe seu nome.");
    if (!concordo) return setErro("Marque que leu e concorda com os termos.");
    setEnviando(true);
    try {
      await api(`/publico/aprovacao/${token}`, "POST", { nome: nome.trim(), concordo: true });
      await carregar();
    } catch (err) {
      setErro(mensagemDeErro(err));
    } finally {
      setEnviando(false);
    }
  }

  const ehTecnico = dados?.papel === "tecnico";

  return (
    <div className="min-h-dvh px-4 py-6 sm:py-10">
      <div className="mx-auto flex max-w-xl flex-col gap-4">
        <div className="mb-2">
          <Marca />
        </div>

        {!dados && !erroCarga && <Carregando />}
        {erroCarga && (
          <Cartao className="p-5">
            <p className="font-semibold">Link indisponível</p>
            <p className="mt-1 text-sm text-suave">{erroCarga}</p>
          </Cartao>
        )}

        {dados && (
          <>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {ehTecnico ? "Aceite do técnico" : "Aprovação do orçamento"}
              </h1>
              <p className="mt-1 text-suave">
                Ordem de serviço <b className="text-texto">#{dados.os.id}</b> · aberta em {formatarData(dados.os.dataAbertura)}
              </p>
            </div>

            {/* Ja assinado: comprovante */}
            {dados.aceite && (
              <Cartao className="border-sucesso/40 p-5">
                <p className="flex items-center gap-2 text-lg font-semibold text-sucesso">
                  <Icone.check /> Assinado
                </p>
                <p className="mt-1 text-sm text-suave">
                  Por <b className="text-texto">{dados.aceite.nome}</b> em {formatarDataHora(dados.aceite.em)}.
                  {ehTecnico ? "" : " Obrigado! A TecFlex já foi avisada e seguirá com o serviço."}
                </p>
              </Cartao>
            )}
            {!dados.aceite && !dados.podeAssinar && (
              <Aviso tipo="info">Este orçamento não está mais disponível para assinatura. Fale com a TecFlex.</Aviso>
            )}

            <Cartao className="p-4 sm:p-5">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div className="col-span-2">
                  <dt className="text-xs text-suave">Cliente</dt>
                  <dd className="font-medium">{dados.clienteNome}</dd>
                </div>
                <div>
                  <dt className="text-xs text-suave">Técnico responsável</dt>
                  <dd>{dados.tecnicoNome}</dd>
                </div>
                <div>
                  <dt className="text-xs text-suave">Atendimento</dt>
                  <dd>{ROTULO_ATENDIMENTO[dados.os.tipoAtendimento]}</dd>
                </div>
                {dados.os.defeitoRelatado && (
                  <div className="col-span-2">
                    <dt className="text-xs text-suave">Defeito relatado</dt>
                    <dd className="whitespace-pre-line">{dados.os.defeitoRelatado}</dd>
                  </div>
                )}
                {dados.os.previsaoEntrega && (
                  <div>
                    <dt className="text-xs text-suave">Previsão</dt>
                    <dd>{formatarDataSimples(dados.os.previsaoEntrega)}</dd>
                  </div>
                )}
                {dados.os.garantiaDias ? (
                  <div>
                    <dt className="text-xs text-suave">Garantia</dt>
                    <dd>{dados.os.garantiaDias} dias</dd>
                  </div>
                ) : null}
              </dl>
            </Cartao>

            <Cartao className="p-4 sm:p-5">
              <h2 className="mb-2 font-semibold">Peças e serviços</h2>
              <ul className="divide-y divide-borda text-sm">
                {dados.os.itens.map((i, n) => (
                  <li key={n} className="flex items-start justify-between gap-3 py-2.5">
                    <span className="min-w-0">
                      {i.nome}
                      <span className="block text-xs text-suave">
                        {i.quantidade} x {formatarMoeda(i.valorUnitario)}
                      </span>
                    </span>
                    <span className="shrink-0 font-medium tabular-nums">{formatarMoeda(i.subtotal)}</span>
                  </li>
                ))}
              </ul>
              <dl className="mt-2 space-y-1 border-t border-borda pt-3 text-sm">
                {Number(dados.os.desconto) > 0 && (
                  <>
                    <div className="flex justify-between text-suave">
                      <dt>Itens</dt>
                      <dd className="tabular-nums">{formatarMoeda(dados.os.valorItens)}</dd>
                    </div>
                    <div className="flex justify-between text-suave">
                      <dt>Desconto</dt>
                      <dd className="tabular-nums">- {formatarMoeda(dados.os.desconto)}</dd>
                    </div>
                  </>
                )}
                <div className="flex items-baseline justify-between">
                  <dt className="font-semibold">Total</dt>
                  <dd className="text-2xl font-bold tabular-nums">{formatarMoeda(dados.os.valorTotal)}</dd>
                </div>
              </dl>
            </Cartao>

            {dados.termos && (
              <Cartao className="p-4 sm:p-5">
                <h2 className="mb-2 font-semibold">Termos</h2>
                <div className="max-h-64 overflow-y-auto whitespace-pre-line rounded-xl bg-fundo/60 p-3 text-sm leading-relaxed text-suave">
                  {dados.termos}
                </div>
              </Cartao>
            )}

            {dados.podeAssinar && (
              <Cartao className="p-4 sm:p-5">
                <form onSubmit={assinar} className="flex flex-col gap-4">
                  <Campo
                    rotulo="Seu nome completo"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    autoComplete="name"
                    placeholder="Nome de quem está aprovando"
                  />
                  <label className="flex cursor-pointer items-start gap-3 text-sm">
                    <input
                      type="checkbox"
                      checked={concordo}
                      onChange={(e) => setConcordo(e.target.checked)}
                      className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-primaria)]"
                    />
                    <span>
                      Li e concordo com {ehTecnico ? "o orçamento e os termos acima." : `o orçamento de ${formatarMoeda(dados.os.valorTotal)} e com os termos acima.`}
                    </span>
                  </label>
                  {erro && <Aviso>{erro}</Aviso>}
                  <Botao type="submit" disabled={enviando || !concordo} className="w-full">
                    <Icone.assinatura tamanho={18} /> {enviando ? "Assinando..." : "Assinar"}
                  </Botao>
                  <p className="text-xs text-suave">
                    Assinatura eletrônica: ao assinar, registramos seu nome, a data, a hora e o aparelho usado como comprovante.
                  </p>
                </form>
              </Cartao>
            )}
          </>
        )}
      </div>
    </div>
  );
}
