# Padrão de Commits (Conventional Commits)

| Prefixo     | Efeito no SemVer       | Quando usar                                |
|-------------|------------------------|--------------------------------------------|
| `feat:`     | minor (0.1.0 → 0.2.0)  | Nova funcionalidade                        |
| `fix:`      | patch (0.1.0 → 0.1.1)  | Correção de bug                            |
| `feat!:`    | major (0.1.0 → 1.0.0)  | Mudança incompatível (breaking change)     |
| `perf:`     | patch                  | Melhoria de performance                    |
| `refactor:` | nenhum (aparece no log)| Refatoração sem mudança de comportamento   |
| `docs:`     | nenhum                 | Documentação                               |
| `test:`     | nenhum (oculto)        | Testes                                     |
| `chore:`    | nenhum (oculto)        | Build, deps, manutenção                    |

## Exemplos

```
feat: adiciona alerta de BL01 para programas com "BL 02"
fix: corrige programa da noite engolindo madrugada na grade semanal
refactor: extrai timeToSec para módulo próprio
feat!: nova estrutura de peças fixas (breaking change)
```

## Fluxo automático

1. Push na `main` com commits no padrão acima.
2. A Action **Release Please** abre um PR "chore: release X.Y.Z" com o CHANGELOG atualizado.
3. Merge do PR → cria a tag `vX.Y.Z` e a Release no GitHub.

## Setup único no GitHub

Settings → Actions → General → Workflow permissions:
- [x] Read and write permissions
- [x] Allow GitHub Actions to create and approve pull requests
