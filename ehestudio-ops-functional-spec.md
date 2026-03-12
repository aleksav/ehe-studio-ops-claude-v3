# EHEStudio Ops — Functional Spec

> Pair this document with the Claude Code Engineering Guide. This spec covers only what is specific to EHEStudio Ops: the product vision, data model, business rules, user journeys, and delivery slices. All agent roles, coding patterns, git workflow, CI setup, and deployment standards are defined in the Engineering Guide.

---

## Product Overview

EHEStudio Ops is a lightweight operational system for a studio team. It combines project management, task tracking, time logging, and commercial spend visibility in a single product.

**Modules:** `api`, `web`, and `mobile`.

**Access model:** flat — no roles, no project membership. Every authenticated user has full access to all features and all data. `role_title` on TeamMember is a display-only label that controls nothing. Any user can log time against any project, view any project in the standup view, and access all projects freely.

---

## Data Model

### Entities

**TeamMember**
```
id                    UUID PK
full_name             TEXT NOT NULL
email                 TEXT NOT NULL UNIQUE
role_title            TEXT              display label only
preferred_task_type   task_type         nullable — default task type pre-filled in logging forms
is_active             BOOLEAN DEFAULT TRUE
created_at            TIMESTAMPTZ
updated_at            TIMESTAMPTZ
```

`preferred_task_type` pre-fills all time logging forms for this user. It is overridable per entry. Whenever a user submits an entry with a different task type, update `preferred_task_type` on their record to the new value.

**Project**
```
id             UUID PK
name           TEXT NOT NULL
description    TEXT
status         ENUM: PLANNED | ACTIVE | COMPLETED | ARCHIVED
start_date     DATE
end_date       DATE
budget_type    ENUM: NONE | CAPPED | TRACKED_ONLY
budget_amount  NUMERIC(12,2)
currency_code  CHAR(3) DEFAULT 'GBP'
created_at     TIMESTAMPTZ
updated_at     TIMESTAMPTZ
```

**Milestone**
```
id          UUID PK
project_id  → Project
name        TEXT NOT NULL
due_date    DATE   optional — sole ordering mechanism, always ASC NULLS LAST
created_at  TIMESTAMPTZ
updated_at  TIMESTAMPTZ
```

**Task**
```
id           UUID PK
project_id   → Project
milestone_id → Milestone  optional
description  TEXT NOT NULL
status       ENUM: TODO | IN_PROGRESS | DONE | CANCELLED
started_at   TIMESTAMPTZ   set to NOW() the first time status moves to IN_PROGRESS; never overwritten on subsequent transitions
completed_at TIMESTAMPTZ   set to NOW() when status moves to DONE; cleared (set to NULL) if task is moved back out of DONE
created_at   TIMESTAMPTZ
updated_at   TIMESTAMPTZ
```

**TaskAssignment**
```
id               UUID PK
task_id          → Task
team_member_id   → TeamMember
created_at       TIMESTAMPTZ
UNIQUE (task_id, team_member_id)
```

One task can be assigned to multiple team members. Zero assignees is valid.

**TimeEntry**
```
id               UUID PK
project_id       → Project
team_member_id   → TeamMember
date             DATE NOT NULL        cannot be in the future — enforced server-side
hours_worked     NUMERIC(8,2)         must be > 0
task_type        task_type NOT NULL
notes            TEXT                 optional
created_at       TIMESTAMPTZ
updated_at       TIMESTAMPTZ
```

**TaskRate**
```
id             UUID PK
task_type      ENUM: ARCHITECTURE_ENGINEERING_DIRECTION | DESIGN_DELIVERY_RESEARCH |
                     DEVELOPMENT_TESTING | BUSINESS_SUPPORT
day_rate       NUMERIC(12,2) NOT NULL
currency_code  CHAR(3) DEFAULT 'GBP'
effective_from DATE NOT NULL
effective_to   DATE   null = currently active
created_at     TIMESTAMPTZ
```

