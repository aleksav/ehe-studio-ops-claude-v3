import { useState, useEffect, useCallback } from 'react';
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
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import SendIcon from '@mui/icons-material/Send';
import { useAuth } from '../contexts/AuthContext';
import { api, ApiError } from '../lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Project {
  id: string;
  name: string;
  status: string;
}

interface TeamMemberDetail {
  id: string;
  full_name: string;
  preferred_task_type: string | null;
}

interface TimeEntry {
  id: string;
  project_id: string;
  team_member_id: string;
  date: string;
  hours_worked: string | number;
  task_type: string;
  notes: string | null;
  meta?: { warning?: string };
}

interface TimeEntryResponse extends TimeEntry {
  meta?: { warning?: string };
}

// ---------------------------------------------------------------------------
// Task-type helpers
// ---------------------------------------------------------------------------

const TASK_TYPES = [
  'ARCHITECTURE_ENGINEERING_DIRECTION',
  'DESIGN_DELIVERY_RESEARCH',
  'DEVELOPMENT_TESTING',
  'BUSINESS_SUPPORT',
] as const;

type TaskTypeValue = (typeof TASK_TYPES)[number];

const TASK_TYPE_LABELS: Record<TaskTypeValue, string> = {
  ARCHITECTURE_ENGINEERING_DIRECTION: 'Architecture & Engineering Direction',
  DESIGN_DELIVERY_RESEARCH: 'Design, Delivery & Research',
  DEVELOPMENT_TESTING: 'Development & Testing',
  BUSINESS_SUPPORT: 'Business Support',
};

