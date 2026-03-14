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
import { api, ApiError } from '../lib/api';
import type { Assignment } from '../components/AssigneeAvatars';
import ProjectTaskBoard from '../components/ProjectTaskBoard';
import type { BoardTask, BoardMilestone, ViewMode } from '../components/ProjectTaskBoard';

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

const VIEW_STORAGE_KEY = 'project-detail-board-view';
const HIDE_EMPTY_MILESTONES_KEY = 'milestoneHideEmpty';
const HIDDEN_MILESTONES_KEY_PREFIX = 'hiddenMilestones_';

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
// Component
// ---------------------------------------------------------------------------

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Data state
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<BoardTask[]>([]);
  const [milestones, setMilestones] = useState<BoardMilestone[]>([]);
  const [totalHours, setTotalHours] = useState<number>(0);
  const [budgetSummary, setBudgetSummary] = useState<BudgetSummary | null>(null);
  const [weeklyHoursMap, setWeeklyHoursMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [tasksLoading, setTasksLoading] = useState(false);

  // Board view toggle with localStorage persistence
  const initialViewMode = (() => {
    const stored = localStorage.getItem(VIEW_STORAGE_KEY);
    if (stored === 'milestones' || stored === 'people') return stored;
    return 'board' as ViewMode;
  })();

  const handleViewChange = (mode: ViewMode) => {
    localStorage.setItem(VIEW_STORAGE_KEY, mode);
  };

  // Milestone visibility: hide empty milestones toggle
  const initialHideEmpty = localStorage.getItem(HIDE_EMPTY_MILESTONES_KEY) === 'true';

  const handleHideEmptyChange = (checked: boolean) => {
    localStorage.setItem(HIDE_EMPTY_MILESTONES_KEY, String(checked));
  };

  // Milestone visibility: per-milestone hidden IDs
  const hiddenMilestonesKey = id ? `${HIDDEN_MILESTONES_KEY_PREFIX}${id}` : '';

  const [hiddenMilestoneIds, setHiddenMilestoneIds] = useState<Set<string>>(() => {
    if (!id) return new Set<string>();
    try {
      const stored = localStorage.getItem(`${HIDDEN_MILESTONES_KEY_PREFIX}${id}`);
      if (stored) return new Set<string>(JSON.parse(stored) as string[]);
    } catch {
      // ignore
    }
    return new Set<string>();
  });

  const toggleMilestoneVisibility = useCallback(
    (milestoneId: string | null) => {
      const key = milestoneId ?? '__none__';
      setHiddenMilestoneIds((prev) => {
        const next = new Set(prev);
        if (next.has(key)) {
          next.delete(key);
        } else {
          next.add(key);
        }
        if (hiddenMilestonesKey) {
          localStorage.setItem(hiddenMilestonesKey, JSON.stringify([...next]));
        }
        return next;
      });
    },
    [hiddenMilestonesKey],
  );

  const showAllMilestones = useCallback(() => {
    setHiddenMilestoneIds(new Set());
    if (hiddenMilestonesKey) {
      localStorage.setItem(hiddenMilestonesKey, JSON.stringify([]));
    }
  }, [hiddenMilestonesKey]);

  // Add task dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [taskDescription, setTaskDescription] = useState('');
  const [taskStatus, setTaskStatus] = useState<string>('TODO');
  const [submitting, setSubmitting] = useState(false);

  // Milestone dialog state
  const [milestoneDialogOpen, setMilestoneDialogOpen] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<BoardMilestone | null>(null);
  const [milestoneName, setMilestoneName] = useState('');
  const [milestoneDueDate, setMilestoneDueDate] = useState('');
  const [milestoneSubmitting, setMilestoneSubmitting] = useState(false);

  // Delete milestone confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingMilestone, setDeletingMilestone] = useState<BoardMilestone | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

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
      const [projects, projectTasks, projectMilestones, timeEntries, weeklyHours] =
        await Promise.all([
          // TODO: use single-project endpoint when available
          api.get<Project[]>('/api/projects'),
          api.get<BoardTask[]>(`/api/projects/${id}/tasks`),
          api.get<BoardMilestone[]>(`/api/projects/${id}/milestones`),
          api.get<TimeEntry[]>(`/api/time-entries?project_id=${id}`),
          api.get<Record<string, number>>(`/api/projects/${id}/weekly-hours`),
        ]);

      const found = projects.find((p) => p.id === id) ?? null;
      setProject(found);
      setTasks(projectTasks);
      setMilestones(projectMilestones);
      setWeeklyHoursMap(weeklyHours);

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
  const todoCount = tasks.filter((t) => t.status === 'TODO').length;
  const inProgressCount = tasks.filter((t) => t.status === 'IN_PROGRESS').length;
  const doneCount = tasks.filter((t) => t.status === 'DONE').length;
  const cancelledCount = tasks.filter((t) => t.status === 'CANCELLED').length;

  // ---- Assignments change handler ----
  const handleAssignmentsChange = useCallback((taskId: string, assignments: Assignment[]) => {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, assignments } : t)));
  }, []);

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
        const updatedTasks = await api.get<BoardTask[]>(`/api/projects/${id}/tasks`);
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

  // ---- Milestone CRUD ----
  const handleOpenCreateMilestone = () => {
    setEditingMilestone(null);
    setMilestoneName('');
    setMilestoneDueDate('');
    setMilestoneDialogOpen(true);
  };

  const handleOpenEditMilestone = (milestone: BoardMilestone) => {
    setEditingMilestone(milestone);
    setMilestoneName(milestone.name);
    setMilestoneDueDate(milestone.due_date ? milestone.due_date.split('T')[0] : '');
    setMilestoneDialogOpen(true);
  };

  const handleCloseMilestoneDialog = () => {
    if (milestoneSubmitting) return;
    setMilestoneDialogOpen(false);
    setEditingMilestone(null);
  };

  const handleSubmitMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!milestoneName.trim() || milestoneSubmitting || !id) return;

    setMilestoneSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        name: milestoneName.trim(),
        due_date: milestoneDueDate || null,
      };

      if (editingMilestone) {
        await api.put(`/api/projects/${id}/milestones/${editingMilestone.id}`, payload);
        showSnackbar('Milestone updated successfully.');
      } else {
        await api.post(`/api/projects/${id}/milestones`, payload);
        showSnackbar('Milestone created successfully.');
      }
      setMilestoneDialogOpen(false);
      setEditingMilestone(null);
      // Refresh milestones
      const updatedMilestones = await api.get<BoardMilestone[]>(`/api/projects/${id}/milestones`);
      setMilestones(updatedMilestones);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
      showSnackbar(message, 'error');
    } finally {
      setMilestoneSubmitting(false);
    }
  };

  const handleOpenDeleteMilestone = (milestone: BoardMilestone) => {
    setDeletingMilestone(milestone);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDeleteMilestone = async () => {
    if (!deletingMilestone || deleteSubmitting || !id) return;

    setDeleteSubmitting(true);
    try {
      await api.delete(`/api/projects/${id}/milestones/${deletingMilestone.id}`);
      showSnackbar('Milestone deleted successfully.');
      setDeleteDialogOpen(false);
      setDeletingMilestone(null);
      // Refresh milestones and tasks (tasks may have lost their milestone)
      const [updatedMilestones, updatedTasks] = await Promise.all([
        api.get<BoardMilestone[]>(`/api/projects/${id}/milestones`),
        api.get<BoardTask[]>(`/api/projects/${id}/tasks`),
      ]);
      setMilestones(updatedMilestones);
      setTasks(updatedTasks);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
      showSnackbar(message, 'error');
    } finally {
      setDeleteSubmitting(false);
    }
  };

  // ---- Change task milestone ----
  const handleMilestoneChange = useCallback(
    async (taskId: string, milestoneId: string | null) => {
      if (!id) return;
      try {
        await api.put(`/api/projects/${id}/tasks/${taskId}`, { milestone_id: milestoneId });
        setTasks((prev) =>
          prev.map((t) => {
            if (t.id !== taskId) return t;
            const milestone = milestoneId
              ? (milestones.find((m) => m.id === milestoneId) ?? null)
              : null;
            return {
              ...t,
              milestone_id: milestoneId,
              milestone: milestone ? { id: milestone.id, name: milestone.name } : null,
            };
          }),
        );
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : 'Failed to update milestone assignment.';
        showSnackbar(message, 'error');
      }
    },
    [id, milestones],
  );

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
              {todoCount}
            </Typography>
          </CardContent>
        </Card>
        <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
              In Progress
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, color: 'info.main' }}>
              {inProgressCount}
            </Typography>
          </CardContent>
        </Card>
        <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
              Done
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, color: 'success.main' }}>
              {doneCount}
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
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <Typography variant="h4" sx={{ fontWeight: 600 }}>
            Milestones
          </Typography>
          <Button
            size="small"
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={handleOpenCreateMilestone}
          >
            Add Milestone
          </Button>
        </Box>
        {milestones.length > 0 && (
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
        )}
      </Box>

      {/* ---- Tasks Header ---- */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 2,
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

      {/* ---- Task Board ---- */}
      <ProjectTaskBoard
        tasks={tasks}
        milestones={milestones}
        loading={tasksLoading}
        weeklyHoursMap={weeklyHoursMap}
        initialViewMode={initialViewMode}
        onViewModeChange={handleViewChange}
        initialHideEmpty={initialHideEmpty}
        onHideEmptyChange={handleHideEmptyChange}
        onAssignmentsChange={handleAssignmentsChange}
        onMilestoneChange={handleMilestoneChange}
        onEditMilestone={handleOpenEditMilestone}
        onDeleteMilestone={handleOpenDeleteMilestone}
        hiddenMilestoneIds={hiddenMilestoneIds}
        onToggleMilestoneVisibility={toggleMilestoneVisibility}
        onShowAllMilestones={showAllMilestones}
        cancelledCount={cancelledCount}
      />

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

      {/* ---- Milestone Create/Edit Dialog ---- */}
      <Dialog
        open={milestoneDialogOpen}
        onClose={handleCloseMilestoneDialog}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 600, pb: 1 }}>
          {editingMilestone ? 'Edit Milestone' : 'New Milestone'}
        </DialogTitle>
        <Box component="form" onSubmit={handleSubmitMilestone}>
          <DialogContent sx={{ pt: 1 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <TextField
                label="Name"
                value={milestoneName}
                onChange={(e) => setMilestoneName(e.target.value)}
                required
                fullWidth
                autoFocus
              />
              <TextField
                label="Due Date"
                type="date"
                value={milestoneDueDate}
                onChange={(e) => setMilestoneDueDate(e.target.value)}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5 }}>
            <Button
              onClick={handleCloseMilestoneDialog}
              color="inherit"
              disabled={milestoneSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={!milestoneName.trim() || milestoneSubmitting}
              endIcon={
                milestoneSubmitting ? <CircularProgress size={18} color="inherit" /> : undefined
              }
              sx={{ px: 3 }}
            >
              {milestoneSubmitting
                ? 'Saving...'
                : editingMilestone
                  ? 'Save Changes'
                  : 'Create Milestone'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* ---- Delete Milestone Confirmation Dialog ---- */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => !deleteSubmitting && setDeleteDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 600 }}>Delete Milestone</DialogTitle>
        <DialogContent>
          <Typography variant="body1">
            Are you sure you want to delete &ldquo;{deletingMilestone?.name}&rdquo;? Tasks assigned
            to this milestone will become unassigned.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button
            onClick={() => setDeleteDialogOpen(false)}
            color="inherit"
            disabled={deleteSubmitting}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleConfirmDeleteMilestone}
            disabled={deleteSubmitting}
            endIcon={deleteSubmitting ? <CircularProgress size={18} color="inherit" /> : undefined}
          >
            {deleteSubmitting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
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
