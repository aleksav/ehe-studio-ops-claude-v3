import { useState, useEffect, useMemo } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Typography,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { startOfISOWeek, endOfISOWeek, format, subDays } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import LogTimeModal from '../components/LogTimeModal';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Project {
  id: string;
  name: string;
  status: string;
  client: { id: string; name: string } | null;
}

interface Task {
  id: string;
  project_id: string;
  description: string;
  status: string;
}

interface TimeEntry {
  id: string;
  project_id: string;
  team_member_id: string;
  date: string;
  hours_worked: string | number;
  task_type: string;
  notes: string | null;
}

interface MyTask {
  id: string;
  description: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  project_id: string;
  project_name: string;
  client_name: string | null;
}

interface MyTimeEntry {
  id: string;
  project_id: string;
  project_name: string;
  client_name: string | null;
  date: string;
  hours_worked: number;
  task_type: string;
  notes: string | null;
}

interface MyProject {
  id: string;
  name: string;
  status: string;
  client_name: string | null;
  budget_type: string;
  budget_amount: number | null;
  actual_spend: number;
  budget_spend_pct: number | null;
  hours_this_week: number;
}

interface MissingTimeData {
  missing_days: { date: string; expected: number; logged: number }[];
  total_missing_hours: number;
  oldest_incomplete_week_start: string | null;
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

const TASK_TYPE_LABELS: Record<string, string> = {
  ARCHITECTURE_ENGINEERING_DIRECTION: 'Architecture & Engineering Direction',
  DESIGN_DELIVERY_RESEARCH: 'Design, Delivery & Research',
  DEVELOPMENT_TESTING: 'Development & Testing',
  BUSINESS_SUPPORT: 'Business Support',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatProjectName(project: { name: string; client?: { name: string } | null }): string {
  return project.client ? `${project.client.name} — ${project.name}` : project.name;
}

function formatProjectNameFromFlat(p: {
  project_name?: string;
  name?: string;
  client_name: string | null;
}): string {
  const projName = p.project_name ?? p.name ?? '';
  return p.client_name ? `${p.client_name} — ${projName}` : projName;
}

function sortProjects<T extends { name: string; client?: { name: string } | null }>(
  list: T[],
): T[] {
  return [...list].sort((a, b) => {
    const ca = a.client?.name ?? '';
    const cb = b.client?.name ?? '';
    const cmp = ca.localeCompare(cb);
    return cmp !== 0 ? cmp : a.name.localeCompare(b.name);
  });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

// ---------------------------------------------------------------------------
// Reusable summary card component
// ---------------------------------------------------------------------------

function SummaryCard({
  label,
  value,
  loading,
}: {
  label: string;
  value: string | null;
  loading: boolean;
}) {
  return (
    <Card
      elevation={0}
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 3,
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {label}
        </Typography>
        {loading ? (
          <Box sx={{ display: 'flex', alignItems: 'center', height: '3.5rem' }}>
            <CircularProgress size={24} />
          </Box>
        ) : (
          <Typography variant="h2" sx={{ fontWeight: 700, color: 'primary.main' }}>
            {value ?? '--'}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const displayName = user?.team_member?.full_name ?? user?.email ?? 'there';
  const teamMemberId = user?.team_member?.id ?? null;

  // Projects
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState('');

  // Tasks for selected project
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);

  // Studio-wide summary
  const [studioHoursThisWeek, setStudioHoursThisWeek] = useState<string>('--');
  const [studioHoursLoading, setStudioHoursLoading] = useState(true);
  const [openTaskCount, setOpenTaskCount] = useState<string>('--');
  const [openTasksLoading, setOpenTasksLoading] = useState(true);

  // My Work — from /api/me/* endpoints
  const [myTasks, setMyTasks] = useState<MyTask[]>([]);
  const [myTasksLoading, setMyTasksLoading] = useState(true);
  const [myTimeEntries, setMyTimeEntries] = useState<MyTimeEntry[]>([]);
  const [myTimeEntriesLoading, setMyTimeEntriesLoading] = useState(true);
  const [myProjects, setMyProjects] = useState<MyProject[]>([]);
  const [myProjectsLoading, setMyProjectsLoading] = useState(true);

  // Missing time warning
  const [missingTime, setMissingTime] = useState<MissingTimeData | null>(null);

  // Public holidays warning
  const [noHolidaysForYear, setNoHolidaysForYear] = useState(false);

  // Log time modal
  const [logTimeOpen, setLogTimeOpen] = useState(false);
  const [logTimeProjectId, setLogTimeProjectId] = useState('');
  const [logTimeProjectName, setLogTimeProjectName] = useState('');

  // Derived
  const activeProjects = projects.filter((p) => p.status === 'ACTIVE');

  // ---- Derived: My Work summary values ----
  const myOpenTasks = useMemo(
    () => myTasks.filter((t) => t.status === 'TODO' || t.status === 'IN_PROGRESS'),
    [myTasks],
  );
  const myActiveProjectsList = useMemo(
    () => myProjects.filter((p) => p.status === 'ACTIVE'),
    [myProjects],
  );
  const myHoursThisWeek = useMemo(() => {
    const total = myProjects.reduce((sum, p) => sum + p.hours_this_week, 0);
    return total > 0 ? total.toFixed(1) : '0';
  }, [myProjects]);

  // ---- Derived: Tasks grouped by status ----
  const tasksByStatus = useMemo(() => {
    const groups: Record<string, MyTask[]> = {};
    for (const task of myTasks) {
      if (task.status === 'DONE' || task.status === 'CANCELLED') continue;
      if (!groups[task.status]) groups[task.status] = [];
      groups[task.status].push(task);
    }
    return groups;
  }, [myTasks]);

  // ---- Derived: Daily hours for last 7 days ----
  const dailyHours = useMemo(() => {
    const dayMap = new Map<string, number>();
    // Initialize last 7 days
    for (let i = 6; i >= 0; i--) {
      const d = subDays(new Date(), i);
      const key = format(d, 'yyyy-MM-dd');
      dayMap.set(key, 0);
    }
    // Fill in actual hours
    for (const entry of myTimeEntries) {
      const current = dayMap.get(entry.date);
      if (current !== undefined) {
        dayMap.set(entry.date, current + entry.hours_worked);
      }
    }
    return Array.from(dayMap.entries()).map(([date, hours]) => ({ date, hours }));
  }, [myTimeEntries]);

  const maxDailyHours = useMemo(() => Math.max(...dailyHours.map((d) => d.hours), 1), [dailyHours]);

  // ---- Fetch projects on mount ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.get<Project[]>('/api/projects');
        if (!cancelled) setProjects(data);
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

  // ---- Fetch studio-wide hours this week (ALL team members) ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const now = new Date();
        const weekStart = format(startOfISOWeek(now), 'yyyy-MM-dd');
        const weekEnd = format(endOfISOWeek(now), 'yyyy-MM-dd');
        const entries = await api.get<TimeEntry[]>(
          `/api/time-entries?date_from=${weekStart}&date_to=${weekEnd}`,
        );
        if (!cancelled) {
          const total = entries.reduce((sum, e) => sum + parseFloat(String(e.hours_worked)), 0);
          setStudioHoursThisWeek(total > 0 ? total.toFixed(1) : '0');
        }
      } catch {
        if (!cancelled) setStudioHoursThisWeek('--');
      } finally {
        if (!cancelled) setStudioHoursLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ---- Fetch open tasks across all active projects ----
  useEffect(() => {
    if (projectsLoading) return;

    if (activeProjects.length === 0) {
      setOpenTaskCount('0');
      setOpenTasksLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const allTasks = await Promise.all(
          activeProjects.map((p) => api.get<Task[]>(`/api/projects/${p.id}/tasks`)),
        );
        if (!cancelled) {
          const flat = allTasks.flat();
          const openTasks = flat.filter((t) => t.status === 'TODO' || t.status === 'IN_PROGRESS');
          setOpenTaskCount(String(openTasks.length));
        }
      } catch {
        if (!cancelled) {
          setOpenTaskCount('--');
        }
      } finally {
        if (!cancelled) setOpenTasksLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projects, projectsLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Fetch My Tasks (via /api/me/tasks) ----
  useEffect(() => {
    if (!teamMemberId) {
      setMyTasksLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await api.get<MyTask[]>('/api/me/tasks');
        if (!cancelled) setMyTasks(data);
      } catch {
        if (!cancelled) setMyTasks([]);
      } finally {
        if (!cancelled) setMyTasksLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [teamMemberId]);

  // ---- Fetch My Time Entries (via /api/me/time-entries?days=7) ----
  useEffect(() => {
    if (!teamMemberId) {
      setMyTimeEntriesLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await api.get<MyTimeEntry[]>('/api/me/time-entries?days=7');
        if (!cancelled) setMyTimeEntries(data);
      } catch {
        if (!cancelled) setMyTimeEntries([]);
      } finally {
        if (!cancelled) setMyTimeEntriesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [teamMemberId]);

  // ---- Fetch My Projects (via /api/me/projects) ----
  useEffect(() => {
    if (!teamMemberId) {
      setMyProjectsLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await api.get<MyProject[]>('/api/me/projects');
        if (!cancelled) setMyProjects(data);
      } catch {
        if (!cancelled) setMyProjects([]);
      } finally {
        if (!cancelled) setMyProjectsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [teamMemberId]);

  // ---- Fetch Missing Time (via /api/me/missing-time) ----
  useEffect(() => {
    if (!teamMemberId) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await api.get<MissingTimeData>('/api/me/missing-time');
        if (!cancelled) setMissingTime(data);
      } catch {
        // silently fail — warning simply won't show
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [teamMemberId]);

  // ---- Check public holidays for current year ----
  useEffect(() => {
    let cancelled = false;
    const year = new Date().getFullYear();
    (async () => {
      try {
        const data = await api.get<{ id: string }[]>(`/api/public-holidays?year=${year}`);
        if (!cancelled) setNoHolidaysForYear(data.length === 0);
      } catch {
        // silently fail
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ---- Fetch tasks when project selected ----
  useEffect(() => {
    if (!selectedProjectId) {
      setTasks([]);
      return;
    }

    let cancelled = false;
    setTasksLoading(true);
    (async () => {
      try {
        const data = await api.get<Task[]>(`/api/projects/${selectedProjectId}/tasks`);
        if (!cancelled) setTasks(data);
      } catch {
        if (!cancelled) setTasks([]);
      } finally {
        if (!cancelled) setTasksLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedProjectId]);

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  const handleOpenLogTime = (projectId: string, projectName: string) => {
    setLogTimeProjectId(projectId);
    setLogTimeProjectName(projectName);
    setLogTimeOpen(true);
  };

  return (
    <Box sx={{ p: { xs: 2, sm: 4 } }}>
      <Typography variant="h3" sx={{ mb: 1, fontWeight: 600 }}>
        Welcome, {displayName}
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Here&apos;s your studio at a glance.
      </Typography>

      {/* ---- Missing time warning banner ---- */}
      {missingTime && missingTime.missing_days.length > 0 && (
        <Alert
          severity="warning"
          sx={{ mb: 3, borderRadius: 2 }}
          action={
            missingTime.oldest_incomplete_week_start ? (
              <Button
                color="warning"
                size="small"
                onClick={() =>
                  navigate(`/time-logging?week=${missingTime.oldest_incomplete_week_start}`)
                }
                sx={{ textTransform: 'none', fontWeight: 600 }}
              >
                Fill timesheet
              </Button>
            ) : undefined
          }
        >
          You have {missingTime.total_missing_hours}h unlogged across{' '}
          {missingTime.missing_days.length} {missingTime.missing_days.length === 1 ? 'day' : 'days'}{' '}
          this month. Keeping your timesheet up to date helps the studio plan ahead.
        </Alert>
      )}

      {/* ---- Public holidays warning ---- */}
      {noHolidaysForYear && (
        <Alert
          severity="info"
          icon={<WarningAmberIcon />}
          sx={{ mb: 3, borderRadius: 2 }}
          action={
            <Button
              color="info"
              size="small"
              onClick={() => navigate('/admin?tab=4')}
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              Add holidays
            </Button>
          }
        >
          No public holidays configured for {new Date().getFullYear()}. Weekly grid calculations may
          be inaccurate.
        </Alert>
      )}

      {/* ================================================================== */}
      {/* Section 1: Studio Overview                                         */}
      {/* ================================================================== */}
      <Typography variant="h4" sx={{ mb: 2, fontWeight: 600 }}>
        Studio Overview
      </Typography>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' },
          gap: 3,
          mb: 4,
        }}
      >
        <SummaryCard
          label="Active Projects"
          value={projectsLoading ? null : String(activeProjects.length)}
          loading={projectsLoading}
        />
        <SummaryCard
          label="Hours This Week"
          value={studioHoursThisWeek}
          loading={studioHoursLoading}
        />
        <SummaryCard label="Open Tasks" value={openTaskCount} loading={openTasksLoading} />
      </Box>

      <Divider sx={{ mb: 4 }} />

      {/* ================================================================== */}
      {/* Section 2: My Work                                                 */}
      {/* ================================================================== */}
      <Typography variant="h4" sx={{ mb: 2, fontWeight: 600 }}>
        My Work
      </Typography>

      {/* ---- My summary cards ---- */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' },
          gap: 3,
          mb: 4,
        }}
      >
        <SummaryCard
          label="My Active Projects"
          value={myProjectsLoading ? null : String(myActiveProjectsList.length)}
          loading={myProjectsLoading}
        />
        <SummaryCard
          label="My Hours This Week"
          value={myProjectsLoading ? null : myHoursThisWeek}
          loading={myProjectsLoading}
        />
        <SummaryCard
          label="My Open Tasks"
          value={myTasksLoading ? null : String(myOpenTasks.length)}
          loading={myTasksLoading}
        />
      </Box>

      {/* ---- My Assigned Tasks (grouped by status) ---- */}
      <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>
        My Assigned Tasks
      </Typography>

      <Card
        elevation={0}
        sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, mb: 4 }}
      >
        <CardContent sx={{ p: 3 }}>
          {myTasksLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
              <CircularProgress size={28} />
            </Box>
          ) : myOpenTasks.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
              No open tasks assigned to you.
            </Typography>
          ) : (
            (['IN_PROGRESS', 'TODO'] as const).map((status) => {
              const statusTasks = tasksByStatus[status];
              if (!statusTasks || statusTasks.length === 0) return null;
              return (
                <Box key={status} sx={{ mb: 2, '&:last-child': { mb: 0 } }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Chip
                      label={TASK_STATUS_LABEL[status] ?? status}
                      size="small"
                      color={TASK_STATUS_COLOR[status] ?? 'default'}
                      sx={{ fontSize: 11, height: 22 }}
                    />
                    <Typography variant="body2" color="text.secondary">
                      {statusTasks.length} {statusTasks.length === 1 ? 'task' : 'tasks'}
                    </Typography>
                  </Box>
                  {statusTasks.map((task, idx) => (
                    <Box
                      key={task.id}
                      sx={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 2,
                        py: 1,
                        px: 2,
                        borderRadius: 2,
                        bgcolor: '#F9FAFB',
                        mb: idx < statusTasks.length - 1 ? 0.5 : 0,
                      }}
                    >
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: 600,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {task.description}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatProjectNameFromFlat(task)}
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                </Box>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* ---- Daily Hours (last 7 days) ---- */}
      <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>
        Daily Hours (Last 7 Days)
      </Typography>

      <Card
        elevation={0}
        sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, mb: 4 }}
      >
        <CardContent sx={{ p: 3 }}>
          {myTimeEntriesLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
              <CircularProgress size={28} />
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {dailyHours.map((day) => (
                <Box key={day.date} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Typography
                    variant="body2"
                    sx={{ minWidth: 90, color: 'text.secondary', fontSize: 13 }}
                  >
                    {formatShortDate(day.date)}
                  </Typography>
                  <Box sx={{ flex: 1 }}>
                    <LinearProgress
                      variant="determinate"
                      value={Math.min((day.hours / maxDailyHours) * 100, 100)}
                      sx={{
                        height: 16,
                        borderRadius: 2,
                        bgcolor: '#F3F4F6',
                        '& .MuiLinearProgress-bar': {
                          borderRadius: 2,
                          bgcolor: day.hours > 0 ? 'primary.main' : '#F3F4F6',
                        },
                      }}
                    />
                  </Box>
                  <Typography
                    variant="body2"
                    sx={{ minWidth: 40, textAlign: 'right', fontWeight: 600, fontSize: 13 }}
                  >
                    {day.hours > 0 ? `${day.hours.toFixed(1)}h` : '--'}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
        </CardContent>
      </Card>

      {/* ---- My Recent Time Entries ---- */}
      <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>
        My Recent Time Entries
      </Typography>

      <Card
        elevation={0}
        sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, mb: 4 }}
      >
        <CardContent sx={{ p: 3 }}>
          {myTimeEntriesLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
              <CircularProgress size={28} />
            </Box>
          ) : myTimeEntries.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
              No recent time entries.
            </Typography>
          ) : (
            myTimeEntries.slice(0, 10).map((entry, idx) => (
              <Box key={entry.id}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 2,
                    py: 1.2,
                    px: 2,
                    borderRadius: 2,
                    bgcolor: '#F9FAFB',
                    mb: idx < Math.min(myTimeEntries.length, 10) - 1 ? 1 : 0,
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{ fontWeight: 700, minWidth: 42, color: 'primary.main' }}
                  >
                    {entry.hours_worked.toFixed(1)}h
                  </Typography>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {formatProjectNameFromFlat(entry)}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                      <Chip
                        label={TASK_TYPE_LABELS[entry.task_type] ?? entry.task_type}
                        size="small"
                        variant="outlined"
                        sx={{ fontSize: 11, height: 22 }}
                      />
                      <Typography variant="caption" color="text.secondary">
                        {formatDate(entry.date)}
                      </Typography>
                    </Box>
                    {entry.notes && (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        {entry.notes}
                      </Typography>
                    )}
                  </Box>
                </Box>
              </Box>
            ))
          )}
        </CardContent>
      </Card>

      {/* ---- My Active Projects ---- */}
      <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>
        My Active Projects
      </Typography>

      {myProjectsLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={28} />
        </Box>
      ) : myActiveProjectsList.length === 0 ? (
        <Card
          elevation={0}
          sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, mb: 4 }}
        >
          <CardContent sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              No active projects found.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' },
            gap: 2,
            mb: 4,
          }}
        >
          {myActiveProjectsList.map((project) => (
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
              <CardContent sx={{ p: 2.5, flex: 1, display: 'flex', flexDirection: 'column' }}>
                <Typography variant="body1" sx={{ fontWeight: 600, mb: 1 }}>
                  {formatProjectNameFromFlat(project)}
                </Typography>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <AccessTimeIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                  <Typography variant="body2" color="text.secondary">
                    {project.hours_this_week > 0
                      ? `${project.hours_this_week.toFixed(1)}h this week`
                      : 'No hours this week'}
                  </Typography>
                </Box>

                {project.budget_spend_pct !== null && (
                  <Box sx={{ mt: 'auto', pt: 1 }}>
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        mb: 0.5,
                      }}
                    >
                      <Typography variant="caption" color="text.secondary">
                        Budget
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          fontWeight: 600,
                          color:
                            project.budget_spend_pct > 90
                              ? 'error.main'
                              : project.budget_spend_pct > 75
                                ? 'warning.main'
                                : 'text.secondary',
                        }}
                      >
                        {project.budget_spend_pct.toFixed(1)}%
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={Math.min(project.budget_spend_pct, 100)}
                      sx={{
                        height: 6,
                        borderRadius: 3,
                        bgcolor: '#F3F4F6',
                        '& .MuiLinearProgress-bar': {
                          borderRadius: 3,
                          bgcolor:
                            project.budget_spend_pct > 90
                              ? 'error.main'
                              : project.budget_spend_pct > 75
                                ? 'warning.main'
                                : 'primary.main',
                        },
                      }}
                    />
                  </Box>
                )}
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      <Divider sx={{ mb: 4 }} />

      {/* ---- Project Tasks Section ---- */}
      <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>
        Project Tasks
      </Typography>

      <Card
        elevation={0}
        sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, mb: 3 }}
      >
        <CardContent sx={{ p: 3 }}>
          {projectsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
              <CircularProgress size={28} />
            </Box>
          ) : (
            <FormControl fullWidth>
              <InputLabel id="dashboard-project-select-label">Select project</InputLabel>
              <Select
                labelId="dashboard-project-select-label"
                value={selectedProjectId}
                label="Select project"
                onChange={(e: SelectChangeEvent) => setSelectedProjectId(e.target.value)}
              >
                {sortProjects(projects.filter((p) => p.status !== 'ARCHIVED')).map((p) => (
                  <MenuItem key={p.id} value={p.id}>
                    {formatProjectName(p)}
                    {p.status !== 'ACTIVE' && (
                      <Chip
                        label={p.status}
                        size="small"
                        sx={{ ml: 1, height: 20, fontSize: 11 }}
                      />
                    )}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </CardContent>
      </Card>

      {/* ---- Task cards ---- */}
      {selectedProjectId && (
        <>
          {tasksLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={28} />
            </Box>
          ) : tasks.length === 0 ? (
            <Card
              elevation={0}
              sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3 }}
            >
              <CardContent sx={{ p: 3, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  No tasks found for this project.
                </Typography>
              </CardContent>
            </Card>
          ) : (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' },
                gap: 2,
              }}
            >
              {tasks.map((task) => (
                <Card
                  key={task.id}
                  elevation={0}
                  sx={{
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 3,
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <CardContent sx={{ p: 2.5, flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        mb: 1.5,
                      }}
                    >
                      <Typography
                        variant="body1"
                        sx={{
                          fontWeight: 600,
                          flex: 1,
                          mr: 1,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                        }}
                      >
                        {task.description}
                      </Typography>
                      <Chip
                        label={TASK_STATUS_LABEL[task.status] ?? task.status}
                        size="small"
                        color={TASK_STATUS_COLOR[task.status] ?? 'default'}
                        sx={{ fontSize: 11, height: 22, flexShrink: 0 }}
                      />
                    </Box>

                    <Box sx={{ mt: 'auto', pt: 1 }}>
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<AccessTimeIcon sx={{ fontSize: 16 }} />}
                        onClick={() =>
                          handleOpenLogTime(
                            selectedProjectId,
                            selectedProject ? formatProjectName(selectedProject) : 'Project',
                          )
                        }
                        sx={{ textTransform: 'none', fontSize: 13 }}
                      >
                        Log Time
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              ))}
            </Box>
          )}
        </>
      )}

      {/* ---- Log Time Modal ---- */}
      <LogTimeModal
        open={logTimeOpen}
        onClose={() => setLogTimeOpen(false)}
        projectId={logTimeProjectId}
        projectName={logTimeProjectName}
      />
    </Box>
  );
}