**AuditLog**
```
id             UUID PK
entity_type    TEXT NOT NULL
entity_id      UUID NOT NULL
action         TEXT NOT NULL    CREATE | UPDATE | DELETE
actor_id       UUID → TeamMember
changed_fields JSONB            UPDATE: { field: { before, after } }
                                CREATE: { after: <full entity snapshot> }
                                DELETE: { before: <full entity snapshot> }
created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

Every mutation writes an AuditLog entry atomically in the same transaction. For CREATE and DELETE, `changed_fields` stores the full entity state as `after` and `before` respectively, enabling complete history reconstruction.

---

### Business rules

**Daily hours cap** — applies across all projects for a given `(team_member_id, date)`, enforced server-side on all three time entry methods:
- New total > 8 h: return a warning in the response (`meta.warning`). Submission allowed.
- New total ≥ 12 h: reject with HTTP 422 `DAILY_HOURS_EXCEEDED`. Submission blocked.
- Multiple entries per `(project_id, team_member_id, date)` are permitted.
- `date` cannot be in the future.

Implement a shared service function:
```typescript
getDailyHoursTotal(teamMemberId: string, date: Date, excludeEntryId?: string): Promise<number>
```
Call this from all three entry creation/edit endpoints before writing.

**TaskRate gap validation** — when saving a TaskRate record (create or update), the API must verify that no gap exists in coverage for that `task_type` across all effective date ranges. Specifically:

- For a given `task_type`, sort all non-overlapping rate records by `effective_from`. The `effective_to` of each record (exclusive end) must equal the `effective_from` of the next. The most recent record must have `effective_to = NULL` (open-ended).
- A new rate closes the previous open-ended record: the API automatically sets `effective_to` on the currently active rate to `new_rate.effective_from - 1 day` when a new rate is created.
- Gaps are never permitted. If a submitted rate would introduce a gap (i.e. its `effective_from` is later than the day after the previous rate's `effective_to`), reject with HTTP 422 `TASK_RATE_GAP`.
- Overlaps are never permitted. If the submitted range overlaps an existing rate for the same `task_type`, reject with HTTP 422 `TASK_RATE_OVERLAP`.
- Deleting a TaskRate record that is not the current active one is only permitted if the adjacent records can be merged without a gap (i.e. the preceding record's `effective_to + 1 day` equals the following record's `effective_from`). If a gap would result, reject with HTTP 422 `TASK_RATE_DELETE_WOULD_GAP`.
- The seed data must establish a gapless rate history for all four task types from a fixed past date through to the present (open-ended).

**Cost calculation** — `cost_amount = hours_worked / 8.0 × day_rate`. Join `time_entries` to `task_rates` by `task_type` where the entry `date` falls within `effective_from`–`effective_to`. Aggregation always in the database with `SUM()`, never in application memory. If no matching TaskRate exists for a given entry (which gap validation makes impossible under normal operation), surface the anomaly explicitly in the budget summary rather than silently returning zero.

**Project budget summary** — aggregate `cost_amount` per project to produce `actual_spend` and `budget_remaining`.

**Preferred task type** — updated to the override value any time any entry method submits with a task type that differs from the user's current `preferred_task_type`.

---

### Seed data

3 team members (each with a `preferred_task_type`), 2 active projects, 3 milestones per project (one past due, one near, one far), tasks in mixed statuses with assignments, TaskRates for all four task types.

---

## Authentication

Register, login, refresh, logout. All endpoints require authentication. No public endpoints beyond register and login.

**Allowed email domains:** only `@ehe.ai`, `@tsf.tech`, and `@thestartupfactory.tech` may register. Registration with any other domain must be rejected with HTTP 403. Configurable via `ALLOWED_EMAIL_DOMAINS` environment variable (comma-separated, defaults to `ehe.ai,tsf.tech,thestartupfactory.tech`).

---

## Core Entity Management

Standard CRUD for: TeamMember, Project, Milestone (scoped to project), Task (scoped to project, optionally to milestone), TaskAssignment (assign/unassign members), TaskRate (versioned day rates).

Task status transitions: any column → any other column (TODO, IN_PROGRESS, DONE, CANCELLED). CANCELLED tasks are never surfaced in any view.

---

## Time Logging — Three Entry Methods

All three methods create `TimeEntry` records and share the same daily hours cap validation and `preferred_task_type` update rule.

---

### Method 1 — Quick Entry

**Purpose:** fast daily logging for one project at a time.

**Flow:**
1. User opens the time logging page. All projects listed — no filter.
2. User selects a project.
3. Form appears: date (defaults to today), hours, task type (pre-filled from `preferred_task_type`, overridable), optional notes.
4. Daily cap validation runs on submit. If task type differs, update `preferred_task_type`.
5. > 8 h: yellow warning banner, submission allowed. ≥ 12 h: red error, blocked.
6. On success: entry appears in the list. Multiple entries per project per day are shown.

**Entry list:** grouped by date descending. Daily total per group. Running project total at top.

**Web layout:** project selector → form panel → entry list below.
**Mobile layout:** project select screen → form screen → entry list screen.

---

### Method 2 — Log Time from Standup Card

**Purpose:** log time for any user directly from the standup board without leaving the view.

**Trigger:** a "Log Time" icon button on every task card.

**Flow:**
1. Click Log Time on a card. Modal opens pre-populated with the task's project.
2. Fields: user selector (any active team member), task type (pre-filled from selected user's `preferred_task_type`), date (today), hours, optional notes.
3. Changing the selected user updates the task type pre-fill to that user's `preferred_task_type`.
4. Daily cap validation runs for the selected user on the selected date.
5. On success: modal closes, success snackbar. If task type overridden, update the selected user's `preferred_task_type`.

**Web:** MUI `Dialog`. **Mobile:** bottom sheet.

---

### Method 3 — Weekly Grid

**Purpose:** batch logging across multiple projects for a full week.

**Grid structure:**
- Rows: one per project the user has added to their grid
- Columns: Mon–Sun of the selected week, plus a row total column
- Cells: hours input + task type selector per (project × day)
- Row header: project name, week total
- Column header: day name + date (e.g. "Mon 3 Jun"), daily total across all rows
- Footer: weekly grand total

**Interactions:**
- Add Project button → project selector → new row appended
- Remove a row
- Edit hours and task type in cells. Cell saves on blur (optimistic update).
- Prev/next week navigation. Selected week in URL query string (`?week=2024-W23`) — shareable. The week parser must correctly handle ISO year boundaries: the week containing 1 Jan may belong to the previous ISO year (e.g. `2026-W53` → `2015-W01`). Use an ISO-8601-compliant week library; do not hand-roll week arithmetic.

**Persistence (localStorage — client-side only, never persisted server-side):**
- `weekly_grid_projects` — list of project rows the user has added. Persists across week navigation and browser sessions. No server equivalent exists and none will be added.
- `weekly_grid_task_types` — per-project task type selection in the grid. Separate from `preferred_task_type`.
- Hours cells pre-fill from API for the displayed week. Empty if no entry exists.
- Submitting a cell updates `preferred_task_type` if task type differs.

**Cap behaviour:**
- Column total > 8 h: amber tint on column header, tooltip warning.
- Column total ≥ 12 h: red tint on cell being edited, saving blocked.

**Mobile layout:** scrollable list of days instead of a table. Each day is a collapsible header showing date and day total. Project rows within each day open an inline edit or bottom sheet. Week navigation via swipe or prev/next buttons.

**Tablet (web ≤768px):** daily accordion or horizontal scroll with fixed project name column. Never squish the table.

---

## Standup View

The flagship feature. Implement with exceptional care.

### Project selector

Top of the view. Filters to one active project at a time. Switching is reactive — no page reload.

---

### Kanban board

| Column | Content |
|---|---|
| TODO | Tasks with status TODO |
| IN PROGRESS | Tasks with status IN_PROGRESS |
| DONE | Tasks with status DONE, where `completed_at` is within the last 7 days |

**Web:** drag-and-drop with `@dnd-kit/core` + `@dnd-kit/sortable`. Any column → any other column. Status updates optimistically, persists via API.

**Mobile:** tap-to-cycle button on each card (TODO → IN_PROGRESS → DONE → TODO).

**Card content:**
- Task description, truncated to 2 lines
- Milestone name + due date (if assigned)
- Assignee avatars or name chips
- Total hours logged on the project this week
- Log Time icon button → opens Method 2 modal pre-populated with this task's project
- Stale indicator (amber clock icon): task is TODO or IN_PROGRESS and no time logged on the project in the last 5 working days by any assigned member
- Overdue milestone indicator (red chip): task's milestone `due_date` is in the past

---

### View toggle

A `ToggleButtonGroup` at the top right switches between View A and View B. Same underlying data. Preference stored in `localStorage` under key `standup_view_preference`. Transition with MUI `Fade`.

---

### View A — Milestone-grouped Kanban

Delivery-oriented.

- Milestones as horizontal swimlane sections, ordered `due_date ASC NULLS LAST`
- Swimlane header: milestone name, due date, overdue indicator if applicable
- Within each swimlane: three Kanban columns (TODO / IN PROGRESS / DONE) side by side
- Cards are draggable within their column and swimlane
- "No Milestone" swimlane at the bottom for unassigned tasks
- Swimlanes collapsible on header click
- Column headers sticky at viewport top while scrolling
- Swimlane headers: strong left border in EHE pink
- Overdue milestone headers: amber/red chip with due date — never pink or blue for warnings

---

### View B — People-grouped board

Team-oriented.

- Each team member with at least one assigned task as a horizontal row/section
- Within each row: three columns (TODO / IN PROGRESS / DONE)
- Row header: person name, avatar initial, total hours logged this week
- Tasks assigned to multiple people appear in each person's row
- "Unassigned" row at the bottom
- Milestone name shown as a small label on each card
- Person row headers: EHE blue
- Amber tint on row header if the person has IN_PROGRESS tasks but no time logged on any project in the last 5 working days
- Empty columns show a subtle empty state (e.g. "Nothing in progress")

---

### Stale and overdue rules

All computed as DB queries — never in-memory filtering.

| Indicator | Condition | Visual |
|---|---|---|
| Stale task | Has at least one assignee AND status is TODO or IN_PROGRESS AND no time entry on the project in the last 5 working days by any assigned member | Amber clock icon on card |
| Overdue milestone | `due_date < today` AND at least one TODO or IN_PROGRESS task exists | Red chip on milestone header (View A); small badge on affected cards (View B) |
| Stale person row | Person has IN_PROGRESS tasks but no time logged on any project in the last 5 working days | Amber tint on row header (View B only) |

**Colour rule: amber = stale. Red = overdue. Never pink or blue for warnings.**

---

## Commercial Visibility

### Budget and spend summary

Per project. Display `budget_amount`, `actual_spend`, `budget_remaining`. Available for projects with `budget_type` CAPPED or TRACKED_ONLY. Cost formula: `hours_worked / 8.0 × day_rate` joined to the active TaskRate by task type and date.

### Audit log viewer

Paginated, filterable list of AuditLog records. Filters: entity_type, action, actor, date range. Each row: timestamp, actor, entity type, entity id, action, before/after diff.

### Personal dashboard

Assigned tasks for the current user, their recent time entries and daily totals, active project summaries (spend, hours this week).

All three views (budget summary, audit log, personal dashboard) are available on both web and mobile with full feature parity.

---

## Brand and UI

**Product name:** EHEStudio Ops — consistent everywhere.

**Colour palette:**
- Primary (EHE pink): `#E91E8C`
- Secondary (EHE blue): `#1E6FE9`
- Background: `#FFFFFF`
- Text: `#0D0D0D`
- Dividers: `#E5E5E5`
- Warning / stale: amber `#F59E0B`
- Error / overdue / cap exceeded: red `#DC2626`

