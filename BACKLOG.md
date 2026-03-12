# EHEStudio Ops — Delivery Backlog

All issues tracked in [GitHub Issues](https://github.com/aleksav/ehe-studio-ops-claude-v3/issues).

## Slice 1 — Foundation (9 issues)
- #3 JWT auth: register, login, refresh, logout
- #4 TeamMember CRUD with preferred_task_type
- #5 Project CRUD with budget config
- #6 Milestone CRUD scoped to project
- #7 Task CRUD with status transitions and milestone assignment
- #8 TaskAssignment: assign/unassign members to tasks
- #9 TaskRate management with gap/overlap validation
- #10 getDailyHoursTotal shared service and AuditLog writeAudit utility
- #11 Web and mobile shell with navigation and auth screens

## Slice 2 — Time Logging (3 issues)
- #12 Method 1: Quick Entry — time logging page
- #13 Method 2: Log Time from Standup Card modal
- #14 Method 3: Weekly Grid — batch time logging

## Slice 3 — Standup View (5 issues)
- #15 Standup Kanban board with project switcher
- #16 Stale task and overdue milestone indicators
- #17 View A — Milestone-grouped Kanban swimlanes
- #18 View B — People-grouped board
- #19 View toggle with localStorage preference and MUI Fade

## Slice 4 — Commercial, Hardening, Deployment (6 issues)
- #20 Budget and spend summary per project
- #21 Audit log viewer — filterable, paginated
- #22 Personal dashboard
- #23 Security sweep
- #24 Performance sweep — EXPLAIN ANALYZE on key queries
- #25 Deployment: Render, Vercel, EAS setup
