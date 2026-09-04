# Canaledu — Roteiro Canal Educação

Cadastro de peças/programas + confecção do roteiro diário do Canal Educação (MEC),
usado por uma equipe pequena trabalhando simultaneamente em navegadores diferentes,
com backend Supabase (Postgres + Auth + Realtime).

## Documentação

| Arquivo | Conteúdo |
|---|---|
| **[DOCUMENTACAO.md](DOCUMENTACAO.md)** | Documentação técnica completa — arquitetura, autenticação, banco de dados, sincronização multiusuário, log de atividades, confecção do roteiro, testes, deploy e riscos conhecidos. **Comece por aqui.** |
| [DEPLOY.md](DEPLOY.md) | Passo a passo para colocar o sistema no ar (Supabase + hospedagem) |
| [CONSISTENCIA.md](CONSISTENCIA.md) | Correções de concorrência multiusuário — banco e front-end |
| [AUTENTICACAO.md](AUTENTICACAO.md) | Detalhes do fluxo de login único |
| [db/README.md](db/README.md) | Migrações SQL — o que cada uma faz e como aplicar |
| [CHANGELOG.md](CHANGELOG.md) | Histórico de versões |
| [ANALISE.md](ANALISE.md) | Revisão do projeto e propostas de melhoria futura, por área e priorizadas |
| [MVP-CADASTRO.md](MVP-CADASTRO.md) | Proposta de consolidação do modelo de dados do cadastro e das regras de distribuição automática — aguardando aprovação |
| [PROMPT-IMPLEMENTACAO-CADASTRO.md](PROMPT-IMPLEMENTACAO-CADASTRO.md) | Índice dos prompts de implementação do MVP acima, um por fase |
| [PROMPT-FASE-1-SCHEMA-FORMULARIO.md](PROMPT-FASE-1-SCHEMA-FORMULARIO.md) | Fase 1 — ✅ concluída (`2.8.0`) |
| [PROMPT-FASE-2-MOTOR-DISTRIBUICAO.md](PROMPT-FASE-2-MOTOR-DISTRIBUICAO.md) | Fase 2 — aguardando aprovação |
| [PROMPT-FASE-3-IMPORT-ESTRUTURADO.md](PROMPT-FASE-3-IMPORT-ESTRUTURADO.md) | Fase 3 — aguardando Fase 2 |
| [PROMPT-FASE-4-LIMPEZA.md](PROMPT-FASE-4-LIMPEZA.md) | Fase 4 — aguardando Fase 3 em produção por um tempo |
| [COMMITS.md](COMMITS.md) | Convenção de mensagens de commit usada no projeto |

## Início rápido (desenvolvimento)

```bash
npm install
npm test          # testes unitários
npm run test:db   # testes de integração contra um Postgres real (PGlite)
```

Para rodar o sistema, preencha `supabase-config.js` (ver DEPLOY.md) e sirva os
arquivos `.html` por qualquer servidor estático — não há build step.

Licença: GNU GPL v3 — Canal Educação / MEC.