**Typography:** no Inter, Roboto, Arial, or system-ui. Choose a distinctive editorial pairing — geometric sans for headings, refined humanist sans for body. Team Lead selects and documents the pairing before any UI work begins in Slice 1. Define in `web/src/theme/index.ts` and `shared/theme/tokens.ts`. If no pairing is selected before Slice 1 UI work begins, default to **DM Sans** (headings) + **Source Sans 3** (body) — both available on Google Fonts — and document this as the confirmed choice.

**Layout feel:** rounded cards (`borderRadius: 12`), spacious padding, strong action hierarchy. Polished and editorial, not enterprise-heavy. Colour accents sparse and intentional.

---

## Delivery Slices

### Slice 1 — Foundation
- Monorepo scaffold, MUI ThemeProvider with EHEStudio Ops palette and typography
- Prisma schema, migrations, seed data
- JWT auth: register, login, refresh, logout
- TeamMember CRUD including `preferred_task_type`
- Project CRUD with budget config
- Milestone CRUD per project
- Task CRUD with milestone assignment
- TaskAssignment: assign/unassign multiple members per task
- TaskRate management (versioned day rates by task type)
- `getDailyHoursTotal` shared service function
- AuditLog model and `writeAudit` utility wired into all mutations from day one

### Slice 2 — Time Logging
- Method 1: quick entry page — project selector, pre-filled task type form, daily validation, entry list
- Method 2: log time from standup card — modal with user selector, pre-filled task type, daily validation
- Method 3: weekly grid — project rows, day columns, hours + task type per cell, add/remove rows, week navigation with URL state, localStorage persistence, daily cap warnings and blocking, mobile daily accordion
- Preferred task type update rule applied consistently across all three methods
- Web and mobile implementations

