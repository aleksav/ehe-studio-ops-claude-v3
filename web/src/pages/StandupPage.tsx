import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Collapse,
  Fade,
  IconButton,
  LinearProgress,
  Snackbar,
  Tooltip,
  Typography,
} from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { api, ApiError } from '../lib/api';
import LogTimeModal from '../components/LogTimeModal';
import AssigneeAvatars from '../components/AssigneeAvatars';

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

interface TeamMemberRef {
  id: string;
  full_name: string;
  email: string;
}

interface TaskAssignment {
  id: string;
  task_id?: string;
  team_member_id: string;
  team_member: TeamMemberRef;
}

interface Task {
  id: string;
  project_id: string;
  description: string;
  status: string;
  completed_at?: string | null;
  is_stale?: boolean;
  assignments?: TaskAssignment[];
}

interface Milestone {
  id: string;
  project_id: string;
  name: string;
  due_date: string | null;
  is_overdue?: boolean;
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

const STANDUP_PROMPTS = [
  'What did you accomplish yesterday?',
  'Any blockers the team can help with?',
  'What wins are we celebrating today?',
  "What's your focus for today?",
  'Anyone need a pair of fresh eyes?',
  'Any risks or concerns to flag?',
  'What are you most excited about?',
  'How can the team support you today?',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatProjectName(project: Project): string {
  return project.client ? `${project.client.name} — ${project.name}` : project.name;
}

/** Return true if the task was completed within the last 7 days. */
function isRecentlyCompleted(task: Task): boolean {
  if (!task.completed_at) return true;
  const completedDate = new Date(task.completed_at);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  return completedDate >= sevenDaysAgo;
}

/** Seeded shuffle using a simple hash. Seed with today's date for daily rotation. */
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const result = [...arr];
  let s = seed;
  for (let i = result.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    const j = ((s >>> 0) % (i + 1)) >>> 0;
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Get a numeric seed from today's date (YYYYMMDD). */
function todaySeed(): number {
  const now = new Date();
  return now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
}

/** Get the day-of-year (0-based) for prompt selection. */
function dayOfYear(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
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
  onAssignmentsChange,
}: {
  title: string;
  tasks: Task[];
  color: 'default' | 'info' | 'success';
  onStatusChange: (task: Task) => void;
  onLogTime: (task: Task) => void;
  onAssignmentsChange?: (taskId: string, assignments: TaskAssignment[]) => void;
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
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
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
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    {onAssignmentsChange && (
                      <AssigneeAvatars
                        taskId={task.id}
                        assignments={task.assignments ?? []}
                        onAssignmentsChange={onAssignmentsChange}
                      />
                    )}
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
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);

  // Carousel state
  const [currentIndex, setCurrentIndex] = useState(0);
  const [slideDirection, setSlideDirection] = useState<'left' | 'right'>('right');
  const [visible, setVisible] = useState(true);

  // Tasks & Milestones per project (keyed by project id)
  const [tasksByProject, setTasksByProject] = useState<Record<string, Task[]>>({});
  const [milestonesByProject, setMilestonesByProject] = useState<Record<string, Milestone[]>>({});
  const [loadingProjects, setLoadingProjects] = useState<Set<string>>(new Set());

  // Planned section collapsed state
  const [plannedExpanded, setPlannedExpanded] = useState(false);

  // Log time modal
  const [logTimeOpen, setLogTimeOpen] = useState(false);
  const [logTimeProjectId, setLogTimeProjectId] = useState('');
  const [logTimeProjectName, setLogTimeProjectName] = useState('');

  // Snackbar
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');

  // Ref to track if keyboard listener is attached
  const containerRef = useRef<HTMLDivElement>(null);

  const showSnackbar = (message: string, severity: 'success' | 'error' = 'success') => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  };

  // ---- Derived project lists ----
  const activeProjects = useMemo(() => {
    const inProgress = allProjects.filter((p) => p.status === 'ACTIVE');
    return seededShuffle(inProgress, todaySeed());
  }, [allProjects]);

  const plannedProjects = useMemo(
    () => allProjects.filter((p) => p.status === 'PLANNED'),
    [allProjects],
  );

  const currentProject = activeProjects[currentIndex] ?? null;

  // ---- Daily standup prompt ----
  const standupPrompt = useMemo(() => {
    return STANDUP_PROMPTS[dayOfYear() % STANDUP_PROMPTS.length];
  }, []);

  // ---- Fetch projects on mount ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.get<Project[]>('/api/projects');
        if (!cancelled) {
          const nonArchived = data.filter(
            (p) => p.status !== 'ARCHIVED' && p.status !== 'COMPLETED',
          );
          setAllProjects(nonArchived);
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

  // ---- Fetch tasks for a project ----
  const fetchProjectTasks = useCallback(
    async (projectId: string) => {
      if (tasksByProject[projectId] || loadingProjects.has(projectId)) return;

      setLoadingProjects((prev) => new Set(prev).add(projectId));
      try {
        const [taskData, milestoneData] = await Promise.all([
          api.get<Task[]>(`/api/projects/${projectId}/tasks`),
          api.get<Milestone[]>(`/api/projects/${projectId}/milestones`),
        ]);
        setTasksByProject((prev) => ({ ...prev, [projectId]: taskData }));
        setMilestonesByProject((prev) => ({ ...prev, [projectId]: milestoneData }));
      } catch {
        setTasksByProject((prev) => ({ ...prev, [projectId]: [] }));
        setMilestonesByProject((prev) => ({ ...prev, [projectId]: [] }));
      } finally {
        setLoadingProjects((prev) => {
          const next = new Set(prev);
          next.delete(projectId);
          return next;
        });
      }
    },
    [tasksByProject, loadingProjects],
  );

  // ---- Fetch current + next project tasks ----
  useEffect(() => {
    if (activeProjects.length === 0) return;
    const current = activeProjects[currentIndex];
    if (current) fetchProjectTasks(current.id);
    // Prefetch next
    const next = activeProjects[currentIndex + 1];
    if (next) fetchProjectTasks(next.id);
  }, [currentIndex, activeProjects, fetchProjectTasks]);

  // ---- Keyboard navigation ----
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        goNext();
      } else if (e.key === 'ArrowLeft') {
        goPrev();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, activeProjects.length]);

