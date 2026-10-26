import { useEffect, useState } from "react";
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { Link } from "react-router-dom";
import { Icone } from "./Icones";

// Componentes visuais reaproveitados em todas as telas

type VarianteBotao = "primario" | "secundario" | "perigo" | "fantasma" | "whatsapp";

const estilosBotao: Record<VarianteBotao, string> = {
  primario: "bg-primaria text-fundo hover:bg-primaria-forte shadow-sm shadow-primaria/20",
  secundario: "border border-borda bg-superficie text-texto hover:bg-superficie-2",
  perigo: "border border-perigo/40 text-perigo hover:bg-perigo/10",
  fantasma: "text-suave hover:bg-superficie-2 hover:text-texto",
  whatsapp: "bg-[#25d366] text-[#06281a] hover:bg-[#1fbf5b]",
};

export function Botao({
  variante = "primario",
  pequeno = false,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: VarianteBotao; pequeno?: boolean }) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${
        pequeno ? "min-h-9 px-3 text-sm" : "min-h-11 px-4"
      } ${estilosBotao[variante]} ${className}`}
      {...props}
    />
  );
}

const estiloEntrada =
  "w-full rounded-xl border border-borda bg-fundo/70 px-3 text-base text-texto placeholder:text-suave/50 outline-none transition focus:border-primaria focus:ring-2 focus:ring-primaria/20 disabled:opacity-60";

export function Campo({
  rotulo,
  dica,
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { rotulo: string; dica?: string }) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-sm font-medium">{rotulo}</span>
      <input className={`min-h-11 ${estiloEntrada}`} {...props} />
      {dica && <span className="text-xs text-suave">{dica}</span>}
    </label>
  );
}

// Campo de senha com o "olhinho" para mostrar ou esconder o que foi digitado
export function CampoSenha({
  rotulo,
  dica,
  className = "",
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { rotulo: string; dica?: string }) {
  const [visivel, setVisivel] = useState(false);
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-sm font-medium">{rotulo}</span>
      <span className="relative">
        <input type={visivel ? "text" : "password"} className={`min-h-11 pr-12 ${estiloEntrada}`} {...props} />
        <button
          type="button"
          onClick={() => setVisivel((v) => !v)}
          className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-suave hover:text-texto"
          aria-label={visivel ? "Esconder senha" : "Mostrar senha"}
          title={visivel ? "Esconder senha" : "Mostrar senha"}
        >
          {visivel ? <Icone.olhoFechado /> : <Icone.olho />}
        </button>
      </span>
      {dica && <span className="text-xs text-suave">{dica}</span>}
    </label>
  );
}

export function AreaTexto({
  rotulo,
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { rotulo: string }) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-sm font-medium">{rotulo}</span>
      <textarea rows={3} className={`py-2.5 ${estiloEntrada}`} {...props} />
    </label>
  );
}

export function CampoSelecao({
  rotulo,
  children,
  className = "",
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { rotulo: string }) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-sm font-medium">{rotulo}</span>
      <select className={`min-h-11 ${estiloEntrada}`} {...props}>
        {children}
      </select>
    </label>
  );
}

// Valor em reais dentro de uma linha de item (itens de valor variavel)
export function CampoValorLinha({
  valor,
  aoMudar,
  aoConfirmar,
  desabilitado = false,
  rotulo,
}: {
  valor: string;
  aoMudar: (v: string) => void;
  aoConfirmar?: () => void;
  desabilitado?: boolean;
  rotulo: string;
}) {
  return (
    <label className="flex items-center gap-1 rounded-lg border border-primaria/50 bg-fundo/70 px-2 focus-within:border-primaria">
      <span className="text-xs text-suave">R$</span>
      <input
        inputMode="decimal"
        aria-label={rotulo}
        value={valor}
        disabled={desabilitado}
        onChange={(e) => aoMudar(e.target.value)}
        onBlur={aoConfirmar}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
        }}
        placeholder="0,00"
        className="h-10 w-20 bg-transparent text-right tabular-nums outline-none"
      />
    </label>
  );
}

// Campo de busca com lupa
export function Busca({
  valor,
  aoMudar,
  placeholder,
  className = "",
}: {
  valor: string;
  aoMudar: (v: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-suave" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3.5-3.5" />
      </svg>
      <input
        type="search"
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        placeholder={placeholder}
        className={`min-h-11 pl-10 ${estiloEntrada} bg-superficie`}
      />
    </div>
  );
}

// Botoes de filtro (ex.: Todos / Aberto / Em andamento)
export function Filtros<T extends string>({
  opcoes,
  valor,
  aoMudar,
  extra,
}: {
  opcoes: { valor: T; rotulo: string; cor?: string }[];
  valor: T;
  aoMudar: (v: T) => void;
  extra?: ReactNode;
}) {
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
      {opcoes.map((o) => (
        <button
          key={o.valor}
          type="button"
          onClick={() => aoMudar(o.valor)}
          className={`flex min-h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium transition ${
            valor === o.valor
              ? "border-primaria bg-primaria text-fundo"
              : "border-borda bg-superficie text-texto hover:bg-superficie-2"
          }`}
        >
          {o.cor && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: o.cor }} />}
          {o.rotulo}
        </button>
      ))}
      {extra}
    </div>
  );
}

export function Cartao({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-borda bg-superficie/90 shadow-lg shadow-black/10 ${className}`}>
      {children}
    </div>
  );
}

