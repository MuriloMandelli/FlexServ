import { useState } from "react";
import type { FormEvent } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth";
import { mensagemDeErro } from "../api";
import { Aviso, Botao, Campo, CampoSenha } from "../components/ui";
import { Marca } from "../components/Marca";
import { Icone } from "../components/Icones";

const DESTAQUES = [
  { icone: <Icone.ferramenta />, texto: "Ordens de serviço na oficina e em campo" },
  { icone: <Icone.assinatura />, texto: "Aprovação com assinatura do cliente" },
  { icone: <Icone.relatorios />, texto: "Valores calculados e relatórios na hora" },
];

export default function Login() {
  const { usuario, entrar } = useAuth();
  const local = useLocation();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  // Tela que a pessoa tentou abrir antes de ser mandada pro login
  const destino = (local.state as { de?: string } | null)?.de ?? "/";

  // Logado (inclusive logo apos entrar): segue para o destino
  if (usuario) return <Navigate to={destino} replace />;

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro("");
    setEnviando(true);
    try {
      // Ao salvar o usuario, a tela re-renderiza e o <Navigate> acima redireciona
      await entrar(email.trim(), senha);
    } catch (err) {
      setErro(mensagemDeErro(err));
      setEnviando(false);
    }
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      {/* Lado da marca (computador) */}
      <div className="relative hidden overflow-hidden border-r border-borda bg-gradient-to-br from-marinho/60 via-fundo to-fundo p-12 lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-40 -top-40 h-96 w-96 rounded-full bg-primaria/10 blur-3xl" />
        <Marca grande />
        <div className="relative">
          <h2 className="max-w-md text-4xl font-bold leading-tight tracking-tight">
            Do papel para o digital: a assistência técnica da TecFlex em um só lugar.
          </h2>
          <ul className="mt-8 space-y-4">
            {DESTAQUES.map((d) => (
              <li key={d.texto} className="flex items-center gap-3 text-suave">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primaria/15 text-primaria">
                  {d.icone}
                </span>
                {d.texto}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-suave/70">TecFlex · Aparelhos para máquinas de costura industriais e domésticas</p>
      </div>

      {/* Formulario */}
      <div className="flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Marca grande />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Entrar</h1>
          <p className="mt-1 text-suave">Use seu e-mail e senha para acessar o sistema.</p>

          <form onSubmit={enviar} className="mt-6 flex flex-col gap-4">
            <Campo
              rotulo="E-mail"
              type="email"
              inputMode="email"
              autoComplete="username"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <CampoSenha
              rotulo="Senha"
              autoComplete="current-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
            />
            {erro && <Aviso>{erro}</Aviso>}
            <Botao type="submit" disabled={enviando} className="mt-1 w-full">
              {enviando ? "Entrando..." : "Entrar"}
            </Botao>
          </form>
        </div>
      </div>
    </div>
  );
}