  // ---- Navigation handlers ----
  const goNext = useCallback(() => {
    if (currentIndex >= activeProjects.length - 1) return;
    setSlideDirection('left');
    setVisible(false);
    setTimeout(() => {
      setCurrentIndex((prev) => prev + 1);
      setSlideDirection('right');
      setVisible(true);
    }, 200);
  }, [currentIndex, activeProjects.length]);

  const goPrev = useCallback(() => {
    if (currentIndex <= 0) return;
    setSlideDirection('right');
    setVisible(false);
    setTimeout(() => {
      setCurrentIndex((prev) => prev - 1);
      setSlideDirection('left');
      setVisible(true);
    }, 200);
  }, [currentIndex]);

  // ---- Current project data ----
  const currentTasks = currentProject ? (tasksByProject[currentProject.id] ?? []) : [];
  const currentMilestones = currentProject ? (milestonesByProject[currentProject.id] ?? []) : [];
  const isCurrentLoading = currentProject
    ? loadingProjects.has(currentProject.id) && !tasksByProject[currentProject.id]
    : false;

  // ---- Derived task lists ----
  const todoTasks = currentTasks.filter((t) => t.status === 'TODO');
  const inProgressTasks = currentTasks.filter((t) => t.status === 'IN_PROGRESS');
  const doneTasks = currentTasks.filter((t) => t.status === 'DONE' && isRecentlyCompleted(t));

  // ---- Completion stats ----
  const totalNonCancelled = currentTasks.filter((t) => t.status !== 'CANCELLED').length;
  const doneCount = currentTasks.filter((t) => t.status === 'DONE').length;
  const completionPercent = totalNonCancelled > 0 ? (doneCount / totalNonCancelled) * 100 : 0;
  const allCaughtUp =
    totalNonCancelled > 0 && todoTasks.length === 0 && inProgressTasks.length === 0;

  // ---- Status change handler (optimistic) ----
  const handleStatusChange = useCallback(
    async (task: Task) => {
      if (!currentProject) return;
      const newStatus = NEXT_STATUS[task.status];
      if (!newStatus) return;

      const projectId = currentProject.id;
      const previousTasks = tasksByProject[projectId] ?? [];

      setTasksByProject((prev) => ({
        ...prev,
        [projectId]: (prev[projectId] ?? []).map((t) =>
          t.id === task.id ? { ...t, status: newStatus } : t,
        ),
      }));

      try {
        await api.put(`/api/projects/${projectId}/tasks/${task.id}`, {
          status: newStatus,
        });
        showSnackbar(`Task moved to ${TASK_STATUS_LABEL[newStatus]}`);
      } catch (err) {
        setTasksByProject((prev) => ({
          ...prev,
          [projectId]: previousTasks,
        }));
        const message = err instanceof ApiError ? err.message : 'Failed to update task status.';
        showSnackbar(message, 'error');
      }
    },
    [currentProject, tasksByProject],
  );

