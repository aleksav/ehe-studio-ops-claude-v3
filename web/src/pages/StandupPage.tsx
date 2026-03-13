import { useState, useEffect, useCallback } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Snackbar,
  Tooltip,
  Typography,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { api, ApiError } from '../lib/api';
import LogTimeModal from '../components/LogTimeModal';

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
  client: Client | null;
}

interface Task {
  id: string;
  project_id: string;
  description: string;
  status: string;
  completed_at?: string | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

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

const NEXT_STATUS: Record<string, string> = {
  TODO: 'IN_PROGRESS',
  IN_PROGRESS: 'DONE',
  DONE: 'TODO',
};

const NEXT_STATUS_LABEL: Record<string, string> = {
  TODO: 'Start (move to In Progress)',
  IN_PROGRESS: 'Complete (move to Done)',
  DONE: 'Reopen (move to To Do)',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatProjectName(project: Project): string {
  return project.client ? `${project.client.name} — ${project.name}` : project.name;
}

function sortProjects(projects: Project[]): Project[] {
  return [...projects].sort((a, b) => {
    const clientA = a.client?.name ?? '';
    const clientB = b.client?.name ?? '';
    const clientCmp = clientA.localeCompare(clientB);
    if (clientCmp !== 0) return clientCmp;
    return a.name.localeCompare(b.name);
  });
}

/** Return true if the task was completed within the last 7 days. */
function isRecentlyCompleted(task: Task): boolean {
  if (!task.completed_at) return true; // no completed_at — show it
  const completedDate = new Date(task.completed_at);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  return completedDate >= sevenDaysAgo;
}

// ---------------------------------------------------------------------------
// Kanban Column Component
// ---------------------------------------------------------------------------

function KanbanColumn({
  title,
  tasks,
  color,
  onStatusChange,
  onLogTime,
}: {
  title: string;
  tasks: Task[];
  color: 'default' | 'info' | 'success';
  onStatusChange: (task: Task) => void;
  onLogTime: (task: Task) => void;
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
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                  }}
                >
                  {task.description}
                </Typography>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 1,
                  }}
                >
                  <Chip
                    label={TASK_STATUS_LABEL[task.status] ?? task.status}
                    size="small"
                    color={TASK_STATUS_COLOR[task.status] ?? 'default'}
                    sx={{ fontSize: 11, height: 22 }}
                  />
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Tooltip title="Log Time">
                      <IconButton size="small" onClick={() => onLogTime(task)}>
                        <AccessTimeIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={NEXT_STATUS_LABEL[task.status] ?? 'Change status'}>
                      <IconButton size="small" onClick={() => onStatusChange(task)} color="primary">
                        <ArrowForwardIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
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

export default function StandupPage() {
  // Projects
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState('');

  // Tasks
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);

  // Log time modal
  const [logTimeOpen, setLogTimeOpen] = useState(false);
  const [logTimeProjectName, setLogTimeProjectName] = useState('');

  // Snackbar
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');

  const showSnackbar = (message: string, severity: 'success' | 'error' = 'success') => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  };

  // ---- Fetch projects on mount ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.get<Project[]>('/api/projects');
        if (!cancelled) {
          const nonArchived = data.filter((p) => p.status !== 'ARCHIVED');
          setProjects(sortProjects(nonArchived));
        }
      } catch {
        // silently fail
      } finally {
        if (!cancelled) setProjectsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ---- Fetch tasks when project changes ----
  const fetchTasks = useCallback(async (projectId: string) => {
    if (!projectId) {
      setTasks([]);
      return;
    }
    setTasksLoading(true);
    try {
      const data = await api.get<Task[]>(`/api/projects/${projectId}/tasks`);
      setTasks(data);
    } catch {
      setTasks([]);
    } finally {
      setTasksLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks(selectedProjectId);
  }, [selectedProjectId, fetchTasks]);

  // ---- Derived task lists (exclude CANCELLED) ----
  const todoTasks = tasks.filter((t) => t.status === 'TODO');
  const inProgressTasks = tasks.filter((t) => t.status === 'IN_PROGRESS');
  const doneTasks = tasks.filter((t) => t.status === 'DONE' && isRecentlyCompleted(t));

  // ---- Status change handler (optimistic) ----
  const handleStatusChange = useCallback(
    async (task: Task) => {
      const newStatus = NEXT_STATUS[task.status];
      if (!newStatus) return;

      // Optimistic update
      const previousTasks = tasks;
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t)));

      try {
        await api.put(`/api/projects/${selectedProjectId}/tasks/${task.id}`, {
          status: newStatus,
        });
        showSnackbar(`Task moved to ${TASK_STATUS_LABEL[newStatus]}`);
      } catch (err) {
        // Revert on error
        setTasks(previousTasks);
        const message = err instanceof ApiError ? err.message : 'Failed to update task status.';
        showSnackbar(message, 'error');
      }
    },
    [tasks, selectedProjectId],
  );

  // ---- Log time handler ----
  const handleLogTime = useCallback(() => {
    const project = projects.find((p) => p.id === selectedProjectId);
    if (project) {
      setLogTimeProjectName(formatProjectName(project));
      setLogTimeOpen(true);
    }
  }, [projects, selectedProjectId]);

  const handleProjectChange = (e: SelectChangeEvent) => {
    setSelectedProjectId(e.target.value);
  };

  // ---- Loading state ----
  if (projectsLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 4 } }}>
      {/* ---- Page Header ---- */}
      <Typography variant="h3" sx={{ fontWeight: 600, mb: 3 }}>
        Standup
      </Typography>

      {/* ---- Project Selector ---- */}
      <FormControl fullWidth sx={{ mb: 4, maxWidth: 480 }}>
        <InputLabel id="standup-project-label">Select Project</InputLabel>
        <Select
          labelId="standup-project-label"
          value={selectedProjectId}
          label="Select Project"
          onChange={handleProjectChange}
        >
          {projects.map((p) => (
            <MenuItem key={p.id} value={p.id}>
              {formatProjectName(p)}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* ---- No project selected ---- */}
      {!selectedProjectId && (
        <Typography variant="body1" color="text.secondary">
          Select a project to view its task board.
        </Typography>
      )}

      {/* ---- Kanban Board ---- */}
      {selectedProjectId && (
        <>
          {tasksLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={24} />
            </Box>
          ) : (
            <Box
              sx={{
                display: 'flex',
                flexDirection: { xs: 'column', md: 'row' },
                gap: 3,
              }}
            >
              <KanbanColumn
                title="TODO"
                tasks={todoTasks}
                color="default"
                onStatusChange={handleStatusChange}
                onLogTime={handleLogTime}
              />
              <KanbanColumn
                title="In Progress"
                tasks={inProgressTasks}
                color="info"
                onStatusChange={handleStatusChange}
                onLogTime={handleLogTime}
              />
              <KanbanColumn
                title="Done (last 7 days)"
                tasks={doneTasks}
                color="success"
                onStatusChange={handleStatusChange}
                onLogTime={handleLogTime}
              />
            </Box>
          )}
        </>
      )}

      {/* ---- Log Time Modal ---- */}
      <LogTimeModal
        open={logTimeOpen}
        onClose={() => setLogTimeOpen(false)}
        projectId={selectedProjectId}
        projectName={logTimeProjectName}
      />

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
