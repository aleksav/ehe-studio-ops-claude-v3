import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  Fade,
  FormControl,
  IconButton,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Snackbar,
  TextField,
  Typography,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import BeachAccessIcon from '@mui/icons-material/BeachAccess';
import { api, ApiError } from '../lib/api';
import LogTimeModal from '../components/LogTimeModal';
import ProjectTaskBoard from '../components/ProjectTaskBoard';
import type { BoardTask, BoardMilestone } from '../components/ProjectTaskBoard';

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
  external_board_url: string | null;
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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'DONE'] as const;

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatProjectName(project: Project): string {
  return project.client ? `${project.client.name} — ${project.name}` : project.name;
}

// ---------------------------------------------------------------------------
// Holiday / leave helpers
// ---------------------------------------------------------------------------

interface PlannedHolidayRaw {
  id: string;
  team_member_id: string;
  date: string;
  day_type: 'FULL' | 'AM' | 'PM';
  notes: string | null;
}

interface TeamMemberBasic {
  id: string;
  full_name: string;
  is_active: boolean;
}

interface LeaveEntry {
  name: string;
  dates: string[];
  dayTypes: Map<string, string>; // dateKey -> FULL/AM/PM
}

function getMonday(d: Date): Date {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const m = new Date(d);
  m.setDate(diff);
  m.setHours(0, 0, 0, 0);
  return m;
}

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

function buildLeaveGroups(
  holidays: PlannedHolidayRaw[],
  members: TeamMemberBasic[],
): { today: LeaveEntry[]; thisWeek: LeaveEntry[]; nextWeek: LeaveEntry[] } {
  const now = new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const thisMonday = getMonday(now);
  const thisSunday = new Date(thisMonday);
  thisSunday.setDate(thisSunday.getDate() + 6);

  const nextMonday = new Date(thisMonday);
  nextMonday.setDate(nextMonday.getDate() + 7);
  const nextSunday = new Date(nextMonday);
  nextSunday.setDate(nextSunday.getDate() + 6);

  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const thisMondayKey = fmt(thisMonday);
  const thisSundayKey = fmt(thisSunday);
  const nextMondayKey = fmt(nextMonday);
  const nextSundayKey = fmt(nextSunday);

  const memberMap = new Map(members.map((m) => [m.id, m.full_name]));

  // Group holidays by member
  const byMember = new Map<string, { dates: string[]; dayTypes: Map<string, string> }>();
  for (const h of holidays) {
    const dk = h.date.substring(0, 10);
    if (!byMember.has(h.team_member_id)) {
      byMember.set(h.team_member_id, { dates: [], dayTypes: new Map() });
    }
    const entry = byMember.get(h.team_member_id)!;
    entry.dates.push(dk);
    entry.dayTypes.set(dk, h.day_type);
  }

  const todayEntries: LeaveEntry[] = [];
  const thisWeekEntries: LeaveEntry[] = [];
  const nextWeekEntries: LeaveEntry[] = [];

  for (const [memberId, data] of byMember) {
    const name = memberMap.get(memberId) ?? memberId;
    const isOffToday = data.dates.includes(todayKey);

    // This week dates (excluding today to avoid duplication)
    const thisWeekDates = data.dates.filter(
      (d) => d >= thisMondayKey && d <= thisSundayKey && d !== todayKey,
    );

    // Next week dates
    const nextWeekDates = data.dates.filter((d) => d >= nextMondayKey && d <= nextSundayKey);

    if (isOffToday) {
      // If also off rest of week, combine into one entry
      const allThisWeekDates = data.dates.filter((d) => d >= thisMondayKey && d <= thisSundayKey);
      todayEntries.push({
        name,
        dates: allThisWeekDates,
        dayTypes: data.dayTypes,
      });
    } else if (thisWeekDates.length > 0) {
      thisWeekEntries.push({
        name,
        dates: thisWeekDates,
        dayTypes: data.dayTypes,
      });
    }

    if (nextWeekDates.length > 0) {
      nextWeekEntries.push({
        name,
        dates: nextWeekDates,
        dayTypes: data.dayTypes,
      });
    }
  }

  return { today: todayEntries, thisWeek: thisWeekEntries, nextWeek: nextWeekEntries };
}