### Slice 3 — Standup View
- Kanban board: TODO / IN PROGRESS / DONE
- DONE column: last 7 days only
- Drag-and-drop on web (`@dnd-kit`), tap-to-cycle on mobile
- Log Time button on every card → Method 2 modal
- Stale task and overdue milestone indicators
- Project switcher (no page reload)
- View A: milestone-grouped swimlanes, collapsible, sticky column headers
- View B: person-grouped rows, hours, stale row highlight
- View toggle, preference in `localStorage`, MUI `Fade` transition

### Slice 4 — Commercial Visibility, Hardening, Deployment
- Budget and spend summary per project
- Audit log viewer: filterable, paginated
- Personal dashboard
- QA agent full E2E sweep including responsive layout tests
- Security sweep
- Performance sweep: `EXPLAIN ANALYZE` on standup view query and weekly grid query
- Deployment: secrets request, GitHub Actions, Render (API), Vercel (web), mobile build prep

---

## P0 Journeys

Each journey requires both a Playwright test (web) and a Maestro flow (mobile) unless marked **web only**. Mobile-specific behaviour is called out explicitly where the interaction differs from web.

---

### Auth

1. User registers and logs in
   - _Mobile:_ form screens navigate correctly; token persisted in `expo-secure-store`; app lands on dashboard screen after login
