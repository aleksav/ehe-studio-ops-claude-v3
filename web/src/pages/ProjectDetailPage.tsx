import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  LinearProgress,
  MenuItem,
  Select,
  Snackbar,
  TextField,
  Typography,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
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

interface Task {
  id: string;
  project_id: string;
  description: string;
  status: string;
  is_stale?: boolean;
}

interface Milestone {
  id: string;
  project_id: string;
  name: string;
  due_date: string | null;
  is_overdue?: boolean;
}

interface TimeEntry {
  id: string;
  hours_worked: string | number;
}

interface BudgetSummary {
  project_id: string;
  budget_type: string;
  budget_amount: number | null;
  currency_code: string;
  actual_spend: number;
  budget_remaining: number | null;
  hours_logged: number;
  anomalies?: { time_entry_id: string; date: string; task_type: string; hours_worked: number }[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROJECT_STATUS_COLOR: Record<string, 'default' | 'success' | 'info' | 'warning'> = {
  PLANNED: 'default',
  ACTIVE: 'success',
  COMPLETED: 'info',
  ARCHIVED: 'warning',
};

const PROJECT_STATUS_LABEL: Record<string, string> = {
  PLANNED: 'Planned',
  ACTIVE: 'Active',
  COMPLETED: 'Completed',
  ARCHIVED: 'Archived',
};

const TASK_STATUS_COLOR: Record<string, 'default' | 'info' | 'success' | 'warning'> = {
  TODO: 'default',
  IN_PROGRESS: 'info',
  DONE: 'success',
  CANCELLED: 'warning',
};

const TASK_STATUS_LABEL: Record<string, string> = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  DONE: 'Done',
  CANCELLED: 'Cancelled',
};

const TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'DONE'] as const;

