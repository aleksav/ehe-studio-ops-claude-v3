import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableFooter,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import {
  startOfISOWeek,
  endOfISOWeek,
  addWeeks,
  addDays,
  format,
  parseISO,
  getISOWeek,
  getISOWeekYear,
} from 'date-fns';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Project {
  id: string;
  name: string;
  status: string;
  client: { id: string; name: string } | null;
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

/** Key: `${projectId}::${dateStr}` */
interface CellData {
  hours: string;
  taskType: string;
  entryId: string | null;
  saving: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TASK_TYPES = [
  'ARCHITECTURE_ENGINEERING_DIRECTION',
  'DESIGN_DELIVERY_RESEARCH',
  'DEVELOPMENT_TESTING',
  'BUSINESS_SUPPORT',
] as const;

type TaskTypeValue = (typeof TASK_TYPES)[number];

const TASK_TYPE_LABELS: Record<TaskTypeValue, string> = {
  ARCHITECTURE_ENGINEERING_DIRECTION: 'Arch & Eng',
  DESIGN_DELIVERY_RESEARCH: 'Design & Research',
  DEVELOPMENT_TESTING: 'Dev & Testing',
  BUSINESS_SUPPORT: 'Business',
};

const TASK_TYPE_ABBR: Record<TaskTypeValue, string> = {
  ARCHITECTURE_ENGINEERING_DIRECTION: 'A&E',
  DESIGN_DELIVERY_RESEARCH: 'D&R',
  DEVELOPMENT_TESTING: 'D&T',
  BUSINESS_SUPPORT: 'Biz',
};

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const LS_KEY_PROJECTS = 'weeklyGrid:projectRows';
const LS_KEY_TASK_TYPES = 'weeklyGrid:taskTypes';

const DAILY_WARN_THRESHOLD = 8;
const DAILY_BLOCK_THRESHOLD = 12;

// ---------------------------------------------------------------------------
// ISO week helpers
// ---------------------------------------------------------------------------

function toISOWeekString(date: Date): string {
  const year = getISOWeekYear(date);
  const week = getISOWeek(date);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

function parseISOWeekString(str: string): Date | null {
  const match = str.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return null;
  const year = parseInt(match[1], 10);
  const week = parseInt(match[2], 10);
  if (week < 1 || week > 53) return null;
  // Jan 4 is always in week 1 of ISO year
  const jan4 = new Date(year, 0, 4);
  const start = startOfISOWeek(jan4);
  return addWeeks(start, week - 1);
}

function getWeekDates(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

function dateKey(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

function cellKey(projectId: string, dateStr: string): string {
  return `${projectId}::${dateStr}`;
}

function formatWeekLabel(weekStart: Date): string {
  return `Week of ${format(weekStart, 'MMM d, yyyy')}`;
}

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------

function loadSavedProjectIds(): string[] {
  try {
    const raw = localStorage.getItem(LS_KEY_PROJECTS);
    if (raw) return JSON.parse(raw) as string[];
  } catch {
    // ignore
  }
  return [];
}

function saveProjectIds(ids: string[]): void {
  localStorage.setItem(LS_KEY_PROJECTS, JSON.stringify(ids));
}

function loadSavedTaskTypes(): Record<string, string> {
  try {
    const raw = localStorage.getItem(LS_KEY_TASK_TYPES);
    if (raw) return JSON.parse(raw) as Record<string, string>;
  } catch {
    // ignore
  }
  return {};
}

function saveSavedTaskTypes(map: Record<string, string>): void {
  localStorage.setItem(LS_KEY_TASK_TYPES, JSON.stringify(map));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function WeeklyGridPage() {
  const { user } = useAuth();
  const teamMemberId = user?.team_member?.id ?? null;
  const [searchParams, setSearchParams] = useSearchParams();

  // ---- Week navigation state ----
  const weekParam = searchParams.get('week');
  const currentWeekStart = useMemo(() => {
    if (weekParam) {
      const parsed = parseISOWeekString(weekParam);
      if (parsed) return startOfISOWeek(parsed);
    }
    return startOfISOWeek(new Date());
  }, [weekParam]);

  const weekDates = useMemo(() => getWeekDates(currentWeekStart), [currentWeekStart]);

  const navigateWeek = useCallback(
    (offset: number) => {
      const newStart = addWeeks(currentWeekStart, offset);
      setSearchParams({ week: toISOWeekString(newStart) }, { replace: true });
    },
    [currentWeekStart, setSearchParams],
  );

  const goToThisWeek = useCallback(() => {
    setSearchParams({ week: toISOWeekString(new Date()) }, { replace: true });
  }, [setSearchParams]);

  // ---- Projects ----
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>(() =>
    loadSavedProjectIds(),
  );
  const [addProjectId, setAddProjectId] = useState('');

  // ---- Per-project default task types (from localStorage) ----
  const savedTaskTypesRef = useRef<Record<string, string>>(loadSavedTaskTypes());

  // ---- Cell data ----
  const [cells, setCells] = useState<Record<string, CellData>>({});
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ---- Fetch all projects ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.get<Project[]>('/api/projects');
        if (!cancelled) setAllProjects(data);
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

  // ---- Fetch entries for the week ----
  const fetchEntries = useCallback(async () => {
    if (!teamMemberId || selectedProjectIds.length === 0) {
      setCells({});
      return;
    }
    setEntriesLoading(true);
    setErrorMsg(null);

    const startDate = dateKey(currentWeekStart);
    const endDate = dateKey(endOfISOWeek(currentWeekStart));

    try {
      // Try fetching with date range params; if the API doesn't support them,
      // entries outside the week range will simply be ignored.
      const data = await api.get<TimeEntry[]>(
        `/api/time-entries?team_member_id=${teamMemberId}&start_date=${startDate}&end_date=${endDate}`,
      );

      const newCells: Record<string, CellData> = {};
      // Initialize empty cells for all project-day combos
      for (const pid of selectedProjectIds) {
        for (const d of weekDates) {
          const dk = dateKey(d);
          const ck = cellKey(pid, dk);
          newCells[ck] = {
            hours: '',
            taskType: savedTaskTypesRef.current[pid] || TASK_TYPES[0],
            entryId: null,
            saving: false,
          };
        }
      }
      // Fill in existing entries
      for (const entry of data) {
        const dk = entry.date.slice(0, 10);
        const ck = cellKey(entry.project_id, dk);
        if (ck in newCells) {
          newCells[ck] = {
            hours: String(parseFloat(String(entry.hours_worked))),
            taskType: entry.task_type,
            entryId: entry.id,
            saving: false,
          };
        }
      }
      setCells(newCells);
    } catch {
      setErrorMsg('Failed to load time entries for this week.');
    } finally {
      setEntriesLoading(false);
    }
  }, [teamMemberId, selectedProjectIds, currentWeekStart, weekDates]);

  useEffect(() => {
    void fetchEntries();
  }, [fetchEntries]);

  // ---- Add project row ----
  const handleAddProject = useCallback(() => {
    if (!addProjectId || selectedProjectIds.includes(addProjectId)) return;
    const updated = [...selectedProjectIds, addProjectId];
    setSelectedProjectIds(updated);
    saveProjectIds(updated);
    setAddProjectId('');
    // Initialize cells for new project row
    setCells((prev) => {
      const next = { ...prev };
      for (const d of weekDates) {
        const dk = dateKey(d);
        const ck = cellKey(addProjectId, dk);
        if (!(ck in next)) {
          next[ck] = {
            hours: '',
            taskType: savedTaskTypesRef.current[addProjectId] || TASK_TYPES[0],
            entryId: null,
            saving: false,
          };
        }
      }
      return next;
    });
  }, [addProjectId, selectedProjectIds, weekDates]);

  // ---- Remove project row ----
  const handleRemoveProject = useCallback(
    (projectId: string) => {
      const updated = selectedProjectIds.filter((id) => id !== projectId);
      setSelectedProjectIds(updated);
      saveProjectIds(updated);
    },
    [selectedProjectIds],
  );

  // ---- Cell change handlers ----
  const handleHoursChange = useCallback((ck: string, value: string) => {
    setCells((prev) => ({
      ...prev,
      [ck]: { ...prev[ck], hours: value },
    }));
  }, []);

  const handleTaskTypeChange = useCallback((ck: string, projectId: string, value: string) => {
    setCells((prev) => ({
      ...prev,
      [ck]: { ...prev[ck], taskType: value },
    }));
    // Persist preferred task type per project
    savedTaskTypesRef.current[projectId] = value;
    saveSavedTaskTypes(savedTaskTypesRef.current);
  }, []);

  // ---- Save on blur ----
  const handleCellBlur = useCallback(
    async (projectId: string, dateStr: string) => {
      if (!teamMemberId) return;
      const ck = cellKey(projectId, dateStr);
      const cell = cells[ck];
      if (!cell) return;

      const hoursNum = parseFloat(cell.hours);
      if (!cell.hours || isNaN(hoursNum) || hoursNum <= 0) {
        // If there was an existing entry and hours were cleared, we could delete.
        // For now, simply skip saving empty cells.
        return;
      }

      // Check daily limit
      const dailyTotal = computeDailyTotal(dateStr);
      if (dailyTotal >= DAILY_BLOCK_THRESHOLD) return;

      setCells((prev) => ({
        ...prev,
        [ck]: { ...prev[ck], saving: true },
      }));

      try {
        if (cell.entryId) {
          // Update existing entry
          const updated = await api.put<TimeEntry>(`/api/time-entries/${cell.entryId}`, {
            hours_worked: hoursNum,
            task_type: cell.taskType,
          });
          setCells((prev) => ({
            ...prev,
            [ck]: { ...prev[ck], entryId: updated.id, saving: false },
          }));
        } else {
          // Create new entry
          const created = await api.post<TimeEntry>('/api/time-entries', {
            project_id: projectId,
            team_member_id: teamMemberId,
            date: dateStr,
            hours_worked: hoursNum,
            task_type: cell.taskType,
          });
          setCells((prev) => ({
            ...prev,
            [ck]: { ...prev[ck], entryId: created.id, saving: false },
          }));
        }
      } catch {
        setCells((prev) => ({
          ...prev,
          [ck]: { ...prev[ck], saving: false },
        }));
        setErrorMsg('Failed to save entry. Please try again.');
      }
    },
    [teamMemberId, cells],
  );

  // ---- Computed totals ----
  const computeRowTotal = useCallback(
    (projectId: string): number => {
      let total = 0;
      for (const d of weekDates) {
        const ck = cellKey(projectId, dateKey(d));
        const val = parseFloat(cells[ck]?.hours ?? '');
        if (!isNaN(val)) total += val;
      }
      return total;
    },
    [cells, weekDates],
  );

  const computeDailyTotal = useCallback(
    (dateStr: string): number => {
      let total = 0;
      for (const pid of selectedProjectIds) {
        const ck = cellKey(pid, dateStr);
        const val = parseFloat(cells[ck]?.hours ?? '');
        if (!isNaN(val)) total += val;
      }
      return total;
    },
    [cells, selectedProjectIds],
  );

  const grandTotal = useMemo(() => {
    let total = 0;
    for (const pid of selectedProjectIds) {
      total += computeRowTotal(pid);
    }
    return total;
  }, [selectedProjectIds, computeRowTotal]);

  // ---- Daily total colors ----
  function dailyTotalBg(total: number): string | undefined {
    if (total >= DAILY_BLOCK_THRESHOLD) return '#FFCDD2'; // red tint
    if (total > DAILY_WARN_THRESHOLD) return '#FFF3E0'; // amber tint
    return undefined;
  }

  // Unselected projects for the add-project dropdown
  const availableProjects = [
    ...allProjects.filter((p) => p.status !== 'ARCHIVED' && !selectedProjectIds.includes(p.id)),
  ].sort((a, b) => {
    const ca = a.client?.name ?? '';
    const cb = b.client?.name ?? '';
    const cmp = ca.localeCompare(cb);
    return cmp !== 0 ? cmp : a.name.localeCompare(b.name);
  });
  const projectMap = useMemo(() => {
    const m = new Map<string, Project>();
    for (const p of allProjects) m.set(p.id, p);
    return m;
  }, [allProjects]);

  // ---- Render ----
  return (
    <Box sx={{ p: { xs: 2, sm: 4 }, maxWidth: 1200, mx: 'auto' }}>
      <Typography variant="h3" sx={{ mb: 0.5, fontWeight: 600 }}>
        Weekly Grid
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Batch-log your time for the week.
      </Typography>

      {errorMsg && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setErrorMsg(null)}>
          {errorMsg}
        </Alert>
      )}

      {/* ---- Week navigation ---- */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          mb: 3,
          flexWrap: 'wrap',
        }}
      >
        <IconButton onClick={() => navigateWeek(-1)} size="small">
          <ChevronLeftIcon />
        </IconButton>
        <Typography variant="h4" sx={{ fontWeight: 600, minWidth: 200, textAlign: 'center' }}>
          {formatWeekLabel(currentWeekStart)}
        </Typography>
        <IconButton onClick={() => navigateWeek(1)} size="small">
          <ChevronRightIcon />
        </IconButton>
        <Button variant="outlined" size="small" onClick={goToThisWeek} sx={{ ml: 1 }}>
          This Week
        </Button>
      </Box>

      {/* ---- Add project row ---- */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <FormControl size="small" sx={{ minWidth: 240 }}>
          <InputLabel id="add-project-label">Add project</InputLabel>
          <Select
            labelId="add-project-label"
            value={addProjectId}
            label="Add project"
            onChange={(e: SelectChangeEvent) => setAddProjectId(e.target.value)}
            disabled={projectsLoading || availableProjects.length === 0}
          >
            {availableProjects.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.client ? `${p.client.name} — ${p.name}` : p.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Button
          variant="contained"
          size="small"
          startIcon={<AddIcon />}
          onClick={handleAddProject}
          disabled={!addProjectId}
        >
          Add
        </Button>
      </Box>

      {/* ---- Grid ---- */}
      {entriesLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress size={32} />
        </Box>
      ) : selectedProjectIds.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
          Add a project above to start logging time.
        </Typography>
      ) : (
        <TableContainer
          sx={{
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2,
            overflowX: 'auto',
          }}
        >
          <Table size="small" sx={{ minWidth: 900 }}>
            <TableHead>
              <TableRow>
                <TableCell
                  sx={{
                    fontWeight: 600,
                    position: { xs: 'sticky', md: 'static' },
                    left: 0,
                    bgcolor: 'background.default',
                    zIndex: 2,
                    minWidth: 160,
                  }}
                >
                  Project
                </TableCell>
                {weekDates.map((d, i) => {
                  const ds = dateKey(d);
                  const dt = computeDailyTotal(ds);
                  return (
                    <TableCell
                      key={ds}
                      align="center"
                      sx={{
                        fontWeight: 600,
                        bgcolor: dailyTotalBg(dt),
                        minWidth: 100,
                      }}
                    >
                      {DAY_LABELS[i]}
                      <br />
                      <Typography variant="caption" color="text.secondary">
                        {format(d, 'MMM d')}
                      </Typography>
                    </TableCell>
                  );
                })}
                <TableCell align="center" sx={{ fontWeight: 600, minWidth: 70 }}>
                  Total
                </TableCell>
                <TableCell sx={{ width: 48 }} />
              </TableRow>
            </TableHead>

            <TableBody>
              {selectedProjectIds.map((pid) => {
                const project = projectMap.get(pid);
                const rowTotal = computeRowTotal(pid);
                return (
                  <TableRow key={pid}>
                    <TableCell
                      sx={{
                        fontWeight: 500,
                        position: { xs: 'sticky', md: 'static' },
                        left: 0,
                        bgcolor: 'background.default',
                        zIndex: 1,
                      }}
                    >
                      {project
                        ? project.client
                          ? `${project.client.name} — ${project.name}`
                          : project.name
                        : pid}
                    </TableCell>
                    {weekDates.map((d) => {
                      const ds = dateKey(d);
                      const ck = cellKey(pid, ds);
                      const cell = cells[ck];
                      const dt = computeDailyTotal(ds);
                      const blocked = dt >= DAILY_BLOCK_THRESHOLD;
                      return (
                        <TableCell
                          key={ds}
                          align="center"
                          sx={{ bgcolor: dailyTotalBg(dt), p: 0.5 }}
                        >
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                            <TextField
                              size="small"
                              type="number"
                              inputProps={{ min: 0, max: 24, step: 0.25 }}
                              value={cell?.hours ?? ''}
                              onChange={(e) => handleHoursChange(ck, e.target.value)}
                              onBlur={() => void handleCellBlur(pid, ds)}
                              disabled={blocked && !(parseFloat(cell?.hours ?? '0') > 0)}
                              sx={{
                                '& .MuiInputBase-input': {
                                  textAlign: 'center',
                                  py: 0.5,
                                  px: 0.5,
                                  fontSize: 14,
                                },
                                maxWidth: 80,
                                mx: 'auto',
                              }}
                            />
                            <Box
                              sx={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 1fr',
                                gap: '2px',
                                maxWidth: 110,
                                mx: 'auto',
                              }}
                            >
                              {TASK_TYPES.map((t) => {
                                const isSelected = (cell?.taskType ?? TASK_TYPES[0]) === t;
                                return (
                                  <Tooltip key={t} title={TASK_TYPE_LABELS[t]} arrow>
                                    <Box
                                      component="button"
                                      type="button"
                                      onClick={() => {
                                        handleTaskTypeChange(ck, pid, t);
                                        setTimeout(() => void handleCellBlur(pid, ds), 0);
                                      }}
                                      sx={{
                                        border: '1px solid',
                                        borderColor: isSelected ? 'primary.main' : 'divider',
                                        borderRadius: 1,
                                        bgcolor: isSelected ? 'primary.main' : 'transparent',
                                        color: isSelected
                                          ? 'primary.contrastText'
                                          : 'text.secondary',
                                        fontSize: 10,
                                        fontWeight: isSelected ? 700 : 400,
                                        fontFamily: 'inherit',
                                        lineHeight: 1,
                                        px: 0.25,
                                        py: 0.4,
                                        cursor: 'pointer',
                                        textAlign: 'center',
                                        transition: 'all 0.15s ease',
                                        '&:hover': {
                                          borderColor: 'primary.main',
                                          bgcolor: isSelected ? 'primary.dark' : 'action.hover',
                                        },
                                      }}
                                    >
                                      {TASK_TYPE_ABBR[t]}
                                    </Box>
                                  </Tooltip>
                                );
                              })}
                            </Box>
                            {cell?.saving && <CircularProgress size={12} sx={{ mx: 'auto' }} />}
                          </Box>
                        </TableCell>
                      );
                    })}
                    <TableCell align="center" sx={{ fontWeight: 600 }}>
                      {rowTotal > 0 ? rowTotal.toFixed(1) : '-'}
                    </TableCell>
                    <TableCell>
                      <Tooltip title="Remove project">
                        <IconButton
                          size="small"
                          onClick={() => handleRemoveProject(pid)}
                          color="error"
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>

            <TableFooter>
              <TableRow>
                <TableCell
                  sx={{
                    fontWeight: 600,
                    position: { xs: 'sticky', md: 'static' },
                    left: 0,
                    bgcolor: 'background.default',
                    zIndex: 1,
                  }}
                >
                  Daily Total
                </TableCell>
                {weekDates.map((d) => {
                  const ds = dateKey(d);
                  const dt = computeDailyTotal(ds);
                  return (
                    <TableCell
                      key={ds}
                      align="center"
                      sx={{ fontWeight: 600, bgcolor: dailyTotalBg(dt) }}
                    >
                      {dt > 0 ? dt.toFixed(1) : '-'}
                      {dt >= DAILY_BLOCK_THRESHOLD && (
                        <Typography
                          variant="caption"
                          display="block"
                          color="error"
                          sx={{ fontSize: 10 }}
                        >
                          Blocked
                        </Typography>
                      )}
                    </TableCell>
                  );
                })}
                <TableCell align="center" sx={{ fontWeight: 700, fontSize: 16 }}>
                  {grandTotal > 0 ? grandTotal.toFixed(1) : '-'}
                </TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
