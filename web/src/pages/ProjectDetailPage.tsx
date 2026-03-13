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
  MenuItem,
  Select,
  Snackbar,
  TextField,
  Typography,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';
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
}

interface TimeEntry {
  id: string;
  hours_worked: string | number;
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
  return project.client ? `${project.name} (${project.client.name})` : project.name;
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
                <Chip
                  label={TASK_STATUS_LABEL[task.status] ?? task.status}
                  size="small"
                  color={TASK_STATUS_COLOR[task.status] ?? 'default'}
                  sx={{ fontSize: 11, height: 22 }}
                />
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
  const [totalHours, setTotalHours] = useState<number>(0);
  const [loading, setLoading] = useState(true);

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
      const [projects, projectTasks, timeEntries] = await Promise.all([
        api.get<Project[]>('/api/projects'),
        api.get<Task[]>(`/api/projects/${id}/tasks`),
        api.get<TimeEntry[]>(`/api/time-entries?project_id=${id}`),
      ]);

      const found = projects.find((p) => p.id === id) ?? null;
      setProject(found);
      setTasks(projectTasks);

      const hours = timeEntries.reduce((sum, e) => sum + parseFloat(String(e.hours_worked)), 0);
      setTotalHours(hours);
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
      const updatedTasks = await api.get<Task[]>(`/api/projects/${id}/tasks`);
      setTasks(updatedTasks);
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
