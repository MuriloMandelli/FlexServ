import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { api, mensagemDeErro } from "../api";
import { formatarDataHora, formatarMoeda } from "../formatar";
import type { OSDetalhe } from "../types";
import { Icone } from "./Icones";
import { linkWhatsApp, numeroWhatsApp } from "./WhatsApp";
import { Aviso, Botao, Modal } from "./ui";

// Aprovacao eletronica da OS: cliente e tecnico recebem um link pelo
// WhatsApp, leem o orcamento e os termos e tocam em "Assinar". O tecnico
// responsavel, se estiver logado, tambem pode assinar direto aqui.

function linkAprovacao(token: string) {
  return `${window.location.origin}/aprovar/${token}`;
}

type Props = {
  os: OSDetalhe;
  usuarioId: number | undefined;
  ocupado: boolean;
  // Executa uma acao que devolve a OS atualizada (mesmo padrao da tela)
  executar: (acao: () => Promise<OSDetalhe>, sucesso?: string) => Promise<boolean>;
};

export function PainelAprovacao({ os, usuarioId, ocupado, executar }: Props) {
  const [assinando, setAssinando] = useState(false);
  const [copiado, setCopiado] = useState("");
  const enviado = Boolean(os.tokenCliente);
  const souTecnico = usuarioId === os.tecnico.id;
  const primeiroNome = (nome: string) => nome.split(" ")[0];

  async function copiar(token: string, quem: string) {
    try {
      await navigator.clipboard.writeText(linkAprovacao(token));
      setCopiado(quem);
      setTimeout(() => setCopiado(""), 2000);
    } catch {
      prompt("Copie o link:", linkAprovacao(token));
    }
  }

  // Abre o WhatsApp com a mensagem pronta e registra no historico de avisos
  function enviarWhats(telefone: string | null, mensagem: string) {
    const numero = numeroWhatsApp(telefone);
    if (!numero) return;
    window.open(linkWhatsApp(numero, mensagem), "_blank", "noreferrer");
    executar(() => api<OSDetalhe>(`/os/${os.id}/avisos`, "POST", { mensagem }));
  }

  // ---- Ja aprovada: comprovante dos aceites ----
  if (os.aprovada) {
    return (
      <div className="mb-4 rounded-xl border border-sucesso/30 bg-sucesso/10 p-4">
        <p className="flex items-center gap-2 font-semibold text-sucesso">
          <Icone.check tamanho={18} /> Aprovada em {formatarDataHora(os.aprovadoEm)}
        </p>
        <ul className="mt-2 space-y-1 text-sm text-suave">
          <li>
            Cliente: <b className="text-texto">{os.aceiteClienteNome}</b>
            {os.aceiteClienteEm && ` · ${formatarDataHora(os.aceiteClienteEm)}`}
          </li>
          <li>
            Técnico: <b className="text-texto">{os.aceiteTecnicoNome}</b>
            {os.aceiteTecnicoEm && ` · ${formatarDataHora(os.aceiteTecnicoEm)}`}
            {os.aceiteTecnicoMeio && ` · ${os.aceiteTecnicoMeio === "sistema" ? "no sistema" : "pelo link"}`}
          </li>
        </ul>
      </div>
    );
  }

  // ---- Ainda nao enviada ----
  if (!enviado) {
    const semItens = os.itens.length === 0;
    return (
      <div className="mb-4 flex flex-col gap-3 rounded-xl border border-amber-400/30 bg-amber-400/10 p-4">
        <div>
          <p className="font-semibold text-amber-200">Aguardando aprovação</p>
          <p className="text-sm text-suave">
            Envie o orçamento: o cliente e o técnico recebem um link no WhatsApp, leem os termos e tocam em "Assinar". O
            serviço só começa depois dos dois aceites.
          </p>
        </div>
        {semItens && <p className="text-sm text-amber-200">Adicione os itens do orçamento antes de enviar.</p>}
        <Botao
          disabled={semItens || ocupado}
          onClick={() => executar(() => api<OSDetalhe>(`/os/${os.id}/aprovacao`, "POST"), "Links de aprovação gerados.")}
        >
          <Icone.assinatura tamanho={18} /> Enviar para aprovação
        </Botao>
      </div>
    );
  }

  // ---- Enviada: acompanha os dois aceites ----
  const msgCliente = `Olá ${primeiroNome(os.cliente.nome)}! Aqui é da TecFlex. Segue o orçamento da OS #${os.id}, no valor de ${formatarMoeda(
    os.valorTotal
  )}. Para aprovar, abra o link, confira e toque em "Assinar": ${linkAprovacao(os.tokenCliente!)}`;
  const msgTecnico = `Olá ${primeiroNome(os.tecnico.nome)}! Você é o técnico responsável pela OS #${os.id} (${os.cliente.nome}). Confira o orçamento e os termos e assine: ${linkAprovacao(
    os.tokenTecnico!
  )}`;

  return (
    <div className="mb-4 rounded-xl border border-amber-400/30 bg-amber-400/10 p-4">
      <p className="font-semibold text-amber-200">Aguardando aprovação</p>
      <p className="mb-3 text-sm text-suave">A tela se atualiza sozinha quando alguém assinar.</p>

      <div className="flex flex-col gap-3">
        <LinhaAceite
          titulo="Cliente"
          nome={os.cliente.nome}
          assinadoEm={os.aceiteClienteEm}
          assinadoPor={os.aceiteClienteNome}
        >
          <Botao
            pequeno
            variante="whatsapp"
            disabled={!numeroWhatsApp(os.cliente.telefone) || ocupado}
            onClick={() => enviarWhats(os.cliente.telefone, msgCliente)}
          >
            <Icone.whatsapp tamanho={16} /> Enviar
          </Botao>
          <Botao pequeno variante="secundario" onClick={() => copiar(os.tokenCliente!, "cliente")}>
            <Icone.copiar tamanho={16} /> {copiado === "cliente" ? "Copiado!" : "Copiar link"}
          </Botao>
        </LinhaAceite>
        {!numeroWhatsApp(os.cliente.telefone) && !os.aceiteClienteEm && (
          <p className="-mt-1 text-xs text-suave">O cliente não tem WhatsApp no cadastro: copie o link e envie por outro meio.</p>
        )}

        <LinhaAceite
          titulo="Técnico responsável"
          nome={os.tecnico.nome}
          assinadoEm={os.aceiteTecnicoEm}
          assinadoPor={os.aceiteTecnicoNome}
        >
          {souTecnico && (
            <Botao pequeno disabled={ocupado} onClick={() => setAssinando(true)}>
              <Icone.assinatura tamanho={16} /> Assinar agora
            </Botao>
          )}
          <Botao
            pequeno
            variante={souTecnico ? "secundario" : "whatsapp"}
            disabled={!numeroWhatsApp(os.tecnico.telefone) || ocupado}
            onClick={() => enviarWhats(os.tecnico.telefone, msgTecnico)}
            title={numeroWhatsApp(os.tecnico.telefone) ? undefined : "Técnico sem WhatsApp no cadastro de usuários"}
          >
            <Icone.whatsapp tamanho={16} /> Enviar
          </Botao>
          <Botao pequeno variante="secundario" onClick={() => copiar(os.tokenTecnico!, "tecnico")}>
            <Icone.copiar tamanho={16} /> {copiado === "tecnico" ? "Copiado!" : "Copiar link"}
          </Botao>
        </LinhaAceite>
      </div>

      <ModalAceiteTecnico
        aberto={assinando}
        aoFechar={() => setAssinando(false)}
        os={os}
        aoAssinar={async () => {
          const ok = await executar(() => api<OSDetalhe>(`/os/${os.id}/aprovacao/tecnico`, "POST"), "Aceite do técnico registrado.");
          if (ok) setAssinando(false);
        }}
      />
    </div>
  );
}