function formatTaskType(value: string): string {
  return TASK_TYPE_LABELS[value as TaskTypeValue] ?? value;
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

/** Return today in YYYY-MM-DD format (local timezone). */
function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** Format an ISO date string to a human-readable date. */
function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Normalise any date string to YYYY-MM-DD. */
function toDateKey(iso: string): string {
  return iso.slice(0, 10);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TimeLoggingPage() {
  const { user } = useAuth();
  const teamMemberId = user?.team_member?.id ?? null;

  // Project list
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState('');

  // Team member detail (for preferred_task_type)
  const [memberDetail, setMemberDetail] = useState<TeamMemberDetail | null>(null);

  // Entry form
  const [date, setDate] = useState(todayISO());
  const [hours, setHours] = useState('');
  const [taskType, setTaskType] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Feedback
  const [warningMsg, setWarningMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Entries list
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(false);

  // ---- Fetch projects on mount ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.get<Project[]>('/api/projects');
        if (!cancelled) setProjects(data);
      } catch {
        // silently fail — user will see empty list
      } finally {
        if (!cancelled) setProjectsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ---- Fetch team member detail (preferred_task_type) ----
  useEffect(() => {
    if (!teamMemberId) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await api.get<TeamMemberDetail>(`/api/team-members/${teamMemberId}`);
        if (!cancelled) {
          setMemberDetail(data);
          // Pre-fill task type if not already set
          if (data.preferred_task_type) {
            setTaskType((prev) => prev || data.preferred_task_type!);
          }
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [teamMemberId]);

  // ---- Fetch entries for selected project ----
  const fetchEntries = useCallback(async () => {
    if (!selectedProjectId || !teamMemberId) return;
    setEntriesLoading(true);
    try {
      const data = await api.get<TimeEntry[]>(
        `/api/time-entries?project_id=${selectedProjectId}&team_member_id=${teamMemberId}`,
      );
      setEntries(data);
    } catch {
      setEntries([]);
    } finally {
      setEntriesLoading(false);
    }
  }, [selectedProjectId, teamMemberId]);

  useEffect(() => {
    void fetchEntries();
  }, [fetchEntries]);

  // ---- Pre-fill task type from member detail when it arrives ----
  useEffect(() => {
    if (memberDetail?.preferred_task_type && !taskType) {
      setTaskType(memberDetail.preferred_task_type);
    }
  }, [memberDetail, taskType]);

  // ---- Submit handler ----
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId || !teamMemberId) return;

    setWarningMsg(null);
    setErrorMsg(null);
    setSuccessMsg(null);
    setSubmitting(true);

    try {
      const result = await api.post<TimeEntryResponse>('/api/time-entries', {
        project_id: selectedProjectId,
        team_member_id: teamMemberId,
        date,
        hours_worked: parseFloat(hours),
        task_type: taskType,
        notes: notes.trim() || undefined,
      });

      if (result.meta?.warning) {
        setWarningMsg(result.meta.warning);
      } else {
        setSuccessMsg('Time entry logged successfully.');
      }

      // Reset form (keep date & task type)
      setHours('');
      setNotes('');
      void fetchEntries();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ---- Derived: grouped entries ----
  const groupedEntries = groupByDate(entries);
  const projectTotal = entries.reduce((sum, e) => sum + parseFloat(String(e.hours_worked)), 0);

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  // ---- Render ----
  return (
    <Box sx={{ p: { xs: 2, sm: 4 }, maxWidth: 800, mx: 'auto' }}>
      <Typography variant="h3" sx={{ mb: 0.5, fontWeight: 600 }}>
        Quick Entry
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Log time against a project.
      </Typography>

      {/* ---- Project selector ---- */}
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
              <InputLabel id="project-select-label">Select project</InputLabel>
              <Select
                labelId="project-select-label"
                value={selectedProjectId}
                label="Select project"
                onChange={(e: SelectChangeEvent) => {
                  setSelectedProjectId(e.target.value);
                  setWarningMsg(null);
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
              >
                {projects.map((p) => (
                  <MenuItem key={p.id} value={p.id}>
                    {p.name}
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

      {/* ---- Entry form (shown when project selected) ---- */}
      {selectedProjectId && (
        <Card
          elevation={0}
          sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, mb: 3 }}
        >
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h4" sx={{ mb: 2.5, fontWeight: 600 }}>
              Log Time{selectedProject ? ` — ${selectedProject.name}` : ''}
            </Typography>

            {/* Alerts */}
            {warningMsg && (
              <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
                {warningMsg}
              </Alert>
            )}
            {errorMsg && (
              <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
                {errorMsg}
              </Alert>
            )}
            {successMsg && (
              <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }}>
                {successMsg}
              </Alert>
            )}

            <Box component="form" onSubmit={handleSubmit}>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                  gap: 2.5,
                  mb: 2.5,
                }}
              >
                {/* Date */}
                <TextField
                  label="Date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  inputProps={{ max: todayISO() }}
                  required
                  fullWidth
                />

                {/* Hours */}
                <TextField
                  label="Hours"
                  type="number"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  inputProps={{ min: 0.25, step: 0.25 }}
                  placeholder="e.g. 2.5"
                  required
                  fullWidth
                />

                {/* Task type */}
                <FormControl fullWidth required>
                  <InputLabel id="task-type-label">Task type</InputLabel>
                  <Select
                    labelId="task-type-label"
                    value={taskType}
                    label="Task type"
                    onChange={(e: SelectChangeEvent) => setTaskType(e.target.value)}
                  >
                    {TASK_TYPES.map((t) => (
                      <MenuItem key={t} value={t}>
                        {TASK_TYPE_LABELS[t]}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {/* Notes */}
                <TextField
                  label="Notes (optional)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  multiline
                  minRows={1}
                  maxRows={3}
                  fullWidth
                />
              </Box>

              <Button
                type="submit"
                variant="contained"
                disabled={submitting || !hours || !taskType}
                endIcon={submitting ? <CircularProgress size={18} color="inherit" /> : <SendIcon />}
                sx={{
                  bgcolor: 'primary.main',
                  '&:hover': { bgcolor: 'primary.dark' },
                  px: 4,
                  py: 1.2,
                  fontSize: 15,
                }}
              >
                {submitting ? 'Logging...' : 'Log Entry'}
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* ---- Entries list ---- */}
      {selectedProjectId && (
        <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
          <CardContent sx={{ p: 3 }}>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: 2,
              }}
            >
              <Typography variant="h4" sx={{ fontWeight: 600 }}>
                Entries
              </Typography>
              <Chip
                icon={<AccessTimeIcon sx={{ fontSize: 16 }} />}
                label={`${projectTotal.toFixed(1)}h total`}
                color="secondary"
                variant="outlined"
                sx={{ fontWeight: 600 }}
              />
            </Box>

            <Divider sx={{ mb: 2 }} />

            {entriesLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress size={28} />
              </Box>
            ) : groupedEntries.length === 0 ? (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ py: 3, textAlign: 'center' }}
              >
                No entries yet for this project.
              </Typography>
            ) : (
              groupedEntries.map((group, idx) => (
                <Box key={group.date} sx={{ mb: idx < groupedEntries.length - 1 ? 3 : 0 }}>
                  {/* Date header */}
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      mb: 1.5,
                    }}
                  >
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                      {formatDate(group.date)}
                    </Typography>
                    <Chip
                      label={`${group.total.toFixed(1)}h`}
                      size="small"
                      sx={{
                        bgcolor: group.total > 8 ? 'warning.main' : 'secondary.main',
                        color: '#fff',
                        fontWeight: 600,
                        fontSize: 12,
                      }}
                    />
                  </Box>

                  {/* Entries for this date */}
                  {group.entries.map((entry) => (
                    <Box
                      key={entry.id}
                      sx={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 2,
                        py: 1.2,
                        px: 2,
                        mb: 0.5,
                        borderRadius: 2,
                        bgcolor: '#F9FAFB',
                      }}
                    >
                      <Typography
                        variant="body2"
                        sx={{ fontWeight: 700, minWidth: 42, color: 'primary.main' }}
                      >
                        {parseFloat(String(entry.hours_worked)).toFixed(1)}h
                      </Typography>
                      <Chip
                        label={formatTaskType(entry.task_type)}
                        size="small"
                        variant="outlined"
                        sx={{ fontSize: 12, height: 24 }}
                      />
                      {entry.notes && (
                        <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
                          {entry.notes}
                        </Typography>
                      )}
                    </Box>
                  ))}

                  {idx < groupedEntries.length - 1 && <Divider sx={{ mt: 1.5 }} />}
                </Box>
              ))
            )}
          </CardContent>
        </Card>
      )}
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface DateGroup {
  date: string;
  total: number;
  entries: TimeEntry[];
}

function groupByDate(entries: TimeEntry[]): DateGroup[] {
  const map = new Map<string, TimeEntry[]>();

  for (const entry of entries) {
    const key = toDateKey(entry.date);
    const arr = map.get(key);
    if (arr) {
      arr.push(entry);
    } else {
      map.set(key, [entry]);
    }
  }

  // Sort date keys descending
  const sorted = [...map.entries()].sort(([a], [b]) => (a > b ? -1 : a < b ? 1 : 0));

  return sorted.map(([date, groupEntries]) => ({
    date,
    total: groupEntries.reduce((s, e) => s + parseFloat(String(e.hours_worked)), 0),
    entries: groupEntries,
  }));
}
