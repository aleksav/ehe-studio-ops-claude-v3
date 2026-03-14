import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Collapse,
  Fade,
  FormControlLabel,
  IconButton,
  LinearProgress,
  Snackbar,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
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
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import FlagIcon from '@mui/icons-material/Flag';
import PeopleIcon from '@mui/icons-material/People';
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
  milestone_id?: string | null;
  assignments?: TaskAssignment[];
}

interface Milestone {
  id: string;
  project_id: string;
  name: string;
  due_date: string | null;
  is_overdue?: boolean;
}

type StandupViewMode = 'board' | 'milestones' | 'people';

interface SwimlaneData {
  id: string | null;
  name: string;
  due_date: string | null;
  is_overdue?: boolean;
  tasks: Task[];
}

interface PersonRow {
  memberId: string | null;
  memberName: string;
  tasks: Task[];
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
// Shared Task Card Component (used across Board, Milestones, People views)
// ---------------------------------------------------------------------------

function StandupTaskCard({
  task,
  onStatusChange,
  onLogTime,
  onAssignmentsChange,
  draggable,
  onDragStart,
}: {
  task: Task;
  onStatusChange: (task: Task) => void;
  onLogTime: (task: Task) => void;
  onAssignmentsChange?: (taskId: string, assignments: TaskAssignment[]) => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent, task: Task) => void;
}) {
  return (
    <Card
      elevation={0}
      draggable={draggable}
      onDragStart={draggable && onDragStart ? (e) => onDragStart(e, task) : undefined}
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        cursor: draggable ? 'grab' : undefined,
        '&:active': draggable ? { cursor: 'grabbing' } : undefined,
        '&[draggable]:hover': draggable ? { boxShadow: 2 } : undefined,
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
  );
}

// ---------------------------------------------------------------------------
// Milestone Swimlane Component (with drag-and-drop support)
// ---------------------------------------------------------------------------

function StandupMilestoneSwimlane({
  swimlane,
  onStatusChange,
  onLogTime,
  onAssignmentsChange,
  onDropTask,
  dragOverLaneId,
  onDragOver,
  onDragLeave,
  onDragStartTask,
}: {
  swimlane: SwimlaneData;
  onStatusChange: (task: Task) => void;
  onLogTime: (task: Task) => void;
  onAssignmentsChange?: (taskId: string, assignments: TaskAssignment[]) => void;
  onDropTask: (e: React.DragEvent, targetMilestoneId: string | null) => void;
  dragOverLaneId: string | null | undefined;
  onDragOver: (e: React.DragEvent, milestoneId: string | null) => void;
  onDragLeave: () => void;
  onDragStartTask: (e: React.DragEvent, task: Task) => void;
}) {
  const [expanded, setExpanded] = useState(true);

  const todoTasks = swimlane.tasks.filter((t) => t.status === 'TODO');
  const inProgressTasks = swimlane.tasks.filter((t) => t.status === 'IN_PROGRESS');
  const doneTasks = swimlane.tasks.filter((t) => t.status === 'DONE');
  const totalCount = todoTasks.length + inProgressTasks.length + doneTasks.length;

  const laneKey = swimlane.id ?? '__none__';
  const isDragOver = dragOverLaneId === laneKey;

  return (
    <Box
      sx={{ mb: 2.5 }}
      onDragOver={(e) => onDragOver(e, swimlane.id)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDropTask(e, swimlane.id)}
    >
      <Box
        onClick={() => setExpanded(!expanded)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          p: 1.5,
          borderLeft: swimlane.is_overdue
            ? '4px solid #f44336'
            : swimlane.id
              ? '4px solid #1976d2'
              : '4px solid #E91E63',
          borderRadius: 1,
          bgcolor: isDragOver ? 'action.hover' : swimlane.is_overdue ? '#FFEBEE' : 'grey.50',
          cursor: 'pointer',
          userSelect: 'none',
          transition: 'background-color 0.2s',
          '&:hover': { bgcolor: 'grey.100' },
        }}
      >
        {expanded ? (
          <ExpandLessIcon fontSize="small" color="action" />
        ) : (
          <ExpandMoreIcon fontSize="small" color="action" />
        )}
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          {swimlane.name}
        </Typography>
        {swimlane.due_date && (
          <Typography variant="caption" color="text.secondary">
            Due {new Date(swimlane.due_date).toLocaleDateString()}
          </Typography>
        )}
        {swimlane.is_overdue && (
          <Chip label="Overdue" size="small" color="error" sx={{ fontSize: 11, height: 22 }} />
        )}
        <Chip label={totalCount} size="small" sx={{ fontSize: 12, height: 22, ml: 'auto' }} />
      </Box>
      <Collapse in={expanded}>
        <Box
          sx={{
            pl: 2,
            mt: 1.5,
            minHeight: 40,
            border: isDragOver ? '2px dashed' : '2px dashed transparent',
            borderColor: isDragOver ? 'primary.main' : 'transparent',
            borderRadius: 1,
            transition: 'border-color 0.2s',
          }}
        >
          {totalCount === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
              {isDragOver ? 'Drop here to move task' : 'No tasks'}
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {[...todoTasks, ...inProgressTasks, ...doneTasks].map((task) => (
                <StandupTaskCard
                  key={task.id}
                  task={task}
                  onStatusChange={onStatusChange}
                  onLogTime={onLogTime}
                  onAssignmentsChange={onAssignmentsChange}
                  draggable
                  onDragStart={onDragStartTask}
                />
              ))}
            </Box>
          )}
        </Box>
      </Collapse>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// People Board Row Component (uses consistent task cards)
