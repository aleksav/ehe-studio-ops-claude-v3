import { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Typography,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const { user } = useAuth();
  const displayName = user?.team_member?.full_name ?? user?.email ?? 'there';

  // Projects
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState('');

  // Tasks
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);

  // Log time modal
  const [logTimeOpen, setLogTimeOpen] = useState(false);
  const [logTimeProjectId, setLogTimeProjectId] = useState('');
  const [logTimeProjectName, setLogTimeProjectName] = useState('');

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

      {/* ---- Summary cards ---- */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' },
          gap: 3,
          mb: 4,
        }}
      >
        {[
          { label: 'Active Projects', value: '--' },
          { label: 'Hours This Week', value: '--' },
          { label: 'Open Tasks', value: '--' },
        ].map((card) => (
          <Card
            key={card.label}
            elevation={0}
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 3,
            }}
          >
            <CardContent sx={{ p: 3 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {card.label}
              </Typography>
              <Typography variant="h2" sx={{ fontWeight: 700, color: 'primary.main' }}>
                {card.value}
              </Typography>
            </CardContent>
          </Card>
        ))}
      </Box>

      {/* ---- Project Tasks Section ---- */}
      <Typography variant="h4" sx={{ mb: 2, fontWeight: 600 }}>
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
                {projects.map((p) => (
                  <MenuItem key={p.id} value={p.id}>
                    {p.client ? `${p.client.name} / ${p.name}` : p.name}
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
                            selectedProject?.client
                              ? `${selectedProject.client.name} / ${selectedProject.name}`
                              : (selectedProject?.name ?? 'Project'),
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
