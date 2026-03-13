-- Performance indexes for common query patterns

-- Projects: filter by status (list endpoint)
CREATE INDEX "projects_status_idx" ON "projects"("status");

-- Team members: filter by is_active (list endpoint)
CREATE INDEX "team_members_is_active_idx" ON "team_members"("is_active");

-- Time entries: compound index for budget calculations (project + date range)
CREATE INDEX "time_entries_project_id_date_idx" ON "time_entries"("project_id", "date");

-- Audit logs: compound index for entity lookups
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- Audit logs: compound index for filtered + sorted queries
CREATE INDEX "audit_logs_entity_type_created_at_idx" ON "audit_logs"("entity_type", "created_at");