// ---------------------------------------------------------------------------

function StandupPeopleRow({
  row,
  onStatusChange,
  onLogTime,
  onAssignmentsChange,
}: {
  row: PersonRow;
  onStatusChange: (task: Task) => void;
  onLogTime: (task: Task) => void;
  onAssignmentsChange?: (taskId: string, assignments: TaskAssignment[]) => void;
}) {
  const todoTasks = row.tasks.filter((t) => t.status === 'TODO');
  const inProgressTasks = row.tasks.filter((t) => t.status === 'IN_PROGRESS');
  const doneTasks = row.tasks.filter((t) => t.status === 'DONE');
  const initial = row.memberName.charAt(0).toUpperCase();

  return (
    <Box sx={{ mb: 2.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1, px: 0.5 }}>
        <Avatar
          sx={{
            width: 28,
            height: 28,
            fontSize: 13,
            fontWeight: 700,
            bgcolor: row.memberId ? '#1565C0' : '#757575',
            color: '#fff',
          }}
        >
          {initial}
        </Avatar>
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          {row.memberName}
        </Typography>
        <Chip
          label={`${row.tasks.length} task${row.tasks.length === 1 ? '' : 's'}`}
          size="small"
          sx={{ fontSize: 11, height: 22 }}
        />
      </Box>
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          gap: 2,
          pl: 1,
        }}
      >
        {(['TODO', 'IN_PROGRESS', 'DONE'] as const).map((status) => {
          const statusTasks =
            status === 'TODO' ? todoTasks : status === 'IN_PROGRESS' ? inProgressTasks : doneTasks;
          const bgColor =
            status === 'IN_PROGRESS' ? '#E3F2FD' : status === 'DONE' ? '#E8F5E9' : '#F5F5F5';
          const label =
            status === 'TODO' ? 'TODO' : status === 'IN_PROGRESS' ? 'In Progress' : 'Done';

          return (
            <Box key={status} sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5, px: 0.5 }}>
                <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                  {label}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  ({statusTasks.length})
                </Typography>
              </Box>
              <Box
                sx={{
                  bgcolor: bgColor,
                  borderRadius: 1.5,
                  p: 1,
                  minHeight: 40,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1,
                }}
              >
                {statusTasks.length === 0 ? (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ textAlign: 'center', py: 1 }}
                  >
                    --
                  </Typography>
                ) : (
                  statusTasks.map((task) => (
                    <StandupTaskCard
                      key={task.id}
                      task={task}
                      onStatusChange={onStatusChange}
                      onLogTime={onLogTime}
                      onAssignmentsChange={onAssignmentsChange}
                    />
                  ))
                )}
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Kanban Column Component (with drag-and-drop between status columns)
// ---------------------------------------------------------------------------

