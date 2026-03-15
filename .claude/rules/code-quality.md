---
description: Code quality rules — formatting, linting, and pre-commit checks that all agents must follow.
globs:
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.js"
  - "**/*.json"
---

## Before committing or pushing

- **Always run `npx prettier --write .`** before committing any changes
- **Always run `npx tsc --project api/tsconfig.json --noEmit`** when API files were changed
- **Always run `npx tsc --project web/tsconfig.json --noEmit`** when web files were changed
- Verify there are no formatting or type errors before pushing

## Prisma (v7)

- Imports come from `../generated/prisma/client`, NOT `@prisma/client`
- PrismaClient requires a driver adapter: `new PrismaClient({ adapter })`
- Run `cd api && npx prisma generate` after any schema changes
- The `Decimal` type is imported from `@prisma/client/runtime/client`

## Node version

- This project requires Node.js 20+ (see `.nvmrc`)
- Use `source ~/.nvm/nvm.sh && nvm use 20` before running commands if needed
