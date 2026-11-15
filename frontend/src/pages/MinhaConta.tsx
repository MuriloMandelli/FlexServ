import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api, mensagemDeErro } from "../api";
import { useAuth } from "../auth";
import { formatarTelefone } from "../formatar";
import type { Vendedor } from "../types";
import { Aviso, Botao, CabecalhoPagina, Campo, CampoSenha, Carregando, Cartao } from "../components/ui";

// Dados do proprio usuario (qualquer papel). Papel, loja e e-mail so o
// gestor muda, no cadastro de vendedores.
export default function MinhaConta() {
  const { atualizarUsuario } = useAuth();
  const [conta, setConta] = useState<Vendedor | null>(null);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");

  useEffect(() => {
    api<Vendedor>("/minha-conta")
      .then((v) => {
        setConta(v);
        setNome(v.nome);
        setTelefone(formatarTelefone(v.telefone));
      })
      .catch((err) => setErro(mensagemDeErro(err)));
  }, []);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErro("");
    setMensagem("");
    setSalvando(true);
    try {
      const v = await api<Vendedor>("/minha-conta", "PUT", { nome, telefone, senhaAtual, novaSenha });
      setConta(v);
      atualizarUsuario({ nome: v.nome });
      setSenhaAtual("");
      setNovaSenha("");
      setMensagem(novaSenha ? "Dados e senha atualizados." : "Dados atualizados.");
    } catch (err) {
      setErro(mensagemDeErro(err));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <CabecalhoPagina titulo="Minha conta" />

      {!conta ? (
        erro ? <Aviso>{erro}</Aviso> : <Carregando />
      ) : (
        <form onSubmit={salvar} className="flex flex-col gap-4">
          <Cartao className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
            <Campo rotulo="Nome *" className="sm:col-span-2" value={nome} onChange={(e) => setNome(e.target.value)} required />
            <Campo rotulo="E-mail" className="sm:col-span-2" value={conta.email} disabled dica="Só o gestor altera." />
            <Campo
              rotulo="WhatsApp"
              type="tel"
              inputMode="tel"
              className="sm:col-span-2"
              value={telefone}
              onChange={(e) => setTelefone(formatarTelefone(e.target.value))}
              placeholder="(48) 99999-9999"
              dica="Recebe o link de aprovação das OS."
            />
          </Cartao>

          <Cartao className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
            <p className="font-semibold sm:col-span-2">Trocar senha</p>
            <CampoSenha
              rotulo="Senha atual"
              autoComplete="current-password"
              value={senhaAtual}
              onChange={(e) => setSenhaAtual(e.target.value)}
              required={novaSenha !== ""}
            />
            <CampoSenha
              rotulo="Nova senha"
              autoComplete="new-password"
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              minLength={6}
              dica="Deixe em branco para manter a atual."
            />
          </Cartao>

          {erro && <Aviso>{erro}</Aviso>}
          {mensagem && <Aviso tipo="sucesso">{mensagem}</Aviso>}

          <div className="flex justify-end">
            <Botao type="submit" disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar"}
            </Botao>
          </div>
        </form>
      )}
    </div>
  );
}