2. User logs out
   - _Mobile:_ session cleared from `expo-secure-store`; app returns to login screen

---

### Entity setup

3. User creates a team member with a preferred task type
4. User creates a project with budget
5. User creates a milestone with a due date
6. User creates a task under a milestone
7. User assigns multiple team members to a task
8. User updates task status

---

### Method 1 — Quick Entry

9. Logs time with task type override → override becomes new preferred type → daily total correct
   - _Mobile:_ three-screen flow (project select → form → entry list); keyboard dismissed correctly on submit; entry visible in list on the third screen
10. Warning shown when entry would push daily total above 8 h
    - _Mobile:_ warning displayed inline on the form screen before or after submit; form remains submittable
11. Submission blocked when entry would reach 12 h
    - _Mobile:_ error displayed inline on form screen; submit button disabled or tap produces error; no entry created
12. Multiple entries per project per day allowed and listed
    - _Mobile:_ entry list screen shows all entries for the day with correct daily total

---

### Method 2 — Log Time from Standup Card

13. Bottom sheet opens from card tap, different user selected, task type adjusts, entry saves under selected user
    - _Mobile:_ Log Time tap on card opens a bottom sheet (not a full-screen modal); user selector scrollable within sheet; sheet dismisses on success with a toast confirmation; back-button/swipe-down dismisses without saving

