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

Os dados ficam no `localStorage` do navegador (chave `forja.data`). Nada é enviado para servidores.

## Stack

React 19 · TypeScript (strict + `noUncheckedIndexedAccess`) · Vite · Tailwind CSS v4 · shadcn/ui (Radix) · Zustand · React Router · date-fns · motion · Vitest.

Os componentes base do shadcn/ui estão em `src/components/ui` (`components.json` configurado — `npx shadcn add <componente>` funciona normalmente).

## Arquitetura

Veja [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — fluxos, modelo de domínio, fórmula da nota, gamificação e como estender.