/** Return true if the task was completed within the last 7 days. */
function isRecentlyCompleted(task: BoardTask): boolean {
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function StandupPage() {
  // Projects
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);

  // Leave data
  const [leaveGroups, setLeaveGroups] = useState<{
    today: LeaveEntry[];
    thisWeek: LeaveEntry[];
    nextWeek: LeaveEntry[];
  }>({ today: [], thisWeek: [], nextWeek: [] });

  // Carousel state
  const [currentIndex, setCurrentIndex] = useState(0);
  const [slideDirection, setSlideDirection] = useState<'left' | 'right'>('right');
  const [visible, setVisible] = useState(true);

  // Tasks & Milestones per project (keyed by project id)
  const [tasksByProject, setTasksByProject] = useState<Record<string, BoardTask[]>>({});
  const [milestonesByProject, setMilestonesByProject] = useState<Record<string, BoardMilestone[]>>(
    {},
  );
  const [loadingProjects, setLoadingProjects] = useState<Set<string>>(new Set());

  // Log time modal
  const [logTimeOpen, setLogTimeOpen] = useState(false);
  const [logTimeProjectId, setLogTimeProjectId] = useState('');
  const [logTimeProjectName, setLogTimeProjectName] = useState('');

  // Snackbar
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');

  // Hide empty milestones toggle (persisted in localStorage)
  const HIDE_EMPTY_KEY = 'standup-hide-empty-milestones';
  const initialHideEmpty = localStorage.getItem(HIDE_EMPTY_KEY) !== 'false';

  const handleHideEmptyChange = (checked: boolean) => {
    localStorage.setItem(HIDE_EMPTY_KEY, String(checked));
  };

  // Add task dialog
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskStatus, setNewTaskStatus] = useState<string>('TODO');
  const [newTaskMilestoneId, setNewTaskMilestoneId] = useState<string>('');
  const [addTaskSubmitting, setAddTaskSubmitting] = useState(false);

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

  const hasLeave =
    leaveGroups.today.length > 0 ||
    leaveGroups.thisWeek.length > 0 ||
    leaveGroups.nextWeek.length > 0;

  // Build carousel items: holidays first, then active projects, then planned
  const carouselItems = useMemo(() => {
    const items: Array<
      { type: 'holidays' } | { type: 'active'; project: Project } | { type: 'planned' }
    > = [];
    items.push({ type: 'holidays' as const });
    for (const p of activeProjects) {
      items.push({ type: 'active' as const, project: p });
    }
    if (plannedProjects.length > 0) {
      items.push({ type: 'planned' as const });
    }
    return items;
  }, [activeProjects, plannedProjects]);

  const currentItem = carouselItems[currentIndex] ?? null;
  const currentProject = currentItem?.type === 'active' ? currentItem.project : null;

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

  // ---- Fetch leave data ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const year = new Date().getFullYear();
        const [holidays, members] = await Promise.all([
          api.get<PlannedHolidayRaw[]>(`/api/planned-holidays?year=${year}`),
          api.get<TeamMemberBasic[]>('/api/team-members'),
        ]);
        if (!cancelled) {
          const active = members.filter((m) => m.is_active);
          setLeaveGroups(buildLeaveGroups(holidays, active));
        }
      } catch {
        // silently fail
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
          api.get<BoardTask[]>(`/api/projects/${projectId}/tasks`),
          api.get<BoardMilestone[]>(`/api/projects/${projectId}/milestones`),
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

  // ---- Completion stats ----
  const totalNonCancelled = currentTasks.filter((t) => t.status !== 'CANCELLED').length;
  const doneCount = currentTasks.filter((t) => t.status === 'DONE').length;
  const completionPercent = totalNonCancelled > 0 ? (doneCount / totalNonCancelled) * 100 : 0;
  const todoCount = currentTasks.filter((t) => t.status === 'TODO').length;
  const inProgressCount = currentTasks.filter((t) => t.status === 'IN_PROGRESS').length;
  const allCaughtUp = totalNonCancelled > 0 && todoCount === 0 && inProgressCount === 0;

  // ---- Status change handler (optimistic) ----
  const handleStatusChange = useCallback(
    async (task: BoardTask) => {
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
    (_task: BoardTask) => {
      handleLogTime();
    },
    [handleLogTime],
  );

  // ---- Create task handler ----
  const handleCreateTask = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!currentProject || !newTaskDescription.trim() || addTaskSubmitting) return;

      const projectId = currentProject.id;
      setAddTaskSubmitting(true);
      try {
        const body: Record<string, string> = {
          description: newTaskDescription.trim(),
          status: newTaskStatus,
        };
        if (newTaskMilestoneId) {
          body.milestone_id = newTaskMilestoneId;
        }
        await api.post(`/api/projects/${projectId}/tasks`, body);
        showSnackbar('Task created');
        setAddTaskOpen(false);
        setNewTaskDescription('');
        setNewTaskStatus('TODO');
        setNewTaskMilestoneId('');
        // Refresh tasks for this project
        const [updatedTasks, updatedMilestones] = await Promise.all([
          api.get<BoardTask[]>(`/api/projects/${projectId}/tasks`),
          api.get<BoardMilestone[]>(`/api/projects/${projectId}/milestones`),
        ]);
        setTasksByProject((prev) => ({ ...prev, [projectId]: updatedTasks }));
        setMilestonesByProject((prev) => ({ ...prev, [projectId]: updatedMilestones }));
      } catch (err) {
        const message = err instanceof ApiError ? err.message : 'Failed to create task.';
        showSnackbar(message, 'error');
      } finally {
        setAddTaskSubmitting(false);
      }
    },
    [currentProject, newTaskDescription, newTaskStatus, newTaskMilestoneId, addTaskSubmitting],
  );

  // ---- Drag-and-drop: Board view (status columns) ----
  const handleDropStatus = useCallback(
    async (task: BoardTask, targetStatus: string) => {
      if (!currentProject) return;
      const projectId = currentProject.id;
      const previousTasks = tasksByProject[projectId] ?? [];

      // Optimistic update
      setTasksByProject((prev) => ({
        ...prev,
        [projectId]: (prev[projectId] ?? []).map((t) =>
          t.id === task.id ? { ...t, status: targetStatus } : t,
        ),
      }));

      try {
        await api.put(`/api/projects/${projectId}/tasks/${task.id}`, {
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
    [currentProject, tasksByProject],
  );

  // ---- Drag-and-drop: Milestones view ----
  const handleDropMilestone = useCallback(
    async (task: BoardTask, targetMilestoneId: string | null) => {
      if (!currentProject) return;
      const projectId = currentProject.id;
      const previousTasks = tasksByProject[projectId] ?? [];

      // Optimistic update
      setTasksByProject((prev) => ({
        ...prev,
        [projectId]: (prev[projectId] ?? []).map((t) =>
          t.id === task.id ? { ...t, milestone_id: targetMilestoneId } : t,
        ),
      }));

      try {
        await api.put(`/api/projects/${projectId}/tasks/${task.id}`, {
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
    [currentProject, tasksByProject, currentMilestones],
  );

  // ---- Drag-and-drop: People view ----
  const handleDropPerson = useCallback(
    async (task: BoardTask, targetMemberId: string | null) => {
      if (!currentProject) return;
      const taskId = task.id;
      const projectId = currentProject.id;
      const previousTasks = tasksByProject[projectId] ?? [];

      const currentAssignments = task.assignments ?? [];
      const currentMemberIds = currentAssignments.map((a) => a.team_member_id);

      if (targetMemberId === null && currentAssignments.length === 0) return;
      if (targetMemberId && currentMemberIds.includes(targetMemberId)) return;

      try {
        if (targetMemberId === null) {
          // Remove all assignments
          for (const assignment of currentAssignments) {
            await api.delete(`/api/tasks/${taskId}/assignments/${assignment.id}`);
          }
          setTasksByProject((prev) => ({
            ...prev,
            [projectId]: (prev[projectId] ?? []).map((t) =>
              t.id === taskId ? { ...t, assignments: [] } : t,
            ),
          }));
          showSnackbar('Task unassigned');
        } else {
          // Add new assignment
          const result = await api.post<TaskAssignment>(`/api/tasks/${taskId}/assignments`, {
            team_member_id: targetMemberId,
          });
          setTasksByProject((prev) => ({
            ...prev,
            [projectId]: (prev[projectId] ?? []).map((t) =>
              t.id === taskId ? { ...t, assignments: [...(t.assignments ?? []), result] } : t,
            ),
          }));
          showSnackbar('Task reassigned');
        }
      } catch (err) {
        setTasksByProject((prev) => ({
          ...prev,
          [projectId]: previousTasks,
        }));
        const message = err instanceof ApiError ? err.message : 'Failed to reassign task.';
        showSnackbar(message, 'error');
      }
    },
    [currentProject, tasksByProject],
  );

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
    <Box ref={containerRef} sx={{ p: { xs: 1.5, sm: 3 }, maxWidth: 1200, mx: 'auto' }}>
      {/* ---- Progress dots + Counter ---- */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          mb: 1,
          gap: 1,
        }}
      >
        {carouselItems.map((item, idx) => (
          <Box
            key={idx}
            sx={{
              width: idx === currentIndex ? 20 : 7,
              height: 7,
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
        <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
          {currentItem?.type === 'holidays'
            ? 'Availability'
            : currentItem?.type === 'planned'
              ? 'Coming Up'
              : `${currentIndex}/${activeProjects.length}`}
        </Typography>
      </Box>

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
            pt: 2,
            gap: 0.5,
            minWidth: 72,
          }}
        >
          <IconButton
            onClick={goPrev}
            disabled={currentIndex === 0}
            sx={{
              width: 48,
              height: 48,
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
              {/* ---- Holidays Slide ---- */}
              {currentItem?.type === 'holidays' && (
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <BeachAccessIcon sx={{ color: 'primary.main' }} />
                    <Typography variant="h5" sx={{ fontWeight: 700 }}>
                      Team Availability
                    </Typography>
                  </Box>
                  {!hasLeave ? (
                    <Card
                      elevation={0}
                      sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}
                    >
                      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                        <Typography variant="body1" color="text.secondary">
                          Everyone is available — no leave booked for this period.
                        </Typography>
                      </CardContent>
                    </Card>
                  ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {leaveGroups.today.length > 0 && (
                        <Card
                          elevation={0}
                          sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}
                        >
                          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                            <Typography
                              variant="body2"
                              sx={{ fontWeight: 600, mb: 1, color: 'error.main' }}
                            >
                              Off Today
                            </Typography>
                            {leaveGroups.today.map((entry) => {
                              const extraDays = entry.dates.length > 1;
                              return (
                                <Box key={entry.name} sx={{ mb: 0.5 }}>
                                  <Typography variant="body2">
                                    <strong>{entry.name}</strong>
                                    {entry.dayTypes.get(entry.dates[0]) !== 'FULL' &&
                                      ` (${entry.dayTypes.get(entry.dates[0])} only)`}
                                    {extraDays &&
                                      ` — off until ${formatDateShort(entry.dates[entry.dates.length - 1])}`}
                                  </Typography>
                                </Box>
                              );
                            })}
                          </CardContent>
                        </Card>
                      )}
                      {leaveGroups.thisWeek.length > 0 && (
                        <Card
                          elevation={0}
                          sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}
                        >
                          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                            <Typography
                              variant="body2"
                              sx={{ fontWeight: 600, mb: 1, color: 'warning.main' }}
                            >
                              Later This Week
                            </Typography>
                            {leaveGroups.thisWeek.map((entry) => (
                              <Box key={entry.name} sx={{ mb: 0.5 }}>
                                <Typography variant="body2">
                                  <strong>{entry.name}</strong>
                                  {' — '}
                                  {entry.dates
                                    .map((d) => {
                                      const dt = entry.dayTypes.get(d);
                                      const label = formatDateShort(d);
                                      return dt !== 'FULL' ? `${label} (${dt})` : label;
                                    })
                                    .join(', ')}
                                </Typography>
                              </Box>
                            ))}
                          </CardContent>
                        </Card>
                      )}
                      {leaveGroups.nextWeek.length > 0 && (
                        <Card
                          elevation={0}
                          sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}
                        >
                          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                            <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                              Next Week
                            </Typography>
                            {leaveGroups.nextWeek.map((entry) => (
                              <Box key={entry.name} sx={{ mb: 0.5 }}>
                                <Typography variant="body2">
                                  <strong>{entry.name}</strong>
                                  {' — '}
                                  {entry.dates
                                    .map((d) => {
                                      const dt = entry.dayTypes.get(d);
                                      const label = formatDateShort(d);
                                      return dt !== 'FULL' ? `${label} (${dt})` : label;
                                    })
                                    .join(', ')}
                                </Typography>
                              </Box>
                            ))}
                          </CardContent>
                        </Card>
                      )}
                    </Box>
                  )}
                </Box>
              )}

              {/* ---- Planned Projects Slide ---- */}
              {currentItem?.type === 'planned' && (
                <Box>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="h5" sx={{ fontWeight: 700 }}>
                      Planned Projects
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
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
                  {/* ---- Project Header + Progress (compact inline) ---- */}
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      mb: 1.5,
                      gap: 2,
                    }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      {currentProject.client && (
                        <Typography
                          variant="caption"
                          sx={{
                            color: 'text.secondary',
                            letterSpacing: 1,
                            textTransform: 'uppercase',
                            fontSize: 11,
                          }}
                        >
                          {currentProject.client.name}
                        </Typography>
                      )}
                      <Typography
                        variant="h5"
                        sx={{
                          fontWeight: 700,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {currentProject.name}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexShrink: 0 }}>
                      {allCaughtUp ? (
                        <Chip
                          icon={<CheckCircleIcon />}
                          label="All caught up"
                          color="success"
                          size="small"
                          sx={{ fontWeight: 600 }}
                        />
                      ) : (
                        <>
                          <LinearProgress
                            variant="determinate"
                            value={completionPercent}
                            sx={{
                              width: 120,
                              height: 6,
                              borderRadius: 3,
                              bgcolor: 'grey.200',
                              '& .MuiLinearProgress-bar': {
                                borderRadius: 3,
                                bgcolor: 'primary.main',
                              },
                            }}
                          />
                          <Typography
                            variant="caption"
                            sx={{ fontWeight: 600, color: 'text.secondary' }}
                          >
                            {Math.round(completionPercent)}%
                          </Typography>
                        </>
                      )}
                      {currentMilestones.filter((m) => m.is_overdue).length > 0 &&
                        currentMilestones
                          .filter((m) => m.is_overdue)
                          .map((m) => (
                            <Chip
                              key={m.id}
                              label={`${m.name} — Overdue`}
                              color="error"
                              size="small"
                              sx={{ fontSize: 12 }}
                            />
                          ))}
                      <Button
                        variant="contained"
                        size="small"
                        startIcon={<AddIcon />}
                        onClick={() => setAddTaskOpen(true)}
                      >
                        Add Task
                      </Button>
                    </Box>
                  </Box>

                  {/* ---- Task Board ---- */}
                  {currentProject.external_board_url ? (
                    <Card
                      elevation={0}
                      sx={{
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 2,
                        p: 3,
                      }}
                    >
                      <Typography variant="body1" sx={{ mb: 1.5 }}>
                        Tasks for this project are managed externally.
                      </Typography>
                      <Button
                        variant="contained"
                        startIcon={<OpenInNewIcon />}
                        href={currentProject.external_board_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Open External Task Board
                      </Button>
                    </Card>
                  ) : (
                    <ProjectTaskBoard
                      tasks={currentTasks}
                      milestones={currentMilestones}
                      loading={isCurrentLoading}
                      filterRecentDone
                      initialViewMode="milestones"
                      initialHideEmpty={initialHideEmpty}
                      onHideEmptyChange={handleHideEmptyChange}
                      onAssignmentsChange={handleAssignmentsChange}
                      onStatusChange={handleStatusChange}
                      onLogTime={handleLogTimeTask}
                      onDropStatus={handleDropStatus}
                      onDropMilestone={handleDropMilestone}
                      onDropPerson={handleDropPerson}
                    />
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
            pt: 2,
            gap: 0.5,
            minWidth: 72,
          }}
        >
          <IconButton
            onClick={goNext}
            disabled={currentIndex >= carouselItems.length - 1}
            sx={{
              width: 48,
              height: 48,
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
                {nextItem.type === 'holidays'
                  ? 'Availability'
                  : nextItem.type === 'planned'
                    ? 'Planned'
                    : nextItem.project.name}
              </Typography>
            </Box>
          )}
        </Box>
      </Box>

      {/* ---- Add Task Dialog ---- */}
      <Dialog
        open={addTaskOpen}
        onClose={() => !addTaskSubmitting && setAddTaskOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 600, pb: 1 }}>New Task — {currentProject?.name}</DialogTitle>
        <Box component="form" onSubmit={handleCreateTask}>
          <DialogContent sx={{ pt: 1 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <TextField
                label="Description"
                value={newTaskDescription}
                onChange={(e) => setNewTaskDescription(e.target.value)}
                required
                fullWidth
                autoFocus
                multiline
                minRows={2}
                maxRows={4}
              />
              <FormControl fullWidth>
                <InputLabel id="standup-task-status-label">Status</InputLabel>
                <Select
                  labelId="standup-task-status-label"
                  value={newTaskStatus}
                  label="Status"
                  onChange={(e: SelectChangeEvent) => setNewTaskStatus(e.target.value)}
                >
                  {TASK_STATUSES.map((s) => (
                    <MenuItem key={s} value={s}>
                      {TASK_STATUS_LABEL[s]}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth>
                <InputLabel id="standup-task-milestone-label">Milestone</InputLabel>
                <Select
                  labelId="standup-task-milestone-label"
                  value={newTaskMilestoneId}
                  label="Milestone"
                  onChange={(e: SelectChangeEvent) => setNewTaskMilestoneId(e.target.value)}
                >
                  <MenuItem value="">None</MenuItem>
                  {currentMilestones.map((m) => (
                    <MenuItem key={m.id} value={m.id}>
                      {m.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5 }}>
            <Button
              onClick={() => setAddTaskOpen(false)}
              color="inherit"
              disabled={addTaskSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={!newTaskDescription.trim() || addTaskSubmitting}
              endIcon={
                addTaskSubmitting ? <CircularProgress size={18} color="inherit" /> : undefined
              }
              sx={{ px: 3 }}
            >
              {addTaskSubmitting ? 'Creating...' : 'Create Task'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

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
