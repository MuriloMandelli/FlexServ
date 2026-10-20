# CONTEXTO.md — Projeto FlexServ

> Documento para retomar o desenvolvimento no Claude Code (em qualquer computador).
> Leia isto antes de propor qualquer mudança. Detalhes de rotas e regras da OS estão no `README.md`.

## 1. O que é o projeto

**FlexServ** é o sistema de gestão de Ordens de Serviço (OS) e vendas da **TecFlex**, empresa de aparelhos para máquinas de costura industriais e domésticas, com assistência técnica própria. Desenvolvido como Projeto Integrador (Engenharia de Software, UniSATC), mas o sistema em si é **profissional, feito para a empresa**: nenhuma menção acadêmica deve aparecer nas telas.

**Problema resolvido:** a TecFlex controlava as OS em papel, o que causava erro no cálculo manual do valor, letra ilegível e demora para achar OS antigas. O FlexServ digitaliza abertura, aprovação, acompanhamento, cálculo e consulta.

**O cliente usa muito o celular:** o front é mobile-first (barra de navegação inferior no celular, menu lateral no computador).

## 2. Equipe e papéis

| Nome | Papel | Responsabilidade |
|---|---|---|
| Augusto Benedetti | Scrum Master / QA | Kanban, critérios de aceite, testes |
| **Murilo Mandelli da Silva** | **Back-End / DBA** | Banco, API, lógica de servidor (usa o Claude Code) |
| Gabriel Camargo Cardoso Oliveira | Front-End / UI-UX | Interface; é quem sobe o front no GitHub |

## 3. Datas importantes

- 24/11/2026: testes de sistema e aceitação.
- **01/12/2026: apresentação final para a banca avaliadora** (maior nota da disciplina).
- 08/12/2026: entrega do projeto revisado.

## 4. Stack

- **Front-end:** React 19 + TypeScript + Vite + Tailwind v4 + react-router 7; PDF com jspdf/jspdf-autotable; gráficos com recharts.
- **Back-end:** Node.js + Express + TypeScript; validação com zod; JWT (8h) + bcryptjs.
- **Banco:** PostgreSQL 18 no **Neon** (sem Postgres local), via Drizzle ORM 0.45 / drizzle-kit 0.31 (versões antigas quebravam no Postgres 18).
- **Hospedagem:** Vercel, dois projetos separados (ver seção 8).

## 5. Modelo de dados (resumo — o código fica em `backend/src/db/schema.ts`)

| Tabela | Para quê |
|---|---|
| `loja`, `vendedor` | Lojas e usuários (papel `vendedor` ou `gestor`) |
| `cliente` | CPF/CNPJ único, contato e endereço |
| `equipamento` | Máquinas de cada cliente |
| `item` | Catálogo: `peca`, `maquina` ou `mao_de_obra`, com preço e custo |
| `status_os` | Status configuráveis (nome, cor, ordem), cada um ligado a uma **fase** fixa |
| `servico` + `servico_item` | A OS (oficina ou campo) e seus itens |
| `venda` + `venda_item` | Vendas de balcão (sem mão de obra) |
| `aviso_cliente` | Registro do "Já avisei" pelo WhatsApp |

**Decisões que valem defender na banca:**
- **Preço congelado:** valor unitário e custo são copiados para `servico_item`/`venda_item`. Mudar o catálogo não altera OS antigas.
- **Total calculado no banco** (`recalcularTotal`): itens (qtd × preço) − desconto, nunca negativo. O front nunca manda o total.
- **Status livres, regras fixas:** a empresa cria os status que quiser, mas as regras olham a fase (`aberta`, `execucao`, `concluida`, `entregue`, `cancelada`). Regras em `backend/src/services/os.ts`.
- Operações com várias tabelas rodam em **transação**.

## 6. O que já está pronto (testado local e na Vercel)

**Back-end:** login JWT; CRUD de clientes, lojas, vendedores (gestor), itens, equipamentos e status; OS completa (abertura com itens, oficina/campo, aprovação com assinatura do cliente e do técnico, troca de status com regras por fase, pagamento e desconto, avisos); vendas (pagamento, cancelamento, avisos); relatórios por período; seeds (`db:seed` e `db:seed-demo`).

**Front-end:** login, painel inicial, Serviços (nova OS, consulta com filtros, detalhe, gerenciar status), Vendas (nova, lista, detalhe), Relatórios com gráficos, Cadastros; tabelas ordenáveis com exportação em PDF; PDF da OS e da venda com compartilhamento; botão de WhatsApp (link `wa.me`) + "Já avisei"; assinatura na tela.

## 7. Estrutura