---

### Method 3 — Weekly Grid

14. Add project row, enter hours + task type in multiple cells, navigate to previous week — entries persist; navigate back — project rows preserved
    - _Mobile:_ day list renders with collapsible day headers; tapping a project row within a day opens bottom sheet for hours and task type; week navigation uses swipe gesture or prev/next buttons; project rows persist across week navigation
15. Daily cap warning at > 8 h; entry blocked at ≥ 12 h
    - _Mobile:_ warning shown in the day header when daily total exceeds 8 h; bottom sheet shows error and blocks save when entry would reach 12 h

---

### Standup View

16. Standup view loads — tasks in correct columns, DONE shows last 7 days only
    - _Mobile:_ all three columns visible (scrollable horizontally or stacked); DONE column filtered correctly
17. Task status updated via tap-to-cycle — persists after app restart
    - _Web:_ drag task from TODO to IN PROGRESS — status persists after page reload
    - _Mobile:_ tap-to-cycle button advances status TODO → IN_PROGRESS → DONE → TODO; status confirmed via API after each tap; verified correct after app cold restart
18. Log Time bottom sheet opens from card tap with correct project pre-filled
    - _Web:_ Log Time button on card opens Method 2 dialog
    - _Mobile:_ Log Time tap opens bottom sheet; project field pre-filled; sheet dismisses correctly on success and on cancel
19. Stale indicator visible on a qualifying card
20. Overdue milestone indicator visible
21. Toggle between View A and View B — both render correctly, preference persists after reload
    - _Mobile:_ toggle control switches layout; preference survives app close and reopen

---

### Commercial

22. User reviews project spend against budget
    - _Mobile:_ budget summary screen shows `budget_amount`, `actual_spend`, and `budget_remaining`; projects with `NONE` budget type are excluded
23. Audit log records create and update actions with actor and changed fields
    - _Mobile:_ audit log list is paginated and filterable by entity_type, action, actor, and date range; each row shows timestamp, actor, entity type, entity id, action, and before/after diff

---

### Layout

24. All P0 web journeys pass responsive layout checks at 360px, 768px, and 1280px
25. All P0 mobile journeys pass layout checks on iPhone SE (375pt) and iPhone Pro Max (430pt) — no clipped text, all touch targets ≥ 44pt, no content behind safe area, all scroll containers reach content bottom

---

## Deployment

### Hosting targets

| Module | Platform |
|---|---|
| API | Render |
| Web | Vercel |
| Mobile (iOS) | Apple App Store via EAS Build + EAS Submit |
| Mobile (Android) | Google Play Store via EAS Build + EAS Submit |
| Mobile OTA updates | Expo Updates (`expo-updates`) via EAS Update |

---

### Expo / EAS setup (Team Lead responsibility, before Slice 4)