// Cartao com titulo (secoes das telas de detalhe)
export function Secao({
  titulo,
  acao,
  children,
  className = "",
}: {
  titulo: string;
  acao?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Cartao className={`p-4 sm:p-5 ${className}`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">{titulo}</h2>
        {acao}
      </div>
      {children}
    </Cartao>
  );
}

// Numero de destaque (relatorios e inicio)
export function Indicador({
  rotulo,
  valor,
  detalhe,
  destaque = false,
}: {
  rotulo: string;
  valor: string;
  detalhe?: string;
  destaque?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        destaque ? "border-primaria/40 bg-gradient-to-br from-primaria/20 to-marinho/30" : "border-borda bg-superficie/90"
      }`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-suave">{rotulo}</p>
      <p className="mt-1.5 text-2xl font-bold tabular-nums">{valor}</p>
      {detalhe && <p className="mt-0.5 text-xs text-suave">{detalhe}</p>}
    </div>
  );
}

export function Aviso({ children, tipo = "erro" }: { children: ReactNode; tipo?: "erro" | "info" | "sucesso" }) {
  const estilo = {
    erro: "border-perigo/40 bg-perigo/10 text-perigo",
    info: "border-primaria/40 bg-primaria/10 text-primaria",
    sucesso: "border-sucesso/40 bg-sucesso/10 text-sucesso",
  }[tipo];
  return (
    <div role={tipo === "erro" ? "alert" : "status"} className={`rounded-xl border px-4 py-3 text-sm ${estilo}`}>
      {children}
    </div>
  );
}

export function Carregando() {
  return (
    <div className="flex items-center justify-center gap-3 py-12 text-suave">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-borda border-t-primaria" />
      Carregando...
    </div>
  );
}

export function Vazio({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-borda px-4 py-12 text-center text-suave">{children}</div>
  );
}

// Titulo da pagina, com link de voltar (opcional) e acoes
export function CabecalhoPagina({
  titulo,
  subtitulo,
  voltarPara,
  voltarRotulo = "Voltar",
  acao,
}: {
  titulo: string;
  subtitulo?: string;
  voltarPara?: string;
  voltarRotulo?: string;
  acao?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {voltarPara && (
          <Link to={voltarPara} className="mb-1 inline-flex items-center gap-1 text-sm text-suave hover:text-texto">
            <Icone.voltar tamanho={16} /> {voltarRotulo}
          </Link>
        )}
        <h1 className="truncate text-2xl font-bold tracking-tight sm:text-3xl">{titulo}</h1>
        {subtitulo && <p className="mt-1 text-sm text-suave">{subtitulo}</p>}
      </div>
      {acao && <div className="flex flex-wrap gap-2">{acao}</div>}
    </div>
  );
}

// Janela sobre a tela (no celular ocupa a parte de baixo, como uma "gaveta")
export function Modal({
  titulo,
  aberto,
  aoFechar,
  children,
  largura = "max-w-lg",
}: {
  titulo: string;
  aberto: boolean;
  aoFechar: () => void;
  children: ReactNode;
  largura?: string;
}) {
  // Fecha com ESC e trava a rolagem do fundo
  useEffect(() => {
    if (!aberto) return;
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && aoFechar();
    window.addEventListener("keydown", tecla);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", tecla);
      document.body.style.overflow = overflow;
    };
  }, [aberto, aoFechar]);

  if (!aberto) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={aoFechar} />
      <div
        role="dialog"
        aria-modal
        aria-label={titulo}
        className={`relative max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border border-borda bg-superficie p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl ${largura}`}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{titulo}</h2>
          <button
            type="button"
            onClick={aoFechar}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-suave hover:bg-superficie-2 hover:text-texto"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