```
FlexServ/
├── README.md, CONTEXTO.md, .gitignore
├── backend/
│   ├── .env.example        <- modelo das variáveis (copiar para .env)
│   ├── vercel.json, .vercelignore, configurar-vercel.js
│   └── src/
│       ├── index.ts        <- monta as rotas; exporta o app (Vercel) e só faz listen fora dela
│       ├── db/             <- index.ts (conexão), schema.ts, seed.ts, seed-demo.ts
│       ├── middleware/     <- auth.ts (autenticar, apenasGestor)
│       ├── routes/         <- auth, clientes, lojas, vendedores, itens, equipamentos, status, os, vendas, relatorios
│       ├── services/os.ts  <- regras de fase e cálculo do total
│       └── utils/          <- http.ts (respostas de erro), validacao.ts (schemas zod comuns)
└── frontend/
    ├── vercel.json         <- repassa /api para a API e faz o fallback da SPA
    └── src/                <- pages/, components/, api.ts, auth.tsx, pdf.ts, formatar.ts, types.ts
```

## 8. Ambientes

**Local** (detalhes no README): API em `http://localhost:3333`, front em `http://localhost:5173` (o Vite repassa `/api` para a API). A porta 3333 foi escolhida porque a 3000 conflitava com outro projeto.

**Produção (Vercel):**
- Sistema: https://flexserv-eight.vercel.app
- API: https://flexserv-api.vercel.app (o front chama `/api/...` e a Vercel repassa)
- `DATABASE_URL` e `JWT_SECRET` ficam cadastradas na Vercel, nunca no código.
- **Local e produção usam o mesmo banco Neon.**
- Para publicar uma mudança: `vercel --prod` dentro de `backend/` ou `frontend/`. Em outro PC: `npm i -g vercel`, `vercel login` e `vercel link` em cada pasta (escolher o projeto existente `flexserv-api` ou `flexserv`).

**Usuário de teste:** criado pelo `npm run db:seed` (credenciais em `backend/src/db/seed.ts`). Como o site é público, a senha dele deve ser trocada pelo sistema.

## 9. Convenções

- Banco em `snake_case`, TypeScript em `camelCase` (mapeado pelo Drizzle).
- Senhas sempre com hash bcrypt; o hash nunca é devolvido pela API.
- Erros sempre como `{ "erro": "mensagem em português" }`.
- Datas "de hoje" sempre pela data local (`dataLocalISO` no front, `dataLocal` nos relatórios), nunca `toISOString()` (que usa UTC e erra à noite).
- Windows + PowerShell, sem WSL.

## 10. Como o Murilo trabalha com o Claude Code

**Comandos:**
- **FAÇA:** implementar.
- **ME ENSINE:** guiar passo a passo.
- **CORRIJA:** achar a causa, corrigir e explicar.
- **ANALISE:** analisar sem alterar nada.
- **IMPLEMENTE COMPLETO:** todas as camadas (banco, API, front).

**Regras:**
- **Commits e pushes quem faz é o Murilo.** O Claude só gera o código e coloca nas pastas, passando os comandos quando pedido.
- **O front não é commitado pelo Murilo:** é enviado em zip ao Gabriel, que sobe pela conta dele.
- Decisões estruturais importantes são explicadas antes de executar.
- Não inventar requisitos, campos ou regras não pedidos.
- Explicações curtas, sempre dizendo o que vale defender na banca.
- Ao terminar, informar arquivos alterados e testes feitos.
- **Kanban:** nunca mover card sem trabalho real por trás. O board reflete a realidade.

## 11. Kanban (Jira, projeto FLEX)

https://murilomandelli.atlassian.net/jira/software/projects/FLEX/boards/34

- Cards FLEX-44 a 52: back-end (Murilo).
- Cards FLEX-53 a 60: front-end (Gabriel).
- Cards FLEX-61 a 68: QA (Augusto).
- Os cards "Em análise" vão para "Feito" depois que back e front estiverem no GitHub.

## 12. Pendências

1. Murilo sobe o back-end no GitHub; Gabriel sobe o front (zip `frontend-para-gabriel.zip`).
2. Mover os cards "Em análise" para "Feito".
3. Trocar a senha do usuário de teste em produção.
4. Ideias avaliadas e deixadas para depois:
   - Limitar tentativas de login (5 erros = espera).
   - Carregar as telas do front sob demanda (abre mais rápido no celular).

## 13. Links

- Repositório: https://github.com/MuriloMandelli/FlexServ
- Sistema: https://flexserv-eight.vercel.app
- Kanban: https://murilomandelli.atlassian.net/jira/software/projects/FLEX/boards/34
