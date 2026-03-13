import { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Typography,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { startOfISOWeek, endOfISOWeek, format } from 'date-fns';
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

function formatProjectName(project: Project): string {
  return project.client ? `${project.name} (${project.client.name})` : project.name;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
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

  // My Work summary
  const [myHoursThisWeek, setMyHoursThisWeek] = useState<string>('--');
  const [myHoursLoading, setMyHoursLoading] = useState(true);
  const [myActiveProjects, setMyActiveProjects] = useState<string>('--');
  const [myActiveProjectsLoading, setMyActiveProjectsLoading] = useState(true);
  const [myOpenTaskCount, setMyOpenTaskCount] = useState<string>('--');
  const [myOpenTasksLoading, setMyOpenTasksLoading] = useState(true);

  // My recent time entries
  const [myRecentEntries, setMyRecentEntries] = useState<TimeEntry[]>([]);
  const [myRecentEntriesLoading, setMyRecentEntriesLoading] = useState(true);

  // Log time modal
  const [logTimeOpen, setLogTimeOpen] = useState(false);
  const [logTimeProjectId, setLogTimeProjectId] = useState('');
  const [logTimeProjectName, setLogTimeProjectName] = useState('');

  // Derived
  const activeProjects = projects.filter((p) => p.status === 'ACTIVE');

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

  // ---- Fetch my hours this week ----
  useEffect(() => {
    if (!teamMemberId) {
      setMyHoursLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const now = new Date();
        const weekStart = format(startOfISOWeek(now), 'yyyy-MM-dd');
        const weekEnd = format(endOfISOWeek(now), 'yyyy-MM-dd');
        const entries = await api.get<TimeEntry[]>(
          `/api/time-entries?team_member_id=${teamMemberId}&date_from=${weekStart}&date_to=${weekEnd}`,
        );
        if (!cancelled) {
          const total = entries.reduce((sum, e) => sum + parseFloat(String(e.hours_worked)), 0);
          setMyHoursThisWeek(total > 0 ? total.toFixed(1) : '0');
        }
      } catch {
        if (!cancelled) setMyHoursThisWeek('--');
      } finally {
        if (!cancelled) setMyHoursLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [teamMemberId]);

  // ---- Fetch my recent time entries + derive my active projects ----
  useEffect(() => {
    if (!teamMemberId) {
      setMyRecentEntriesLoading(false);
      setMyActiveProjectsLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const entries = await api.get<TimeEntry[]>(
          `/api/time-entries?team_member_id=${teamMemberId}`,
        );
        if (!cancelled) {
          // Recent entries (API returns desc order)
          setMyRecentEntries(entries.slice(0, 5));

          // Distinct active projects the user logged time against
          const projectIds = new Set(entries.map((e) => e.project_id));
          const activeProjectIds = activeProjects
            .filter((p) => projectIds.has(p.id))
            .map((p) => p.id);
          setMyActiveProjects(String(activeProjectIds.length));
        }
      } catch {
        if (!cancelled) {
          setMyRecentEntries([]);
          setMyActiveProjects('--');
        }
      } finally {
        if (!cancelled) {
          setMyRecentEntriesLoading(false);
          setMyActiveProjectsLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // Re-run when projects finish loading so activeProjects is populated
  }, [teamMemberId, projectsLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Fetch open tasks across all active projects ----
  useEffect(() => {
    if (projectsLoading) return;

    if (activeProjects.length === 0) {
      setOpenTaskCount('0');
      setOpenTasksLoading(false);
      setMyOpenTaskCount('0');
      setMyOpenTasksLoading(false);
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

          // My open tasks: we don't have assignment info from this endpoint,
          // so count tasks from projects user has logged time to
          // For a more precise count, we'd need task assignments API
          // For now, set based on what we know
          setMyOpenTaskCount('--');
          setMyOpenTasksLoading(false);
        }
      } catch {
        if (!cancelled) {
          setOpenTaskCount('--');
          setMyOpenTaskCount('--');
          setMyOpenTasksLoading(false);
        }
      } finally {
        if (!cancelled) setOpenTasksLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projects, projectsLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Fetch my open tasks (using task assignments) ----
  useEffect(() => {
    if (projectsLoading || !teamMemberId) {
      if (!teamMemberId) setMyOpenTasksLoading(false);
      return;
    }

    if (activeProjects.length === 0) {
      setMyOpenTaskCount('0');
      setMyOpenTasksLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const allAssignments = await Promise.all(
          activeProjects.map(async (p) => {
            try {
              const assignments = await api.get<
                { task_id: string; team_member_id: string; task?: Task }[]
              >(`/api/projects/${p.id}/tasks/assignments`);
              return assignments;
            } catch {
              return [];
            }
          }),
        );
        if (!cancelled) {
          // Filter assignments for current user, then check task status
          const myAssignedTaskIds = new Set(
            allAssignments
              .flat()
              .filter((a) => a.team_member_id === teamMemberId)
              .map((a) => a.task_id),
          );

          // Now fetch tasks to check status (we may already have them from the open tasks fetch)
          const allTasks = await Promise.all(
            activeProjects.map((p) => api.get<Task[]>(`/api/projects/${p.id}/tasks`)),
          );
          const openCount = allTasks
            .flat()
            .filter(
              (t) =>
                myAssignedTaskIds.has(t.id) && (t.status === 'TODO' || t.status === 'IN_PROGRESS'),
            ).length;
          setMyOpenTaskCount(String(openCount));
        }
      } catch {
        if (!cancelled) setMyOpenTaskCount('--');
      } finally {
        if (!cancelled) setMyOpenTasksLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projects, projectsLoading, teamMemberId]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Build a lookup map for project names (for recent entries)
  const projectMap = new Map(projects.map((p) => [p.id, p]));

  return (
    <Box sx={{ p: { xs: 2, sm: 4 } }}>
      <Typography variant="h3" sx={{ mb: 1, fontWeight: 600 }}>
        Welcome, {displayName}
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Here&apos;s your studio at a glance.
      </Typography>

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
          value={myActiveProjects}
          loading={myActiveProjectsLoading}
        />
        <SummaryCard label="My Hours This Week" value={myHoursThisWeek} loading={myHoursLoading} />
        <SummaryCard label="My Open Tasks" value={myOpenTaskCount} loading={myOpenTasksLoading} />
      </Box>

      {/* ---- My Recent Time Entries ---- */}
      <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>
        My Recent Time Entries
      </Typography>

      <Card
        elevation={0}
        sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, mb: 4 }}
      >
        <CardContent sx={{ p: 3 }}>
          {myRecentEntriesLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
              <CircularProgress size={28} />
            </Box>
          ) : myRecentEntries.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
              No recent time entries.
            </Typography>
          ) : (
            myRecentEntries.map((entry, idx) => {
              const project = projectMap.get(entry.project_id);
              const projectLabel = project ? formatProjectName(project) : 'Unknown Project';
              return (
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
                      mb: idx < myRecentEntries.length - 1 ? 1 : 0,
                    }}
                  >
                    <Typography
                      variant="body2"
                      sx={{ fontWeight: 700, minWidth: 42, color: 'primary.main' }}
                    >
                      {parseFloat(String(entry.hours_worked)).toFixed(1)}h
                    </Typography>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {projectLabel}
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
              );
            })
          )}
        </CardContent>
      </Card>

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
                {projects
                  .filter((p) => p.status !== 'ARCHIVED')
                  .map((p) => (
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