const BUDGET_LABEL: Record<string, string> = {
  FIXED: 'Fixed',
  TIME_AND_MATERIALS: 'Time & Materials',
  RETAINER: 'Retainer',
  CAPPED: 'Capped',
  TRACKED_ONLY: 'Tracked Only',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatProjectName(project: Project): string {
  return project.client ? `${project.client.name} — ${project.name}` : project.name;
}

function formatBudgetType(value: string | null): string | null {
  if (!value || value === 'NONE') return null;
  return BUDGET_LABEL[value] ?? value;
}

// ---------------------------------------------------------------------------
// Kanban Column Component
// ---------------------------------------------------------------------------

function KanbanColumn({
  title,
  tasks,
  color,
}: {
  title: string;
  tasks: Task[];
  color: 'default' | 'info' | 'success';
}) {
  const bgColor = color === 'info' ? '#E3F2FD' : color === 'success' ? '#E8F5E9' : '#F5F5F5';

  return (
    <Box
      sx={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          mb: 2,
          px: 1,
        }}
      >
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          {title}
        </Typography>
        <Chip label={tasks.length} size="small" sx={{ fontSize: 12, height: 22 }} />
      </Box>
      <Box
        sx={{
          bgcolor: bgColor,
          borderRadius: 2,
          p: 1.5,
          minHeight: 120,
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5,
        }}
      >
        {tasks.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
            No tasks
          </Typography>
        ) : (
          tasks.map((task) => (
            <Card
              key={task.id}
              elevation={0}
              sx={{
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
              }}
            >
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: 500,
                    mb: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                  }}
                >
                  {task.description}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <Chip
                    label={TASK_STATUS_LABEL[task.status] ?? task.status}
                    size="small"
                    color={TASK_STATUS_COLOR[task.status] ?? 'default'}
                    sx={{ fontSize: 11, height: 22 }}
                  />
                  {task.is_stale && (
                    <Chip
                      icon={<AccessTimeIcon sx={{ fontSize: 14 }} />}
                      label="Stale"
                      size="small"
                      sx={{
                        fontSize: 11,
                        height: 22,
                        bgcolor: '#FFF3E0',
                        color: '#E65100',
                        '& .MuiChip-icon': { color: '#E65100' },
                      }}
                    />
                  )}
                </Box>
              </CardContent>
            </Card>
          ))
        )}
      </Box>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Data state
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [totalHours, setTotalHours] = useState<number>(0);
  const [budgetSummary, setBudgetSummary] = useState<BudgetSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [tasksLoading, setTasksLoading] = useState(false);

  // Add task dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [taskDescription, setTaskDescription] = useState('');
  const [taskStatus, setTaskStatus] = useState<string>('TODO');
  const [submitting, setSubmitting] = useState(false);

  // Snackbar
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');

  const showSnackbar = (message: string, severity: 'success' | 'error' = 'success') => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  };

  // ---- Fetch project data ----
  const fetchData = useCallback(async () => {
    if (!id) return;
    try {
      const [projects, projectTasks, projectMilestones, timeEntries] = await Promise.all([
        // TODO: use single-project endpoint when available
        api.get<Project[]>('/api/projects'),
        api.get<Task[]>(`/api/projects/${id}/tasks`),
        api.get<Milestone[]>(`/api/projects/${id}/milestones`),
        api.get<TimeEntry[]>(`/api/time-entries?project_id=${id}`),
      ]);

      const found = projects.find((p) => p.id === id) ?? null;
      setProject(found);
      setTasks(projectTasks);
      setMilestones(projectMilestones);

      const hours = timeEntries.reduce((sum, e) => sum + parseFloat(String(e.hours_worked)), 0);
      setTotalHours(hours);

      // Fetch budget summary if project has a budget
      const foundProject = projects.find((p) => p.id === id) ?? null;
      if (foundProject && foundProject.budget_type && foundProject.budget_type !== 'NONE') {
        try {
          const budget = await api.get<BudgetSummary>(`/api/projects/${id}/budget`);
          setBudgetSummary(budget);
        } catch {
          // Budget fetch is non-critical
        }
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ---- Task counts ----
  const todoTasks = tasks.filter((t) => t.status === 'TODO');
  const inProgressTasks = tasks.filter((t) => t.status === 'IN_PROGRESS');
  const doneTasks = tasks.filter((t) => t.status === 'DONE');
  const cancelledCount = tasks.filter((t) => t.status === 'CANCELLED').length;

  // ---- Create task ----
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskDescription.trim() || submitting || !id) return;

    setSubmitting(true);
    try {
      await api.post(`/api/projects/${id}/tasks`, {
        description: taskDescription.trim(),
        status: taskStatus,
      });
      showSnackbar('Task created successfully.');
      setDialogOpen(false);
      setTaskDescription('');
      setTaskStatus('TODO');
      // Refresh tasks
      setTasksLoading(true);
      try {
        const updatedTasks = await api.get<Task[]>(`/api/projects/${id}/tasks`);
        setTasks(updatedTasks);
      } finally {
        setTasksLoading(false);
      }
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
      showSnackbar(message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ---- Loading state ----
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  // ---- Project not found ----
  if (!project) {
    return (
      <Box sx={{ p: { xs: 2, sm: 4 } }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/projects')} sx={{ mb: 2 }}>
          Back to Projects
        </Button>
        <Typography variant="h5" color="text.secondary">
          Project not found.
        </Typography>
      </Box>
    );
  }

  const budgetLabel = formatBudgetType(project.budget_type);

  return (
    <Box sx={{ p: { xs: 2, sm: 4 } }}>
      {/* ---- Back button ---- */}
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/projects')} sx={{ mb: 2 }}>
        Back to Projects
      </Button>

      {/* ---- Project Header ---- */}
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 2,
          mb: 3,
        }}
      >
        <Typography variant="h3" sx={{ fontWeight: 600 }}>
          {formatProjectName(project)}
        </Typography>
        <Chip
          label={PROJECT_STATUS_LABEL[project.status] ?? project.status}
          color={PROJECT_STATUS_COLOR[project.status] ?? 'default'}
          sx={{ fontSize: 13, height: 28 }}
        />
      </Box>

      {/* ---- Project Description ---- */}
      {project.description && (
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          {project.description}
        </Typography>
      )}

      {/* ---- Stats row ---- */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr 1fr',
            sm: '1fr 1fr 1fr 1fr',
            md: budgetLabel ? '1fr 1fr 1fr 1fr 1fr' : '1fr 1fr 1fr 1fr',
          },
          gap: 2,
          mb: 4,
        }}
      >
        <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
              TODO
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              {todoTasks.length}
            </Typography>
          </CardContent>
        </Card>
        <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
              In Progress
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, color: 'info.main' }}>
              {inProgressTasks.length}
            </Typography>
          </CardContent>
        </Card>
        <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
              Done
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, color: 'success.main' }}>
              {doneTasks.length}
            </Typography>
          </CardContent>
        </Card>
        <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
              Total Hours
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, color: 'primary.main' }}>
              {totalHours > 0 ? totalHours.toFixed(1) : '0'}
            </Typography>
          </CardContent>
        </Card>
        {budgetLabel && (
          <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                Budget
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 600 }}>
                {budgetLabel}
                {project.budget_amount != null &&
                  ` - ${project.currency_code ?? 'GBP'} ${Number(project.budget_amount).toLocaleString()}`}
              </Typography>
            </CardContent>
          </Card>
        )}
      </Box>

      {/* ---- Budget Summary ---- */}
      {budgetSummary && (
        <Card
          elevation={0}
          sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, mb: 4 }}
        >
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
              Budget Summary
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr 1fr' },
                gap: 2,
                mb: budgetSummary.budget_type === 'CAPPED' && budgetSummary.budget_amount ? 2 : 0,
              }}
            >
              {budgetSummary.budget_amount != null && (
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Budget
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    {budgetSummary.currency_code}{' '}
                    {budgetSummary.budget_amount.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </Typography>
                </Box>
              )}
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Actual Spend
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  {budgetSummary.currency_code}{' '}
                  {budgetSummary.actual_spend.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </Typography>
              </Box>
              {budgetSummary.budget_remaining != null && (
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Remaining
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    {budgetSummary.currency_code}{' '}
                    {budgetSummary.budget_remaining.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </Typography>
                </Box>
              )}
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Hours Logged
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  {budgetSummary.hours_logged.toFixed(1)}
                </Typography>
              </Box>
            </Box>
            {budgetSummary.budget_type === 'CAPPED' &&
              budgetSummary.budget_amount != null &&
              budgetSummary.budget_amount > 0 &&
              (() => {
                const spendPercent = Math.min(
                  (budgetSummary.actual_spend / budgetSummary.budget_amount) * 100,
                  100,
                );
                const barColor =
                  spendPercent > 90 ? 'error' : spendPercent > 75 ? 'warning' : 'primary';
                return (
                  <Box>
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        mb: 0.5,
                      }}
                    >
                      <Typography variant="body2" color="text.secondary">
                        Spend vs Budget
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {spendPercent.toFixed(1)}%
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={spendPercent}
                      color={barColor}
                      sx={{ height: 8, borderRadius: 4 }}
                    />
                  </Box>
                );
              })()}
            {budgetSummary.anomalies && budgetSummary.anomalies.length > 0 && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                {budgetSummary.anomalies.length} time{' '}
                {budgetSummary.anomalies.length === 1 ? 'entry has' : 'entries have'} no matching
                task rate and could not be costed.
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* ---- Milestones ---- */}
      {milestones.length > 0 && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" sx={{ fontWeight: 600, mb: 2 }}>
            Milestones
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
            {milestones.map((m) => (
              <Chip
                key={m.id}
                label={
                  m.is_overdue
                    ? `${m.name} — Overdue`
                    : m.due_date
                      ? `${m.name} — ${new Date(m.due_date).toLocaleDateString()}`
                      : m.name
                }
                color={m.is_overdue ? 'error' : 'default'}
                variant={m.is_overdue ? 'filled' : 'outlined'}
                sx={{ fontSize: 13, height: 30 }}
              />
            ))}
          </Box>
        </Box>
      )}

      {/* ---- Kanban Header ---- */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
        }}
      >
        <Typography variant="h4" sx={{ fontWeight: 600 }}>
          Tasks
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
          Add Task
        </Button>
      </Box>

      {/* ---- Kanban Board ---- */}
      {tasksLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={24} />
        </Box>
      ) : (
        <>
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', md: 'row' },
              gap: 3,
            }}
          >
            <KanbanColumn title="TODO" tasks={todoTasks} color="default" />
            <KanbanColumn title="In Progress" tasks={inProgressTasks} color="info" />
            <KanbanColumn title="Done" tasks={doneTasks} color="success" />
          </Box>
          {cancelledCount > 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              {cancelledCount} cancelled {cancelledCount === 1 ? 'task' : 'tasks'}
            </Typography>
          )}
        </>
      )}

      {/* ---- Add Task Dialog ---- */}
      <Dialog
        open={dialogOpen}
        onClose={() => !submitting && setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 600, pb: 1 }}>New Task</DialogTitle>
        <Box component="form" onSubmit={handleCreateTask}>
          <DialogContent sx={{ pt: 1 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <TextField
                label="Description"
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
                required
                fullWidth
                autoFocus
                multiline
                minRows={2}
                maxRows={4}
              />
              <FormControl fullWidth>
                <InputLabel id="task-status-label">Status</InputLabel>
                <Select
                  labelId="task-status-label"
                  value={taskStatus}
                  label="Status"
                  onChange={(e: SelectChangeEvent) => setTaskStatus(e.target.value)}
                >
                  {TASK_STATUSES.map((s) => (
                    <MenuItem key={s} value={s}>
                      {TASK_STATUS_LABEL[s]}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5 }}>
            <Button onClick={() => setDialogOpen(false)} color="inherit" disabled={submitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={!taskDescription.trim() || submitting}
              endIcon={submitting ? <CircularProgress size={18} color="inherit" /> : undefined}
              sx={{ px: 3 }}
            >
              {submitting ? 'Creating...' : 'Create Task'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* ---- Snackbar ---- */}
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
