# Agent Swarm Monorepo

A multi-agent development framework for building full-stack applications with Express, React, Expo, and PostgreSQL. An AI agent team — led by a Team Lead/Architect — collaboratively builds, tests, and deploys the application through structured phases with human oversight.

## Agent Team

| Agent                  | File                           | Role                                                                                                             |
| ---------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| Team Lead / Architect  | `AGENTS.md`                    | Primary orchestrator. Plans, reviews PRs, merges to `main`, manages backlog and CI. Does not write feature code. |
| Full Stack Developer A | `agents/developer-a.md`        | Implements features (API + web + mobile) on feature branches.                                                    |
| Full Stack Developer B | `agents/developer-b.md`        | Same as Developer A. Coordinates schema changes with Team Lead.                                                  |
| QA Engineer            | `agents/qa-engineer.md`        | Writes Playwright (web) and Maestro (mobile) E2E tests. Never modifies app code.                                 |
| Security Expert        | `agents/security-expert.md`    | Reviews code for security vulnerabilities. Raises findings as GitHub Issues.                                     |
| Performance Expert     | `agents/performance-expert.md` | Reviews code for performance issues. Raises findings as GitHub Issues.                                           |

## How to Spawn Each Agent

Each agent file is a self-contained instruction set. To spawn an agent, provide its file as context to your agentic coding tool:

```
# Team Lead — start here
Attach AGENTS.md as context and instruct it to begin Phase 1.

# Developers — spawned by the Team Lead when assigning issues
Attach agents/developer-a.md (or developer-b.md) as context.

# QA Engineer — spawned after features merge
Attach agents/qa-engineer.md as context.

# Security / Performance — spawned for sweep reviews
Attach agents/security-expert.md or agents/performance-expert.md as context.
```

## Development Workflow

### Phases

1. **Phase 1 — Read and Plan:** Team Lead reads the project functional spec, presents understanding, and waits for human confirmation.
2. **Phase 2 — Monorepo and Tooling Setup:** Initialize repo structure, TypeScript, ESLint, Prisma schema, seed data, MUI theme, shared design tokens.
3. **Phase 3 — CI/CD and Infrastructure:** Set up GitHub Actions (`ci-checks.yml`, `pr-validation.yml`, `deploy-main.yml`), branch protection, health endpoint. CI must be green before any feature work.
4. **Phase 4 — Backlog Creation:** Create all GitHub Issues for all delivery slices. Human reviews and confirms before development starts.
5. **Phase 5 — Active Development:** Slice-by-slice delivery. Team Lead assigns 2–3 issues per developer, reviews PRs, creates QA issues after each feature merge. Pause at end of each slice for human review.
6. **Phase 6 — Deployment:** Configure Render (API), Vercel (web), EAS (mobile). Confirm all secrets. Deploy.

### Human Check-in Points

The Team Lead pauses after every phase and at the end of every slice to present a summary and get human confirmation before proceeding. Autonomous mode can be unlocked by the human at any time.

## How to Start a Project

1. **Add your project functional spec** — a document defining the data model, architecture decisions, user journeys, and delivery slices for the product you want to build.
2. **Spawn the Team Lead** — attach `AGENTS.md` and your functional spec as context, then instruct it to begin Phase 1.
3. **Review and confirm** at each phase checkpoint before the Team Lead proceeds.

## Tech Stack

| Layer          | Technology                                       |
| -------------- | ------------------------------------------------ |
| API            | Node.js + TypeScript + Express                   |
| ORM            | Prisma                                           |
| Database       | PostgreSQL                                       |
| Job queue      | PostgreSQL-backed (no Redis)                     |
| Web            | React + TanStack Router + TanStack Query         |
| Web styling    | Material UI (MUI v5+)                            |
| Mobile         | Expo (managed) + React Native + React Navigation |
| Mobile styling | NativeWind or React Native StyleSheet            |
| Design tokens  | `shared/theme/tokens.ts`                         |
| Validation     | Zod                                              |
| Web E2E        | Playwright                                       |
| Mobile E2E     | Maestro                                          |
| CI/CD          | GitHub Actions                                   |
| Task tracking  | GitHub Issues (`gh` CLI)                         |

## Monorepo Structure

```
project-root/
├── .github/workflows/       # CI/CD pipelines
├── api/                     # Express API (routes, controllers, services, repositories)
│   ├── src/
│   ├── prisma/              # Schema, migrations, seed
│   └── tests/
├── web/                     # React web app (MUI)
│   ├── src/
│   └── tests/e2e/           # Playwright (regression + demo)
├── mobile/                  # Expo React Native app
│   ├── src/
│   └── tests/e2e/           # Maestro (flows + demo)
├── shared/                  # Types, hooks, API client, design tokens
├── agents/                  # Agent definition files
├── AGENTS.md                # Team Lead agent definition
└── README.md
```