function LinhaAceite({
  titulo,
  nome,
  assinadoEm,
  assinadoPor,
  children,
}: {
  titulo: string;
  nome: string;
  assinadoEm: string | null;
  assinadoPor: string | null;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-fundo/50 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-xs text-suave">{titulo}</p>
        <p className="truncate font-medium">{nome}</p>
        {assinadoEm ? (
          <p className="flex items-center gap-1 text-sm text-sucesso">
            <Icone.check tamanho={14} /> Assinou{assinadoPor && assinadoPor !== nome ? ` (${assinadoPor})` : ""} em{" "}
            {formatarDataHora(assinadoEm)}
          </p>
        ) : (
          <p className="text-sm text-amber-200">Aguardando assinatura</p>
        )}
      </div>
      {!assinadoEm && <div className="flex shrink-0 flex-wrap gap-2">{children}</div>}
    </div>
  );
}

// O tecnico logado le os termos e confirma, sem precisar do link
function ModalAceiteTecnico({
  aberto,
  aoFechar,
  os,
  aoAssinar,
}: {
  aberto: boolean;
  aoFechar: () => void;
  os: OSDetalhe;
  aoAssinar: () => Promise<void>;
}) {
  const [concordo, setConcordo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [termos, setTermos] = useState(os.termosAprovacao ?? "");
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!aberto) return;
    setConcordo(false);
    if (os.termosAprovacao) setTermos(os.termosAprovacao);
    else
      api<{ texto: string }>("/configuracoes/termos")
        .then((t) => setTermos(t.texto))
        .catch((err) => setErro(mensagemDeErro(err)));
  }, [aberto, os.termosAprovacao]);

  return (
    <Modal titulo={`Assinar OS #${os.id}`} aberto={aberto} aoFechar={aoFechar}>
      <div className="flex flex-col gap-4">
        <p className="text-sm">
          Serviço para <b>{os.cliente.nome}</b> no valor de <b>{formatarMoeda(os.valorTotal)}</b> ({os.itens.length}{" "}
          {os.itens.length === 1 ? "item" : "itens"}).
        </p>
        <div className="max-h-56 overflow-y-auto whitespace-pre-line rounded-xl bg-fundo/60 p-3 text-sm leading-relaxed text-suave">
          {termos}
        </div>
        <label className="flex cursor-pointer items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={concordo}
            onChange={(e) => setConcordo(e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-primaria)]"
          />
          <span>Li e concordo com o orçamento e os termos.</span>
        </label>
        {erro && <Aviso>{erro}</Aviso>}
        <Botao
          disabled={!concordo || enviando}
          onClick={async () => {
            setEnviando(true);
            await aoAssinar();
            setEnviando(false);
          }}
        >
          <Icone.check tamanho={18} /> {enviando ? "Assinando..." : "Assinar como técnico"}
        </Botao>
      </div>
    </Modal>
  );
}
