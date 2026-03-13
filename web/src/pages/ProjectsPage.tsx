import { useState, useEffect, useCallback } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Snackbar,
  TextField,
  Typography,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import ArchiveIcon from '@mui/icons-material/Archive';
import UnarchiveIcon from '@mui/icons-material/Unarchive';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Client {
  id: string;
  name: string;
}

interface Project {
  id: string;
  name: string;
  status: string;
  budget_type: string | null;
  budget_amount: number | string | null;
  currency_code: string | null;
  description: string | null;
  client: Client | null;
}

interface ProjectFormData {
  name: string;
  description: string;
  status: string;
  client_id: string;
  budget_type: string;
  budget_amount: string;
  currency_code: string;
}

const EMPTY_FORM: ProjectFormData = {
  name: '',
  description: '',
  status: 'PLANNED',
  client_id: '',
  budget_type: 'NONE',
  budget_amount: '',
  currency_code: 'GBP',
};

// ---------------------------------------------------------------------------
// Status chip colours
// ---------------------------------------------------------------------------

const STATUS_COLOR: Record<string, 'default' | 'success' | 'info' | 'warning'> = {
  PLANNED: 'default',
  ACTIVE: 'success',
  COMPLETED: 'info',
  ARCHIVED: 'warning',
};

const STATUS_LABEL: Record<string, string> = {
  PLANNED: 'Planned',
  ACTIVE: 'Active',
  COMPLETED: 'Completed',
  ARCHIVED: 'Archived',
};

const STATUSES = ['PLANNED', 'ACTIVE', 'COMPLETED', 'ARCHIVED'] as const;
const BUDGET_TYPES = ['NONE', 'CAPPED', 'TRACKED_ONLY'] as const;

const BUDGET_TYPE_LABEL: Record<string, string> = {
  NONE: 'None',
  CAPPED: 'Capped',
  TRACKED_ONLY: 'Tracked Only',
};

// ---------------------------------------------------------------------------
// Budget type helpers
// ---------------------------------------------------------------------------

const BUDGET_LABEL: Record<string, string> = {
  FIXED: 'Fixed',
  TIME_AND_MATERIALS: 'Time & Materials',
  RETAINER: 'Retainer',
  CAPPED: 'Capped',
  TRACKED_ONLY: 'Tracked Only',
};