Configure three EAS build profiles in `mobile/eas.json`:

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": { "simulator": true }
    },
    "test": {
      "developmentClient": true,
      "distribution": "internal",
      "env": { "APP_ENV": "test" }
    },
    "production": {
      "distribution": "store",
      "env": { "APP_ENV": "production" }
    }
  },
  "submit": {
    "production": {
      "ios": { "appleId": "APPLE_ID_FROM_ENV", "ascAppId": "ASC_APP_ID_FROM_ENV" },
      "android": { "serviceAccountKeyPath": "./google-play-key.json", "track": "internal" }
    }
  }
}
```

`app.json` must define:
- `expo.ios.bundleIdentifier` — e.g. `com.ehestudio.ops`
- `expo.android.package` — e.g. `com.ehestudio.ops`
- `expo.updates.url` — EAS Update endpoint for OTA
- `expo.runtimeVersion.policy: "appVersion"` — ties OTA updates to app version

---

### CI/CD pipelines — project-specific behaviour

The Engineering Guide defines the standard `pr-validation.yml` and `deploy-main.yml` structure. The following additions apply to this project:

**`pr-validation.yml` — mobile-e2e job:**
- Run `eas build --local --profile test --platform ios` to produce a test build
- Boot iOS simulator, reset test DB seed, run `maestro test mobile/tests/e2e/flows/`
- Upload Maestro recordings as artifact `mobile-e2e-recordings`
- This job is a required check — PRs cannot merge if it fails

**`deploy-main.yml` — on merge to `main`:**
- After API and web deploy, run `eas update --branch production --message "deploy: $COMMIT_SHA"` to push an OTA update to production devices
- OTA update is only safe for JS-layer changes. If native dependencies changed in this release, skip OTA and trigger a full store build instead: `eas build --platform all --profile production --auto-submit`
- The Team Lead must judge per-merge whether a full store build is required. Document the decision in the merge commit message.

---

### Required secrets

Before Slice 4 begins, the Team Lead must output this list and wait for explicit user confirmation before configuring anything:

```
# API
DATABASE_URL                  Production PostgreSQL connection string
JWT_SECRET                    HS256 secret (min 256 bits) or RS256 key pair

# Web (Vercel)
VERCEL_TOKEN                  Vercel personal access token
VERCEL_ORG_ID                 Vercel organisation ID
VERCEL_PROJECT_ID             Vercel project ID for the web module

# API (Render)
RENDER_DEPLOY_HOOK_URL        Render deploy hook URL for the API service

# Mobile (EAS)
EXPO_TOKEN                    EAS / Expo account token (used by eas CLI in CI)

# Mobile — iOS store submission
APPLE_ID                      Apple ID email for App Store Connect
ASC_APP_ID                    App Store Connect app ID (numeric)
ASC_API_KEY_ID                App Store Connect API key ID
ASC_API_KEY_ISSUER_ID         App Store Connect API key issuer ID
ASC_API_KEY_BASE64            App Store Connect API private key (.p8), base64-encoded

# Mobile — Android store submission
GOOGLE_PLAY_SERVICE_ACCOUNT_KEY_BASE64   Google Play service account JSON key, base64-encoded
```

**Note on Apple credentials:** the `ASC_API_KEY_BASE64` secret must be decoded in the CI step and written to a temp file before `eas submit` runs. Add this step to `deploy-main.yml`:

```yaml
- name: Decode App Store Connect API key
  run: |
    echo "$ASC_API_KEY_BASE64" | base64 --decode > /tmp/asc-api-key.p8
  env:
    ASC_API_KEY_BASE64: ${{ secrets.ASC_API_KEY_BASE64 }}
```

**Note on Google Play credentials:** same pattern — decode `GOOGLE_PLAY_SERVICE_ACCOUNT_KEY_BASE64` and write to `/tmp/google-play-key.json`. Reference this path in `eas.json` `submit.production.android.serviceAccountKeyPath` by setting it via env var in the CI step.

Do not proceed with any deployment configuration until the user explicitly confirms all secrets are available.

## Performance — Project-specific scrutiny

In addition to the standard performance checks in the Engineering Guide:

**Weekly grid query:** must filter by `team_member_id` AND `date BETWEEN start AND end` in SQL. Must use indexes on `time_entries.team_member_id` and `time_entries.date`. Must not load entries for other users or dates and discard in application code.

**Standup view query:** before Slice 3 merges, run `EXPLAIN ANALYZE`. Verify indexes on `tasks.status`, `tasks.milestone_id`, `milestones.due_date`, `time_entries.project_id`, `time_entries.date`. Hours per project must aggregate in the DB. The 7-day DONE filter and the stale task check must be SQL `WHERE` clauses, not in-memory filtering. Flag if any standup query touches > 1000 rows without a selective index filter.
