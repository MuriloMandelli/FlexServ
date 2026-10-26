import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { formatarData, formatarMoeda, dataLocalISO } from "../formatar";
import type { OSResumo, Relatorio } from "../types";
import { SeloStatus } from "../components/StatusOS";
import { Icone } from "../components/Icones";
import { Cartao, Indicador } from "../components/ui";

// Tela inicial: atalhos para as duas frentes (servicos e vendas) + numeros do mes
export default function Menu() {
  const { usuario } = useAuth();
  const primeiroNome = usuario?.nome.split(" ")[0] ?? "";
  const [resumo, setResumo] = useState<Relatorio["resumo"] | null>(null);
  const [pendentes, setPendentes] = useState<OSResumo[]>([]);

  useEffect(() => {
    const hoje = new Date();
    const inicioMes = dataLocalISO(new Date(hoje.getFullYear(), hoje.getMonth(), 1));
    api<Relatorio>(`/relatorios?de=${inicioMes}&ate=${dataLocalISO(hoje)}`)
      .then((r) => setResumo(r.resumo))
      .catch(() => setResumo(null));
    // OS em aberto ou em execucao (as que precisam de atencao)
    Promise.all([api<OSResumo[]>("/os?fase=aberta"), api<OSResumo[]>("/os?fase=execucao")])
      .then(([a, b]) => setPendentes([...a, ...b].sort((x, y) => y.id - x.id).slice(0, 6)))
      .catch(() => setPendentes([]));
  }, []);

  const hora = new Date().getHours();
  const saudacao = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {saudacao}, {primeiroNome}
        </h1>
        <p className="mt-1 text-suave">O que você vai fazer agora?</p>
      </div>

      {/* Acoes principais: Servicos x Vendas */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          to="/os/nova"
          className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-primaria to-primaria-forte p-5 text-fundo shadow-lg shadow-primaria/20 transition hover:brightness-105 sm:p-6"
        >
          <span className="absolute -right-6 -top-6 opacity-15">
            <Icone.ferramenta tamanho={120} />
          </span>
          <span className="text-sm font-semibold uppercase tracking-wide opacity-80">Serviços</span>
          <p className="mt-1 text-2xl font-bold">Nova OS</p>
          <p className="mt-1 text-sm opacity-90">Manutenção na oficina ou em campo, com aprovação do cliente.</p>
        </Link>
        <Link
          to="/vendas/nova"
          className="group relative overflow-hidden rounded-2xl border border-borda bg-gradient-to-br from-marinho/70 to-superficie p-5 transition hover:border-primaria/50 sm:p-6"
        >
          <span className="absolute -right-6 -top-6 opacity-10">
            <Icone.venda tamanho={120} />
          </span>
          <span className="text-sm font-semibold uppercase tracking-wide text-suave">Vendas</span>
          <p className="mt-1 text-2xl font-bold">Nova venda</p>
          <p className="mt-1 text-sm text-suave">Peças e máquinas no balcão, com recibo em PDF.</p>
        </Link>
      </div>

      {/* Numeros do mes */}
      {resumo && (
        <div>
          <p className="mb-2 text-sm font-semibold text-suave">Este mês</p>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Indicador rotulo="Faturamento" valor={formatarMoeda(resumo.receitaTotal)} destaque />
            <Indicador rotulo="OS em aberto" valor={String(resumo.osEmAberto)} />
            <Indicador rotulo="A receber" valor={formatarMoeda(resumo.aReceber)} />
            <Indicador rotulo="Vendas" valor={String(resumo.vendas)} />
          </div>
        </div>
      )}

      {/* OS que precisam de atencao */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold text-suave">OS em andamento</p>
          <Link to="/os" className="text-sm text-primaria">
            Ver todas
          </Link>
        </div>
        <Cartao className="divide-y divide-borda overflow-hidden">
          {pendentes.length === 0 && <p className="px-4 py-6 text-center text-sm text-suave">Nenhuma OS em aberto.</p>}
          {pendentes.map((o) => (
            <Link key={o.id} to={`/os/${o.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-superficie-2">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  <span className="text-suave">#{o.id}</span> {o.clienteNome}
                </p>
                <p className="truncate text-xs text-suave">
                  {o.defeitoRelatado ? `${o.defeitoRelatado} · ` : ""}
                  {formatarData(o.dataAbertura)}
                  {!o.aprovada && o.status.fase === "aberta" ? " · aguardando aprovação" : ""}
                </p>
              </div>
              <SeloStatus nome={o.status.nome} cor={o.status.cor} />
            </Link>
          ))}
        </Cartao>
      </div>
    </div>
  );
}