function KanbanColumn({
  title,
  status,
  tasks,
  color,
  onStatusChange,
  onLogTime,
  onAssignmentsChange,
  onDropTask,
  dragOverStatus,
  onDragOver,
  onDragLeave,
  onDragStartTask,
}: {
  title: string;
  status: string;
  tasks: Task[];
  color: 'default' | 'info' | 'success';
  onStatusChange: (task: Task) => void;
  onLogTime: (task: Task) => void;
  onAssignmentsChange?: (taskId: string, assignments: TaskAssignment[]) => void;
  onDropTask: (e: React.DragEvent, targetStatus: string) => void;
  dragOverStatus: string | null;
  onDragOver: (e: React.DragEvent, status: string) => void;
  onDragLeave: () => void;
  onDragStartTask: (e: React.DragEvent, task: Task) => void;
}) {
  const bgColor = color === 'info' ? '#E3F2FD' : color === 'success' ? '#E8F5E9' : '#F5F5F5';
  const isDragOver = dragOverStatus === status;

  return (
    <Box
      sx={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
      }}
      onDragOver={(e) => onDragOver(e, status)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDropTask(e, status)}
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
          border: isDragOver ? '2px dashed' : '2px dashed transparent',
          borderColor: isDragOver ? 'primary.main' : 'transparent',
          transition: 'border-color 0.2s, background-color 0.2s',
        }}
      >
        {tasks.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
            {isDragOver ? 'Drop here to change status' : 'No tasks'}
          </Typography>
        ) : (
          tasks.map((task) => (
            <StandupTaskCard
              key={task.id}
              task={task}
              onStatusChange={onStatusChange}
              onLogTime={onLogTime}
              onAssignmentsChange={onAssignmentsChange}
              draggable
              onDragStart={onDragStartTask}
            />
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

  // View mode
  const [viewMode, setViewMode] = useState<StandupViewMode>('board');

  // Log time modal
  const [logTimeOpen, setLogTimeOpen] = useState(false);
  const [logTimeProjectId, setLogTimeProjectId] = useState('');
  const [logTimeProjectName, setLogTimeProjectName] = useState('');

  // Snackbar
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');

  // Drag-and-drop state
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<string | null>(null);
  const [dragOverMilestone, setDragOverMilestone] = useState<string | null | undefined>(undefined);

  // Hide empty milestones toggle (persisted in localStorage)
  const HIDE_EMPTY_KEY = 'standup-hide-empty-milestones';
  const [hideEmptyMilestones, setHideEmptyMilestones] = useState<boolean>(() => {
    return localStorage.getItem(HIDE_EMPTY_KEY) === 'true';
  });

  const handleHideEmptyChange = (checked: boolean) => {
    setHideEmptyMilestones(checked);
    localStorage.setItem(HIDE_EMPTY_KEY, String(checked));
  };

  // Ref to track if keyboard listener is attached
  const containerRef = useRef<HTMLDivElement>(null);

  const showSnackbar = (message: string, severity: 'success' | 'error' = 'success') => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  };

  // ---- Derived project lists ----
  const activeProjects = useMemo(() => {
    const active = allProjects.filter((p) => p.status === 'ACTIVE');
    return seededShuffle(active, todaySeed());
  }, [allProjects]);

  const plannedProjects = useMemo(
    () => allProjects.filter((p) => p.status === 'PLANNED'),
    [allProjects],
  );

  // Build carousel items: active projects + a "Planned" summary slide at the end
  const carouselItems = useMemo(() => {
    const items: Array<{ type: 'active'; project: Project } | { type: 'planned' }> =
      activeProjects.map((p) => ({ type: 'active' as const, project: p }));
    if (plannedProjects.length > 0) {
      items.push({ type: 'planned' as const });
    }
    return items;
  }, [activeProjects, plannedProjects]);

  const currentItem = carouselItems[currentIndex] ?? null;
  const currentProject = currentItem?.type === 'active' ? currentItem.project : null;

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
  }, [currentIndex, carouselItems.length]);

  // ---- Navigation handlers ----
  const goNext = useCallback(() => {
    if (currentIndex >= carouselItems.length - 1) return;
    setSlideDirection('left');
    setVisible(false);
    setTimeout(() => {
      setCurrentIndex((prev) => prev + 1);
      setSlideDirection('right');
      setVisible(true);
    }, 200);
  }, [currentIndex, carouselItems.length]);

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

  // ---- Milestone swimlanes ----
  const swimlanes = useMemo<SwimlaneData[]>(() => {
    if (!currentProject) return [];
    const sorted = [...currentMilestones].sort((a, b) => {
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    });

    const activeTasks = currentTasks.filter((t) => t.status !== 'CANCELLED');
    const lanes: SwimlaneData[] = sorted.map((m) => ({
      id: m.id,
      name: m.name,
      due_date: m.due_date,
      is_overdue: m.is_overdue,
      tasks: activeTasks.filter((t) => t.milestone_id === m.id),
    }));

    const unassigned = activeTasks.filter((t) => !t.milestone_id);
    if (unassigned.length > 0 || lanes.length > 0) {
      lanes.push({
        id: null,
        name: 'No Milestone',
        due_date: null,
        is_overdue: false,
        tasks: unassigned,
      });
    }
    return lanes;
  }, [currentProject, currentTasks, currentMilestones]);

  // ---- People rows ----
  const personRows = useMemo<PersonRow[]>(() => {
    if (!currentProject) return [];
    const memberMap = new Map<string, { member: TeamMemberRef; tasks: Task[] }>();
    const unassignedTasks: Task[] = [];

    for (const task of currentTasks) {
      if (task.status === 'CANCELLED') continue;
      const assignments = task.assignments ?? [];
      if (assignments.length === 0) {
        unassignedTasks.push(task);
      } else {
        for (const assignment of assignments) {
          const memberId = assignment.team_member.id;
          if (!memberMap.has(memberId)) {
            memberMap.set(memberId, { member: assignment.team_member, tasks: [] });
          }
          memberMap.get(memberId)!.tasks.push(task);
        }
      }
    }

    const rows: PersonRow[] = [];
    const sortedMembers = Array.from(memberMap.entries()).sort((a, b) =>
      a[1].member.full_name.localeCompare(b[1].member.full_name),
    );
    for (const [memberId, { member, tasks: memberTasks }] of sortedMembers) {
      rows.push({ memberId, memberName: member.full_name, tasks: memberTasks });
    }
    if (unassignedTasks.length > 0) {
      rows.push({ memberId: null, memberName: 'Unassigned', tasks: unassignedTasks });
    }
    return rows;
  }, [currentProject, currentTasks]);

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

  // ---- Log time handler for individual task (opens same modal) ----
  const handleLogTimeTask = useCallback(
    (_task: Task) => {
      handleLogTime();
    },
    [handleLogTime],
  );

  // ---- Drag-and-drop: Board view (status columns) ----
  const handleBoardDragStart = useCallback((e: React.DragEvent, task: Task) => {
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', task.id);
  }, []);

  const handleBoardDragOver = useCallback((e: React.DragEvent, status: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverStatus(status);
  }, []);

  const handleBoardDragLeave = useCallback(() => {
    setDragOverStatus(null);
  }, []);

  const handleBoardDrop = useCallback(
    async (e: React.DragEvent, targetStatus: string) => {
      e.preventDefault();
      setDragOverStatus(null);
      if (!draggedTask || !currentProject) return;
      if (draggedTask.status === targetStatus) {
        setDraggedTask(null);
        return;
      }

      const projectId = currentProject.id;
      const taskId = draggedTask.id;
      const previousTasks = tasksByProject[projectId] ?? [];

      // Optimistic update
      setTasksByProject((prev) => ({
        ...prev,
        [projectId]: (prev[projectId] ?? []).map((t) =>
          t.id === taskId ? { ...t, status: targetStatus } : t,
        ),
      }));
      setDraggedTask(null);

      try {
        await api.put(`/api/projects/${projectId}/tasks/${taskId}`, {
          status: targetStatus,
        });
        showSnackbar(`Task moved to ${TASK_STATUS_LABEL[targetStatus]}`);
      } catch (err) {
        setTasksByProject((prev) => ({
          ...prev,
          [projectId]: previousTasks,
        }));
        const message = err instanceof ApiError ? err.message : 'Failed to update task status.';
        showSnackbar(message, 'error');
      }
    },
    [draggedTask, currentProject, tasksByProject],
  );

  // ---- Drag-and-drop: Milestones view ----
  const handleMilestoneDragStart = useCallback((e: React.DragEvent, task: Task) => {
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', task.id);
  }, []);

  const handleMilestoneDragOver = useCallback((e: React.DragEvent, milestoneId: string | null) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverMilestone(milestoneId ?? '__none__');
  }, []);

  const handleMilestoneDragLeave = useCallback(() => {
    setDragOverMilestone(undefined);
  }, []);

  const handleMilestoneDrop = useCallback(
    async (e: React.DragEvent, targetMilestoneId: string | null) => {
      e.preventDefault();
      setDragOverMilestone(undefined);
      if (!draggedTask || !currentProject) return;

      const currentMilestoneId = draggedTask.milestone_id ?? null;
      if (currentMilestoneId === targetMilestoneId) {
        setDraggedTask(null);
        return;
      }

      const projectId = currentProject.id;
      const taskId = draggedTask.id;
      const previousTasks = tasksByProject[projectId] ?? [];

      // Optimistic update
      setTasksByProject((prev) => ({
        ...prev,
        [projectId]: (prev[projectId] ?? []).map((t) =>
          t.id === taskId ? { ...t, milestone_id: targetMilestoneId } : t,
        ),
      }));
      setDraggedTask(null);

      try {
        await api.put(`/api/projects/${projectId}/tasks/${taskId}`, {
          milestone_id: targetMilestoneId,
        });
        const targetName =
          targetMilestoneId === null
            ? 'No Milestone'
            : (currentMilestones.find((m) => m.id === targetMilestoneId)?.name ?? 'milestone');
        showSnackbar(`Task moved to ${targetName}`);
      } catch (err) {
        setTasksByProject((prev) => ({
          ...prev,
          [projectId]: previousTasks,
        }));
        const message = err instanceof ApiError ? err.message : 'Failed to move task.';
        showSnackbar(message, 'error');
      }
    },
    [draggedTask, currentProject, tasksByProject, currentMilestones],
  );

  // ---- Filtered swimlanes (hide empty milestones) ----
  const filteredSwimlanes = useMemo(() => {
    if (!hideEmptyMilestones) return swimlanes;
    return swimlanes.filter((lane) => {
      const hasActiveTasks = lane.tasks.some(
        (t) => t.status === 'IN_PROGRESS' || t.status === 'DONE',
      );
      return hasActiveTasks;
    });
  }, [swimlanes, hideEmptyMilestones]);

  const hiddenMilestoneCount = swimlanes.length - filteredSwimlanes.length;

  // ---- Next item for "up next" teaser ----
  const nextItem = currentIndex < carouselItems.length - 1 ? carouselItems[currentIndex + 1] : null;

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
        {carouselItems.map((item, idx) => (
          <Box
            key={idx}
            sx={{
              width: idx === currentIndex ? 24 : 8,
              height: 8,
              borderRadius: 4,
              bgcolor:
                idx === currentIndex
                  ? item.type === 'planned'
                    ? 'grey.500'
                    : 'primary.main'
                  : 'grey.300',
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
        {currentItem?.type === 'planned'
          ? 'Coming Up Next'
          : `Project ${currentIndex + 1} of ${activeProjects.length}`}
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
            flexDirection: 'column',
            alignItems: 'center',
            pt: 12,
            gap: 1,
            minWidth: 80,
          }}
        >
          <IconButton
            onClick={goPrev}
            disabled={currentIndex === 0}
            sx={{
              width: 56,
              height: 56,
              bgcolor: 'primary.main',
              color: '#fff',
              boxShadow: 2,
              '&:hover': { bgcolor: 'primary.dark' },
              '&.Mui-disabled': { bgcolor: 'grey.200', color: 'grey.400', boxShadow: 0 },
            }}
          >
            <ArrowBackIosNewIcon sx={{ fontSize: 24 }} />
          </IconButton>
          {currentIndex > 0 && (
            <Typography
              variant="caption"
              sx={{ color: 'text.secondary', fontSize: 11, textAlign: 'center' }}
            >
              Previous
            </Typography>
          )}
        </Box>

        {/* ---- Project Spotlight ---- */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Fade in={visible} timeout={200}>
            <Box>
              {/* ---- Planned Projects Slide ---- */}
              {currentItem?.type === 'planned' && (
                <Box>
                  <Box sx={{ textAlign: 'center', mb: 4 }}>
                    <Typography
                      variant="overline"
                      sx={{ color: 'text.secondary', letterSpacing: 2, fontSize: 13 }}
                    >
                      Coming Up
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>
                      Planned Projects
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      {plannedProjects.length} project
                      {plannedProjects.length !== 1 ? 's' : ''} in the pipeline
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {plannedProjects.map((project) => (
                      <Card
                        key={project.id}
                        elevation={0}
                        sx={{
                          border: '1px solid',
                          borderColor: 'divider',
                          borderRadius: 2,
                        }}
                      >
                        <CardContent
                          sx={{
                            p: 2.5,
                            '&:last-child': { pb: 2.5 },
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
                </Box>
              )}

              {/* ---- Active Project Slide ---- */}
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

                  {/* ---- View Toggle ---- */}
                  <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                    <ToggleButtonGroup
                      value={viewMode}
                      exclusive
                      onChange={(_: React.MouseEvent<HTMLElement>, v: StandupViewMode | null) => {
                        if (v !== null) setViewMode(v);
                      }}
                      size="small"
                    >
                      <ToggleButton value="board" aria-label="Board view">
                        <ViewColumnIcon sx={{ mr: 0.5, fontSize: 18 }} />
                        Board
                      </ToggleButton>
                      <ToggleButton value="milestones" aria-label="Milestones view">
                        <FlagIcon sx={{ mr: 0.5, fontSize: 18 }} />
                        Milestones
                      </ToggleButton>
                      <ToggleButton value="people" aria-label="People view">
                        <PeopleIcon sx={{ mr: 0.5, fontSize: 18 }} />
                        People
                      </ToggleButton>
                    </ToggleButtonGroup>
                  </Box>

                  {/* ---- Task Views ---- */}
                  {isCurrentLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                      <CircularProgress size={24} />
                    </Box>
                  ) : viewMode === 'board' ? (
                    <Box
                      sx={{
                        display: 'flex',
                        flexDirection: { xs: 'column', md: 'row' },
                        gap: 3,
                      }}
                    >
                      <KanbanColumn
                        title="TODO"
                        status="TODO"
                        tasks={todoTasks}
                        color="default"
                        onStatusChange={handleStatusChange}
                        onLogTime={handleLogTimeTask}
                        onAssignmentsChange={handleAssignmentsChange}
                        onDropTask={handleBoardDrop}
                        dragOverStatus={dragOverStatus}
                        onDragOver={handleBoardDragOver}
                        onDragLeave={handleBoardDragLeave}
                        onDragStartTask={handleBoardDragStart}
                      />
                      <KanbanColumn
                        title="In Progress"
                        status="IN_PROGRESS"
                        tasks={inProgressTasks}
                        color="info"
                        onStatusChange={handleStatusChange}
                        onLogTime={handleLogTimeTask}
                        onAssignmentsChange={handleAssignmentsChange}
                        onDropTask={handleBoardDrop}
                        dragOverStatus={dragOverStatus}
                        onDragOver={handleBoardDragOver}
                        onDragLeave={handleBoardDragLeave}
                        onDragStartTask={handleBoardDragStart}
                      />
                      <KanbanColumn
                        title="Done (last 7 days)"
                        status="DONE"
                        tasks={doneTasks}
                        color="success"
                        onStatusChange={handleStatusChange}
                        onLogTime={handleLogTimeTask}
                        onAssignmentsChange={handleAssignmentsChange}
                        onDropTask={handleBoardDrop}
                        dragOverStatus={dragOverStatus}
                        onDragOver={handleBoardDragOver}
                        onDragLeave={handleBoardDragLeave}
                        onDragStartTask={handleBoardDragStart}
                      />
                    </Box>
                  ) : viewMode === 'milestones' ? (
                    <>
                      {/* Hide empty milestones toggle */}
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          mb: 1.5,
                          gap: 1,
                        }}
                      >
                        <FormControlLabel
                          control={
                            <Switch
                              checked={hideEmptyMilestones}
                              onChange={(e) => handleHideEmptyChange(e.target.checked)}
                              size="small"
                            />
                          }
                          label={
                            <Typography variant="body2" color="text.secondary">
                              Show only active milestones
                            </Typography>
                          }
                        />
                        {hiddenMilestoneCount > 0 && (
                          <Typography variant="caption" color="text.secondary">
                            ({hiddenMilestoneCount} hidden)
                          </Typography>
                        )}
                      </Box>
                      {filteredSwimlanes.length === 0 ? (
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ py: 4, textAlign: 'center' }}
                        >
                          No milestones or tasks to display.
                        </Typography>
                      ) : (
                        filteredSwimlanes.map((lane) => (
                          <StandupMilestoneSwimlane
                            key={lane.id ?? '__none__'}
                            swimlane={lane}
                            onStatusChange={handleStatusChange}
                            onLogTime={handleLogTimeTask}
                            onAssignmentsChange={handleAssignmentsChange}
                            onDropTask={handleMilestoneDrop}
                            dragOverLaneId={dragOverMilestone}
                            onDragOver={handleMilestoneDragOver}
                            onDragLeave={handleMilestoneDragLeave}
                            onDragStartTask={handleMilestoneDragStart}
                          />
                        ))
                      )}
                    </>
                  ) : (
                    <>
                      {personRows.length === 0 ? (
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ py: 4, textAlign: 'center' }}
                        >
                          No tasks to display.
                        </Typography>
                      ) : (
                        personRows.map((row) => (
                          <StandupPeopleRow
                            key={row.memberId ?? 'unassigned'}
                            row={row}
                            onStatusChange={handleStatusChange}
                            onLogTime={handleLogTimeTask}
                            onAssignmentsChange={handleAssignmentsChange}
                          />
                        ))
                      )}
                    </>
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
            pt: 12,
            gap: 1,
            minWidth: 80,
          }}
        >
          <IconButton
            onClick={goNext}
            disabled={currentIndex >= carouselItems.length - 1}
            sx={{
              width: 56,
              height: 56,
              bgcolor: 'primary.main',
              color: '#fff',
              boxShadow: 2,
              '&:hover': { bgcolor: 'primary.dark' },
              '&.Mui-disabled': { bgcolor: 'grey.200', color: 'grey.400', boxShadow: 0 },
            }}
          >
            <ArrowForwardIosIcon sx={{ fontSize: 24 }} />
          </IconButton>
          {nextItem && (
            <Box sx={{ textAlign: 'center' }}>
              <Typography
                variant="caption"
                sx={{ color: 'text.secondary', fontSize: 11, display: 'block' }}
              >
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
                  color: 'text.secondary',
                }}
              >
                {nextItem.type === 'planned' ? 'Planned' : nextItem.project.name}
              </Typography>
            </Box>
          )}
        </Box>
      </Box>

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