  // ---- Assignments change handler ----
  const handleAssignmentsChange = useCallback(
    (taskId: string, assignments: TaskAssignment[]) => {
      if (!currentProject) return;
      const projectId = currentProject.id;
      setTasksByProject((prev) => ({
        ...prev,
        [projectId]: (prev[projectId] ?? []).map((t) =>
          t.id === taskId ? { ...t, assignments } : t,
        ),
      }));
    },
    [currentProject],
  );

  // ---- Log time handler ----
  const handleLogTime = useCallback(() => {
    if (!currentProject) return;
    setLogTimeProjectId(currentProject.id);
    setLogTimeProjectName(formatProjectName(currentProject));
    setLogTimeOpen(true);
  }, [currentProject]);

  // ---- Next project name for "up next" teaser ----
  const nextProject =
    currentIndex < activeProjects.length - 1 ? activeProjects[currentIndex + 1] : null;

  // ---- Loading state ----
  if (projectsLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  // ---- No active projects ----
  if (activeProjects.length === 0) {
    return (
      <Box sx={{ p: { xs: 2, sm: 4 } }}>
        <Typography variant="h3" sx={{ fontWeight: 600, mb: 3 }}>
          Standup
        </Typography>
        <Typography variant="body1" color="text.secondary">
          No active projects to review. Start a project to see it here.
        </Typography>
      </Box>
    );
  }

  return (
    <Box ref={containerRef} sx={{ p: { xs: 2, sm: 4 }, maxWidth: 1200, mx: 'auto' }}>
      {/* ---- Page Header & Daily Prompt ---- */}
      <Typography variant="h3" sx={{ fontWeight: 700, mb: 1 }}>
        Standup
      </Typography>
      <Typography
        variant="h6"
        sx={{
          fontWeight: 400,
          color: 'primary.main',
          fontStyle: 'italic',
          mb: 4,
          opacity: 0.85,
        }}
      >
        {standupPrompt}
      </Typography>

      {/* ---- Progress indicator ---- */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1,
          mb: 3,
        }}
      >
        {activeProjects.map((_, idx) => (
          <Box
            key={idx}
            sx={{
              width: idx === currentIndex ? 24 : 8,
              height: 8,
              borderRadius: 4,
              bgcolor: idx === currentIndex ? 'primary.main' : 'grey.300',
              transition: 'all 0.3s ease',
              cursor: 'pointer',
            }}
            onClick={() => {
              if (idx === currentIndex) return;
              setSlideDirection(idx > currentIndex ? 'left' : 'right');
              setVisible(false);
              setTimeout(() => {
                setCurrentIndex(idx);
                setSlideDirection(idx > currentIndex ? 'right' : 'left');
                setVisible(true);
              }, 200);
            }}
          />
        ))}
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mb: 3 }}>
        Project {currentIndex + 1} of {activeProjects.length}
      </Typography>

      {/* ---- Carousel Area ---- */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 2,
        }}
      >
        {/* ---- Previous Button ---- */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            pt: 15,
          }}
        >
          <IconButton
            onClick={goPrev}
            disabled={currentIndex === 0}
            sx={{
              width: 48,
              height: 48,
              bgcolor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider',
              '&:hover': { bgcolor: 'grey.100' },
              '&.Mui-disabled': { opacity: 0.3 },
            }}
          >
            <ArrowBackIosNewIcon />
          </IconButton>
        </Box>

        {/* ---- Project Spotlight ---- */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Fade in={visible} timeout={200}>
            <Box>
              {currentProject && (
                <>
                  {/* ---- Project Header ---- */}
                  <Box sx={{ textAlign: 'center', mb: 3 }}>
                    {currentProject.client && (
                      <Typography
                        variant="overline"
                        sx={{
                          color: 'text.secondary',
                          letterSpacing: 2,
                          fontSize: 13,
                        }}
                      >
                        {currentProject.client.name}
                      </Typography>
                    )}
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>
                      {currentProject.name}
                    </Typography>
                  </Box>

                  {/* ---- Completion Progress ---- */}
                  <Box sx={{ mb: 3, px: 2 }}>
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        mb: 0.5,
                      }}
                    >
                      <Typography variant="body2" color="text.secondary">
                        Completion
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {Math.round(completionPercent)}%
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={completionPercent}
                      sx={{
                        height: 8,
                        borderRadius: 4,
                        bgcolor: 'grey.200',
                        '& .MuiLinearProgress-bar': {
                          borderRadius: 4,
                          bgcolor: allCaughtUp ? 'success.main' : 'primary.main',
                        },
                      }}
                    />
                  </Box>

                  {/* ---- All Caught Up Message ---- */}
                  {allCaughtUp && (
                    <Fade in timeout={500}>
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 1,
                          mb: 3,
                          py: 2,
                          px: 3,
                          bgcolor: '#E8F5E9',
                          borderRadius: 2,
                          border: '1px solid #A5D6A7',
                        }}
                      >
                        <CheckCircleIcon sx={{ color: 'success.main', fontSize: 28 }} />
                        <Typography variant="h6" sx={{ fontWeight: 600, color: 'success.dark' }}>
                          All caught up!
                        </Typography>
                      </Box>
                    </Fade>
                  )}

                  {/* ---- Overdue Milestones ---- */}
                  {currentMilestones.filter((m) => m.is_overdue).length > 0 && (
                    <Box sx={{ mb: 3 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                        Overdue Milestones
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {currentMilestones
                          .filter((m) => m.is_overdue)
                          .map((m) => (
                            <Chip
                              key={m.id}
                              label={`${m.name} — Overdue`}
                              color="error"
                              variant="filled"
                              sx={{ fontSize: 13, height: 30 }}
                            />
                          ))}
                      </Box>
                    </Box>
                  )}

                  {/* ---- Kanban Board ---- */}
                  {isCurrentLoading ? (
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
                        onAssignmentsChange={handleAssignmentsChange}
                      />
                      <KanbanColumn
                        title="In Progress"
                        tasks={inProgressTasks}
                        color="info"
                        onStatusChange={handleStatusChange}
                        onLogTime={handleLogTime}
                        onAssignmentsChange={handleAssignmentsChange}
                      />
                      <KanbanColumn
                        title="Done (last 7 days)"
                        tasks={doneTasks}
                        color="success"
                        onStatusChange={handleStatusChange}
                        onLogTime={handleLogTime}
                        onAssignmentsChange={handleAssignmentsChange}
                      />
                    </Box>
                  )}
                </>
              )}
            </Box>
          </Fade>
        </Box>

        {/* ---- Next Button + "Up Next" Teaser ---- */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            pt: 15,
            gap: 2,
            minWidth: 100,
          }}
        >
          <IconButton
            onClick={goNext}
            disabled={currentIndex >= activeProjects.length - 1}
            sx={{
              width: 48,
              height: 48,
              bgcolor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider',
              '&:hover': { bgcolor: 'grey.100' },
              '&.Mui-disabled': { opacity: 0.3 },
            }}
          >
            <ArrowForwardIosIcon />
          </IconButton>
          {nextProject && (
            <Box sx={{ textAlign: 'center', opacity: 0.55 }}>
              <Typography variant="caption" sx={{ fontSize: 11, display: 'block' }}>
                Up next
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 500,
                  maxWidth: 100,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {nextProject.name}
              </Typography>
            </Box>
          )}
        </Box>
      </Box>

      {/* ---- Planned Projects Section ---- */}
      {plannedProjects.length > 0 && (
        <Box sx={{ mt: 6 }}>
          <Box
            onClick={() => setPlannedExpanded(!plannedExpanded)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              cursor: 'pointer',
              userSelect: 'none',
              '&:hover': { opacity: 0.8 },
            }}
          >
            {plannedExpanded ? (
              <ExpandLessIcon sx={{ color: 'text.secondary' }} />
            ) : (
              <ExpandMoreIcon sx={{ color: 'text.secondary' }} />
            )}
            <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.secondary' }}>
              Planned Projects
            </Typography>
            <Chip label={plannedProjects.length} size="small" sx={{ fontSize: 12, height: 22 }} />
          </Box>
          <Collapse in={plannedExpanded}>
            <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
              {plannedProjects.map((project) => (
                <Card
                  key={project.id}
                  elevation={0}
                  sx={{
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 2,
                    opacity: 0.75,
                  }}
                >
                  <CardContent
                    sx={{
                      p: 2,
                      '&:last-child': { pb: 2 },
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <Box>
                      <Typography variant="body1" sx={{ fontWeight: 500 }}>
                        {project.name}
                      </Typography>
                      {project.client && (
                        <Typography variant="caption" color="text.secondary">
                          {project.client.name}
                        </Typography>
                      )}
                    </Box>
                    <Chip label="Planned" size="small" variant="outlined" />
                  </CardContent>
                </Card>
              ))}
            </Box>
          </Collapse>
        </Box>
      )}

      {/* ---- Log Time Modal ---- */}
      <LogTimeModal
        open={logTimeOpen}
        onClose={() => setLogTimeOpen(false)}
        projectId={logTimeProjectId}
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