function formatBudgetType(value: string | null): string | null {
  if (!value || value === 'NONE') return null;
  return BUDGET_LABEL[value] ?? value;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ProjectsPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [form, setForm] = useState<ProjectFormData>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  // Snackbar state
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');

  // ---- Fetch projects ----
  const fetchProjects = useCallback(async () => {
    try {
      const [projectData, clientData] = await Promise.all([
        api.get<Project[]>('/api/projects'),
        api.get<Client[]>('/api/clients'),
      ]);
      setProjects(projectData);
      setClients(clientData);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // ---- Snackbar helper ----
  const showSnackbar = (message: string, severity: 'success' | 'error' = 'success') => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  };

  // ---- Open dialog for create ----
  const handleOpenCreate = () => {
    setEditingProject(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  // ---- Open dialog for edit ----
  const handleOpenEdit = (project: Project) => {
    setEditingProject(project);
    setForm({
      name: project.name,
      description: project.description ?? '',
      status: project.status,
      client_id: project.client?.id ?? '',
      budget_type: project.budget_type ?? 'NONE',
      budget_amount: project.budget_amount != null ? String(project.budget_amount) : '',
      currency_code: project.currency_code ?? 'GBP',
    });
    setDialogOpen(true);
  };

  // ---- Close dialog ----
  const handleCloseDialog = () => {
    if (submitting) return;
    setDialogOpen(false);
    setEditingProject(null);
  };

  // ---- Submit create/edit ----
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || submitting) return;

    setSubmitting(true);

    const showBudgetFields = form.budget_type === 'CAPPED' || form.budget_type === 'TRACKED_ONLY';
    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      status: form.status,
      client_id: form.client_id || null,
      budget_type: form.budget_type,
    };

    if (showBudgetFields) {
      payload.budget_amount = form.budget_amount ? parseFloat(form.budget_amount) : null;
      payload.currency_code = form.currency_code.trim() || 'GBP';
    }

    try {
      if (editingProject) {
        await api.put(`/api/projects/${editingProject.id}`, payload);
        showSnackbar('Project updated successfully.');
      } else {
        await api.post('/api/projects', payload);
        showSnackbar('Project created successfully.');
      }
      setDialogOpen(false);
      setEditingProject(null);
      await fetchProjects();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
      showSnackbar(message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ---- Archive ----
  const handleArchive = async (project: Project) => {
    try {
      await api.delete(`/api/projects/${project.id}`);
      showSnackbar(`"${project.name}" archived.`);
      await fetchProjects();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
      showSnackbar(message, 'error');
    }
  };

  // ---- Unarchive ----
  const handleUnarchive = async (project: Project) => {
    try {
      await api.put(`/api/projects/${project.id}`, { status: 'PLANNED' });
      showSnackbar(`"${project.name}" restored.`);
      await fetchProjects();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
      showSnackbar(message, 'error');
    }
  };

  const showBudgetFields = form.budget_type === 'CAPPED' || form.budget_type === 'TRACKED_ONLY';

  const sortByClient = (list: Project[]) =>
    [...list].sort((a, b) => {
      const ca = a.client?.name ?? '';
      const cb = b.client?.name ?? '';
      const cmp = ca.localeCompare(cb);
      return cmp !== 0 ? cmp : a.name.localeCompare(b.name);
    });

  const visibleProjects = sortByClient(
    showArchived ? projects : projects.filter((p) => p.status !== 'ARCHIVED'),
  );

  const archivedCount = projects.filter((p) => p.status === 'ARCHIVED').length;

  return (
    <Box sx={{ p: { xs: 2, sm: 4 } }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          mb: 1,
        }}
      >
        <Typography variant="h3" sx={{ fontWeight: 600 }}>
          Projects
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenCreate}>
          New Project
        </Button>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4 }}>
        <Typography variant="body1" color="text.secondary">
          All studio projects at a glance.
        </Typography>
        {archivedCount > 0 && (
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
              />
            }
            label={`Show archived (${archivedCount})`}
            slotProps={{ typography: { variant: 'body2', color: 'text.secondary' } }}
          />
        )}
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress size={28} />
        </Box>
      ) : visibleProjects.length === 0 ? (
        <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
          <CardContent sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              No projects found.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: '1fr 1fr',
              md: '1fr 1fr 1fr',
            },
            gap: 3,
          }}
        >
          {visibleProjects.map((project) => (
            <Card
              key={project.id}
              elevation={0}
              sx={{
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 3,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <CardContent sx={{ p: 3, flex: 1, display: 'flex', flexDirection: 'column' }}>
                {/* Header: name + status */}
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    mb: 1.5,
                  }}
                >
                  <Box sx={{ flex: 1, mr: 1 }}>
                    {project.client && (
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
                        {project.client.name}
                      </Typography>
                    )}
                    <Typography
                      variant="h4"
                      sx={{
                        fontWeight: 600,
                        cursor: 'pointer',
                        '&:hover': { color: 'primary.main' },
                      }}
                      onClick={() => navigate(`/projects/${project.id}`)}
                    >
                      {project.name}
                    </Typography>
                  </Box>
                  <Chip
                    label={STATUS_LABEL[project.status] ?? project.status}
                    size="small"
                    color={STATUS_COLOR[project.status] ?? 'default'}
                    sx={{ fontSize: 11, height: 22, flexShrink: 0 }}
                  />
                </Box>

                {/* Budget type */}
                {formatBudgetType(project.budget_type) && (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {formatBudgetType(project.budget_type)}
                  </Typography>
                )}

                {/* Description (truncated) */}
                {project.description && (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                      mt: 'auto',
                      pt: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                    }}
                  >
                    {project.description}
                  </Typography>
                )}

                {/* Action buttons */}
                <Box sx={{ display: 'flex', gap: 1, mt: 2, pt: 1 }}>
                  <Button
                    size="small"
                    startIcon={<EditIcon />}
                    onClick={() => handleOpenEdit(project)}
                  >
                    Edit
                  </Button>
                  {project.status === 'ARCHIVED' ? (
                    <Button
                      size="small"
                      color="info"
                      startIcon={<UnarchiveIcon />}
                      onClick={() => handleUnarchive(project)}
                    >
                      Unarchive
                    </Button>
                  ) : (
                    <Button
                      size="small"
                      color="warning"
                      startIcon={<ArchiveIcon />}
                      onClick={() => handleArchive(project)}
                    >
                      Archive
                    </Button>
                  )}
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      {/* Create / Edit Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 600, pb: 1 }}>
          {editingProject ? 'Edit Project' : 'New Project'}
        </DialogTitle>
        <Box component="form" onSubmit={handleSubmit}>
          <DialogContent sx={{ pt: 1 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <TextField
                label="Name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
                fullWidth
                autoFocus
              />
              <FormControl fullWidth>
                <InputLabel id="project-client-label">Client</InputLabel>
                <Select
                  labelId="project-client-label"
                  value={form.client_id}
                  label="Client"
                  onChange={(e: SelectChangeEvent) =>
                    setForm((f) => ({ ...f, client_id: e.target.value }))
                  }
                >
                  <MenuItem value="">
                    <em>None</em>
                  </MenuItem>
                  {[...clients]
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((c) => (
                      <MenuItem key={c.id} value={c.id}>
                        {c.name}
                      </MenuItem>
                    ))}
                </Select>
              </FormControl>
              <TextField
                label="Description"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                multiline
                minRows={2}
                maxRows={4}
                fullWidth
              />
              <FormControl fullWidth>
                <InputLabel id="project-status-label">Status</InputLabel>
                <Select
                  labelId="project-status-label"
                  value={form.status}
                  label="Status"
                  onChange={(e: SelectChangeEvent) =>
                    setForm((f) => ({ ...f, status: e.target.value }))
                  }
                >
                  {STATUSES.map((s) => (
                    <MenuItem key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth>
                <InputLabel id="project-budget-type-label">Budget Type</InputLabel>
                <Select
                  labelId="project-budget-type-label"
                  value={form.budget_type}
                  label="Budget Type"
                  onChange={(e: SelectChangeEvent) =>
                    setForm((f) => ({ ...f, budget_type: e.target.value }))
                  }
                >
                  {BUDGET_TYPES.map((bt) => (
                    <MenuItem key={bt} value={bt}>
                      {BUDGET_TYPE_LABEL[bt]}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              {showBudgetFields && (
                <>
                  <TextField
                    label="Budget Amount"
                    type="number"
                    value={form.budget_amount}
                    onChange={(e) => setForm((f) => ({ ...f, budget_amount: e.target.value }))}
                    inputProps={{ min: 0, step: 0.01 }}
                    fullWidth
                  />
                  <TextField
                    label="Currency Code"
                    value={form.currency_code}
                    onChange={(e) => setForm((f) => ({ ...f, currency_code: e.target.value }))}
                    fullWidth
                    placeholder="GBP"
                  />
                </>
              )}
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5 }}>
            <Button onClick={handleCloseDialog} color="inherit" disabled={submitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={!form.name.trim() || submitting}
              endIcon={submitting ? <CircularProgress size={18} color="inherit" /> : undefined}
              sx={{ px: 3 }}
            >
              {submitting ? 'Saving...' : editingProject ? 'Save Changes' : 'Create Project'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbarOpen(false)}
          severity={snackbarSeverity}
          sx={{ borderRadius: 2, width: '100%' }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}
