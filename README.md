# Forja — monitor de hábitos gamificado

Painel de evolução pessoal, mobile-first: hábitos (compromissos semanais), tarefas (ações pontuais), nota diária explicável, histórico, visão semanal, **habilidades que evoluem e enferrujam** (nível, condição e maestria) e uma base de gamificação (XP, níveis, atributos, conquistas, recursos) preparada para recompensas.

> Marca: o logo original fica em `public/forja-logo.png`; as variações usadas pelo app (símbolo, logo para tema claro/escuro, favicons e ícone do iOS) ficam em `public/brand/` e são referenciadas em `src/components/brand.tsx` e `index.html`.

## Rodando

Requer Node.js 20.19+ (ou 22+).

```bash
npm install
npm run dev        # http://localhost:5180
```

| Script | O que faz |
| --- | --- |
| `npm run dev` | servidor de desenvolvimento |
| `npm run build` | typecheck + build de produção em `dist/` |
| `npm run preview` | serve o build |
| `npm test` | testes da camada de domínio e dos comandos (Vitest) |
| `npm run typecheck` | TypeScript estrito |
| `npm run lint` | oxlint |

No primeiro acesso, escolha **Explorar com dados de exemplo** para ver ~5 semanas simuladas (histórico, sequência, conquistas) ou **Começar** para partir do zero. Em *Perfil → Ajustes* dá para trocar tema, exportar/importar backup JSON, recarregar os exemplos ou apagar tudo.

### Contas e nuvem

Com as variáveis do Supabase definidas (copie `.env.example` para `.env.local`), o app exige **login com Google** e sincroniza os dados com o Supabase — local-first: funciona offline e envia quando a conexão volta. Sem elas, roda em **modo local** (dados só no `localStorage`, como na v1). No primeiro login, se houver dados da versão sem conta no navegador, o app oferece importá-los.

O schema do banco (tabelas + Row Level Security) está em `supabase/migrations/`. Detalhes em [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md#6c-contas-e-nuvem-supabase--google).

## Stack

React 19 · Supabase (Auth + Postgres) · TypeScript (strict + `noUncheckedIndexedAccess`) · Vite · Tailwind CSS v4 · shadcn/ui (Radix) · Zustand · React Router · date-fns · motion · Vitest.

Os componentes base do shadcn/ui estão em `src/components/ui` (`components.json` configurado — `npx shadcn add <componente>` funciona normalmente).

## Arquitetura

Veja [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — fluxos, modelo de domínio, fórmula da nota, gamificação e como estender.
