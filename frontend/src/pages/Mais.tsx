import { Link } from "react-router-dom";
import { useAuth } from "../auth";
import { Icone } from "../components/Icones";
import { MENU, iniciais } from "../components/Layout";
import { Cartao } from "../components/ui";

// Tela "Mais" do celular: todos os atalhos do menu lateral
export default function Mais() {
  const { usuario, sair } = useAuth();
  const gestor = usuario?.papel === "gestor";

  return (
    <div className="flex flex-col gap-5">
      {usuario && (
        <Cartao className="flex items-center gap-3 p-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-primaria to-primaria-forte font-bold text-fundo">
            {iniciais(usuario.nome)}
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold">{usuario.nome}</p>
            <p className="truncate text-sm text-suave">
              {usuario.email} · <span className="capitalize">{usuario.papel}</span>
            </p>
          </div>
        </Cartao>
      )}

      {MENU.filter((g) => g.titulo).map((grupo) => (
        <div key={grupo.titulo}>
          <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-[0.15em] text-suave/70">{grupo.titulo}</p>
          <Cartao className="divide-y divide-borda overflow-hidden">
            {grupo.itens
              .filter((it) => !it.apenasGestor || gestor)
              .map((it) => (
                <Link key={it.para} to={it.para} className="flex min-h-14 items-center gap-3 px-4 active:bg-superficie-2">
                  <span className="text-primaria">{it.icone}</span>
                  <span className="flex-1 font-medium">{it.rotulo}</span>
                  <Icone.seta tamanho={18} />
                </Link>
              ))}
          </Cartao>
        </div>
      ))}

      <button
        onClick={sair}
        className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-perigo/40 font-semibold text-perigo"
      >
        <Icone.sair /> Sair
      </button>
    </div>
  );
}
