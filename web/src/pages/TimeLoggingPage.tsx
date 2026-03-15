import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  DialogContentText,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableFooter,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import SendIcon from '@mui/icons-material/Send';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
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
import { api, ApiError } from '../lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Project {
  id: string;
  name: string;
  status: string;
  client: { id: string; name: string } | null;
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

/** Key: `${projectId}::${dateStr}` */
interface CellData {
  hours: string;
  taskType: string;
  entryId: string | null;
  saving: boolean;
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

const TASK_TYPE_SHORT_LABELS: Record<TaskTypeValue, string> = {
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

function formatTaskType(value: string): string {
  return TASK_TYPE_LABELS[value as TaskTypeValue] ?? value;
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function toDateKey(iso: string): string {
  return iso.slice(0, 10);
}

// ---------------------------------------------------------------------------
// Weekly Grid helpers
// ---------------------------------------------------------------------------

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const LS_KEY_PROJECTS = 'weeklyGrid:projectRows';
const LS_KEY_TASK_TYPES = 'weeklyGrid:taskTypes';

const DAILY_WARN_THRESHOLD = 8;
const DAILY_BLOCK_THRESHOLD = 12;

interface OfficeEventInfo {
  id: string;
  name: string;
  event_type: string;
  start_date: string;
  end_date: string;
  allow_time_entry: boolean;
}

function isBlockedDate(
  dateStr: string,
  holidayDates: Set<string>,
  officeEventBlockedDates?: Map<string, string>,
  leaveDates?: Set<string>,
): 'weekend' | 'holiday' | 'office_event' | 'leave' | null {
  if (leaveDates?.has(dateStr)) return 'leave';
  const d = parseISO(dateStr);
  const day = d.getDay();
  if (day === 0 || day === 6) return 'weekend';
  if (holidayDates.has(dateStr)) return 'holiday';
  if (officeEventBlockedDates?.has(dateStr)) return 'office_event';
  return null;
}

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
// DateGroup helper for Quick Entry
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

  const sorted = [...map.entries()].sort(([a], [b]) => (a > b ? -1 : a < b ? 1 : 0));

  return sorted.map(([date, groupEntries]) => ({
    date,
    total: groupEntries.reduce((s, e) => s + parseFloat(String(e.hours_worked)), 0),
    entries: groupEntries,
  }));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TimeLoggingPage() {
  const { user } = useAuth();
  const teamMemberId = user?.team_member?.id ?? null;
  const [searchParams, setSearchParams] = useSearchParams();

  // ---- Tab state ----
  const [activeTab, setActiveTab] = useState(0);

  // ---- Shared: Project list ----
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);

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

  // ---- Public holidays ----
  const [holidayDates, setHolidayDates] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.get<{ date: string }[]>('/api/public-holidays');
        if (!cancelled) {
          setHolidayDates(new Set(data.map((h) => h.date.substring(0, 10))));
        }
      } catch {
        // silently fail — holidays will just not be blocked
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ---- Office events ----
  const [officeEventBlockedDates, setOfficeEventBlockedDates] = useState<Map<string, string>>(
    new Map(),
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.get<OfficeEventInfo[]>('/api/office-events');
        if (!cancelled) {
          // Build a map of dateStr -> event name for dates where time entry is NOT allowed
          const blocked = new Map<string, string>();
          for (const ev of data) {
            if (!ev.allow_time_entry) {
              const start = ev.start_date.substring(0, 10);
              const end = ev.end_date.substring(0, 10);
              let current = parseISO(start);
              const endDate = parseISO(end);
              while (current <= endDate) {
                blocked.set(format(current, 'yyyy-MM-dd'), ev.name);
                current = addDays(current, 1);
              }
            }
          }
          setOfficeEventBlockedDates(blocked);
        }
      } catch {
        // silently fail
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ---- Planned leave (team member holidays) ----
  const [leaveDates, setLeaveDates] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!teamMemberId) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await api.get<{ date: string; day_type: string }[]>(
          `/api/team-members/${teamMemberId}/holidays`,
        );
        if (!cancelled) {
          setLeaveDates(new Set(data.map((h) => h.date.substring(0, 10))));
        }
      } catch {
        // silently fail
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [teamMemberId]);

  // =====================================================================
  // WEEKLY GRID STATE
  // =====================================================================

  const weekParam = searchParams.get('week');
  const currentWeekStart = useMemo(() => {
    if (weekParam) {
      const parsedWeek = parseISOWeekString(weekParam);
      if (parsedWeek) return startOfISOWeek(parsedWeek);
      const parsedDate = parseISO(weekParam);
      if (!isNaN(parsedDate.getTime())) return startOfISOWeek(parsedDate);
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

  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>(() =>
    loadSavedProjectIds(),
  );
  const [addProjectId, setAddProjectId] = useState('');
  const savedTaskTypesRef = useRef<Record<string, string>>(loadSavedTaskTypes());
  const [cells, setCells] = useState<Record<string, CellData>>({});
  const [gridEntriesLoading, setGridEntriesLoading] = useState(false);
  const [gridErrorMsg, setGridErrorMsg] = useState<string | null>(null);

  // Weekend / holiday override state
  const [unblockedDates, setUnblockedDates] = useState<Set<string>>(new Set());
  const [blockDialog, setBlockDialog] = useState<{
    open: boolean;
    dateStr: string;
    projectId: string;
    reason: 'weekend' | 'holiday' | 'office_event' | 'leave';
  }>({ open: false, dateStr: '', projectId: '', reason: 'weekend' });
  const [blockOverrideReason, setBlockOverrideReason] = useState('');
  const [pendingFocusCellKey, setPendingFocusCellKey] = useState<string | null>(null);

  // Fetch entries for the week
  const fetchGridEntries = useCallback(async () => {
    if (!teamMemberId) {
      setCells({});
      return;
    }
    setGridEntriesLoading(true);
    setGridErrorMsg(null);

    const startDate = dateKey(currentWeekStart);
    const endDate = dateKey(endOfISOWeek(currentWeekStart));

    try {
      const data = await api.get<TimeEntry[]>(
        `/api/time-entries?team_member_id=${teamMemberId}&start_date=${startDate}&end_date=${endDate}`,
      );

      // Auto-include projects that have existing time entries for this week
      const entryProjectIds = new Set(data.map((e) => e.project_id));
      const mergedProjectIds = [...selectedProjectIds];
      for (const epid of entryProjectIds) {
        if (!mergedProjectIds.includes(epid)) {
          mergedProjectIds.push(epid);
        }
      }
      if (mergedProjectIds.length !== selectedProjectIds.length) {
        setSelectedProjectIds(mergedProjectIds);
        saveProjectIds(mergedProjectIds);
      }

      const newCells: Record<string, CellData> = {};
      for (const pid of mergedProjectIds) {
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
      setGridErrorMsg('Failed to load time entries for this week.');
    } finally {
      setGridEntriesLoading(false);
    }
  }, [teamMemberId, selectedProjectIds, currentWeekStart, weekDates]);

  useEffect(() => {
    void fetchGridEntries();
  }, [fetchGridEntries]);

  const handleAddProject = useCallback(() => {
    if (!addProjectId || selectedProjectIds.includes(addProjectId)) return;
    const updated = [...selectedProjectIds, addProjectId];
    setSelectedProjectIds(updated);
    saveProjectIds(updated);
    setAddProjectId('');
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

  const handleRemoveProject = useCallback(
    (projectId: string) => {
      const updated = selectedProjectIds.filter((id) => id !== projectId);
      setSelectedProjectIds(updated);
      saveProjectIds(updated);
    },
    [selectedProjectIds],
  );

  const snapToHalf = useCallback((value: string): string => {
    const num = parseFloat(value);
    if (isNaN(num) || num <= 0) return '';
    const snapped = Math.max(0.5, Math.round(num * 2) / 2);
    return String(snapped);
  }, []);

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
    savedTaskTypesRef.current[projectId] = value;
    saveSavedTaskTypes(savedTaskTypesRef.current);
  }, []);

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

  const handleCellBlur = useCallback(
    async (projectId: string, dateStr: string) => {
      if (!teamMemberId) return;
      const ck = cellKey(projectId, dateStr);
      const cell = cells[ck];
      if (!cell) return;

      // Snap to nearest 0.5
      const snapped = snapToHalf(cell.hours);
      if (snapped !== cell.hours) {
        setCells((prev) => ({
          ...prev,
          [ck]: { ...prev[ck], hours: snapped },
        }));
      }

      const hoursNum = parseFloat(snapped);
      const isZeroOrEmpty = !snapped || isNaN(hoursNum) || hoursNum <= 0;

      // If zero/empty and there's an existing entry, delete it
      if (isZeroOrEmpty && cell.entryId) {
        setCells((prev) => ({
          ...prev,
          [ck]: { ...prev[ck], saving: true },
        }));
        try {
          await api.delete(`/api/time-entries/${cell.entryId}`);
          setCells((prev) => ({
            ...prev,
            [ck]: { ...prev[ck], hours: '', entryId: null, saving: false },
          }));
        } catch {
          setCells((prev) => ({
            ...prev,
            [ck]: { ...prev[ck], saving: false },
          }));
          setGridErrorMsg('Failed to delete entry. Please try again.');
        }
        return;
      }

      // Nothing to save if zero/empty and no existing entry
      if (isZeroOrEmpty) return;

      const blockReason = isBlockedDate(dateStr, holidayDates, officeEventBlockedDates, leaveDates);
      if (blockReason && !unblockedDates.has(dateStr)) return;

      const dailyTotal = computeDailyTotal(dateStr);
      if (dailyTotal >= DAILY_BLOCK_THRESHOLD) return;

      setCells((prev) => ({
        ...prev,
        [ck]: { ...prev[ck], saving: true },
      }));

      try {
        if (cell.entryId) {
          const updated = await api.put<TimeEntry>(`/api/time-entries/${cell.entryId}`, {
            hours_worked: hoursNum,
            task_type: cell.taskType,
          });
          setCells((prev) => ({
            ...prev,
            [ck]: { ...prev[ck], entryId: updated.id, saving: false },
          }));
        } else {
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
        setGridErrorMsg('Failed to save entry. Please try again.');
      }
    },
    [teamMemberId, cells, unblockedDates, computeDailyTotal, snapToHalf],
  );

  const handleBlockDialogConfirm = useCallback(() => {
    if (!blockOverrideReason.trim()) return;
    const { dateStr, projectId } = blockDialog;
    setUnblockedDates((prev) => {
      const next = new Set(prev);
      next.add(dateStr);
      return next;
    });
    setBlockDialog({ open: false, dateStr: '', projectId: '', reason: 'weekend' });
    setBlockOverrideReason('');
    if (dateStr && projectId) {
      setPendingFocusCellKey(cellKey(projectId, dateStr));
    }
  }, [blockDialog, blockOverrideReason]);

  const handleBlockDialogCancel = useCallback(() => {
    setBlockDialog({ open: false, dateStr: '', projectId: '', reason: 'weekend' });
    setBlockOverrideReason('');
  }, []);

  useEffect(() => {
    if (!pendingFocusCellKey) return;
    const key = pendingFocusCellKey;
    setPendingFocusCellKey(null);
    setTimeout(() => {
      const input = document.querySelector<HTMLInputElement>(`input[data-cell-key="${key}"]`);
      input?.focus();
    }, 50);
  }, [pendingFocusCellKey]);

  const grandTotal = useMemo(() => {
    let total = 0;
    for (const pid of selectedProjectIds) {
      total += computeRowTotal(pid);
    }
    return total;
  }, [selectedProjectIds, computeRowTotal]);

  function dailyTotalBg(total: number): string | undefined {
    if (total >= DAILY_BLOCK_THRESHOLD) return '#FFCDD2';
    if (total > DAILY_WARN_THRESHOLD) return '#FFF3E0';
    return undefined;
  }

  const availableProjects = [
    ...projects.filter((p) => p.status !== 'ARCHIVED' && !selectedProjectIds.includes(p.id)),
  ].sort((a, b) => {
    const ca = a.client?.name ?? '';
    const cb = b.client?.name ?? '';
    const cmp = ca.localeCompare(cb);
    return cmp !== 0 ? cmp : a.name.localeCompare(b.name);
  });

  const projectMap = useMemo(() => {
    const m = new Map<string, Project>();
    for (const p of projects) m.set(p.id, p);
    return m;
  }, [projects]);

  // =====================================================================
  // QUICK ENTRY STATE
  // =====================================================================

  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [memberDetail, setMemberDetail] = useState<TeamMemberDetail | null>(null);
  const [date, setDate] = useState(todayISO());
  const [hours, setHours] = useState('');
  const [taskType, setTaskType] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [warningMsg, setWarningMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(false);

  // Fetch team member detail
  useEffect(() => {
    if (!teamMemberId) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await api.get<TeamMemberDetail>(`/api/team-members/${teamMemberId}`);
        if (!cancelled) {
          setMemberDetail(data);
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

  // Fetch entries for selected project (quick entry)
  const fetchQuickEntries = useCallback(async () => {
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
    void fetchQuickEntries();
  }, [fetchQuickEntries]);

  useEffect(() => {
    if (memberDetail?.preferred_task_type && !taskType) {
      setTaskType(memberDetail.preferred_task_type);
    }
  }, [memberDetail, taskType]);

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

      setHours('');
      setNotes('');
      void fetchQuickEntries();
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

  const groupedEntries = groupByDate(entries);
  const projectTotal = entries.reduce((sum, e) => sum + parseFloat(String(e.hours_worked)), 0);
  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  // Sort projects for quick entry dropdown
  const sortedActiveProjects = [...projects.filter((p) => p.status !== 'ARCHIVED')].sort((a, b) => {
    const ca = a.client?.name ?? '';
    const cb = b.client?.name ?? '';
    const cmp = ca.localeCompare(cb);
    return cmp !== 0 ? cmp : a.name.localeCompare(b.name);
  });

  // ---- Render ----
  return (
    <Box sx={{ p: { xs: 2, sm: 4 }, maxWidth: 1200, mx: 'auto' }}>
      <Typography variant="h3" sx={{ mb: 0.5, fontWeight: 600 }}>
        Time Logging
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Track your time with the weekly grid or log individual entries.
      </Typography>

      {/* ---- Tabs ---- */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          sx={{
            '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, fontSize: 15 },
            '& .Mui-selected': { color: 'primary.main' },
          }}
        >
          <Tab label="Weekly Grid" />
          <Tab label="Quick Entry" />
        </Tabs>
      </Box>

      {/* ================================================================= */}
      {/* TAB 0: Weekly Grid                                                 */}
      {/* ================================================================= */}
      {activeTab === 0 && (
        <Box>
          {gridErrorMsg && (
            <Alert
              severity="error"
              sx={{ mb: 2, borderRadius: 2 }}
              onClose={() => setGridErrorMsg(null)}
            >
              {gridErrorMsg}
            </Alert>
          )}

          {/* Week navigation */}
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
            <TextField
              type="date"
              size="small"
              value={format(currentWeekStart, 'yyyy-MM-dd')}
              onChange={(e) => {
                const picked = parseISO(e.target.value);
                if (!isNaN(picked.getTime())) {
                  setSearchParams(
                    { week: toISOWeekString(startOfISOWeek(picked)) },
                    { replace: true },
                  );
                }
              }}
              sx={{ ml: 1, width: 160 }}
              InputProps={{ sx: { height: 32, fontSize: '0.85rem' } }}
            />
            <Button variant="outlined" size="small" onClick={goToThisWeek} sx={{ ml: 1 }}>
              This Week
            </Button>
          </Box>

          {/* Add project row */}
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

          {/* Grid */}
          {gridEntriesLoading ? (
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
                      const blockReason = isBlockedDate(ds, holidayDates, officeEventBlockedDates, leaveDates);
                      const isDateBlocked = blockReason !== null && !unblockedDates.has(ds);
                      return (
                        <TableCell
                          key={ds}
                          align="center"
                          sx={{
                            fontWeight: 600,
                            bgcolor: isDateBlocked ? '#F0F0F0' : dailyTotalBg(dt),
                            minWidth: 100,
                          }}
                        >
                          {DAY_LABELS[i]}
                          <br />
                          <Typography variant="caption" color="text.secondary">
                            {format(d, 'MMM d')}
                          </Typography>
                          {blockReason && (
                            <Box
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 0.25,
                              }}
                            >
                              {isDateBlocked ? (
                                <LockOutlinedIcon sx={{ fontSize: 10, color: 'text.disabled' }} />
                              ) : (
                                <Tooltip title="Override active" arrow>
                                  <WarningAmberIcon sx={{ fontSize: 10, color: 'warning.main' }} />
                                </Tooltip>
                              )}
                              <Typography
                                variant="caption"
                                sx={{
                                  fontSize: 9,
                                  color: isDateBlocked ? 'text.disabled' : 'warning.main',
                                }}
                              >
                                {blockReason === 'weekend'
                                  ? '(Weekend)'
                                  : blockReason === 'leave'
                                    ? '(On Leave)'
                                    : blockReason === 'office_event'
                                      ? `(${officeEventBlockedDates.get(ds) ?? 'Office Event'})`
                                      : '(Holiday)'}
                              </Typography>
                            </Box>
                          )}
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
                          const dailyBlocked = dt >= DAILY_BLOCK_THRESHOLD;
                          const blockReason = isBlockedDate(
                            ds,
                            holidayDates,
                            officeEventBlockedDates,
                            leaveDates,
                          );
                          const dateBlocked = blockReason !== null && !unblockedDates.has(ds);
                          const isOverridden = blockReason !== null && unblockedDates.has(ds);
                          const hasValue = parseFloat(cell?.hours ?? '0') > 0;
                          const isDisabled = !hasValue && (dateBlocked || dailyBlocked);
                          return (
                            <TableCell
                              key={ds}
                              align="center"
                              sx={{
                                bgcolor: dateBlocked ? '#F0F0F0' : dailyTotalBg(dt),
                                p: 0.5,
                                ...(dateBlocked && { color: 'text.disabled' }),
                                ...(isOverridden && {
                                  borderLeft: '2px solid',
                                  borderRight: '2px solid',
                                  borderColor: 'warning.main',
                                }),
                              }}
                            >
                              {dateBlocked ? (
                                <Tooltip title="Click to override and log time" arrow>
                                  <Box
                                    onClick={() =>
                                      setBlockDialog({
                                        open: true,
                                        dateStr: ds,
                                        projectId: pid,
                                        reason: blockReason!,
                                      })
                                    }
                                    sx={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      py: 1.5,
                                      cursor: 'pointer',
                                      '&:hover': { opacity: 0.7 },
                                    }}
                                  >
                                    <LockOutlinedIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
                                  </Box>
                                </Tooltip>
                              ) : (
                              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                <TextField
                                  size="small"
                                  type="number"
                                  inputProps={{
                                    min: 0.5,
                                    max: 24,
                                    step: 0.5,
                                    'data-cell-key': ck,
                                  }}
                                  value={cell?.hours ?? ''}
                                  onChange={(e) => handleHoursChange(ck, e.target.value)}
                                  onBlur={() => void handleCellBlur(pid, ds)}
                                  disabled={isDisabled}
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
                                      <Tooltip key={t} title={TASK_TYPE_SHORT_LABELS[t]} arrow>
                                        <Box
                                          component="button"
                                          type="button"
                                          tabIndex={-1}
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
                              )}
                            </TableCell>
                          );
                        })}
                        <TableCell align="center" sx={{ fontWeight: 600 }}>
                          {rowTotal > 0 ? rowTotal.toFixed(1) : '-'}
                        </TableCell>
                        <TableCell>
                          {rowTotal > 0 ? (
                            <Tooltip title="Cannot remove — hours logged this week">
                              <span>
                                <IconButton
                                  size="small"
                                  tabIndex={-1}
                                  disabled
                                >
                                  <DeleteOutlineIcon fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                          ) : (
                            <Tooltip title="Remove project">
                              <IconButton
                                size="small"
                                tabIndex={-1}
                                onClick={() => handleRemoveProject(pid)}
                                color="error"
                              >
                                <DeleteOutlineIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
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
                      const footerBlockReason = isBlockedDate(
                        ds,
                        holidayDates,
                        officeEventBlockedDates,
                        leaveDates,
                      );
                      const footerDateBlocked =
                        footerBlockReason !== null && !unblockedDates.has(ds);
                      return (
                        <TableCell
                          key={ds}
                          align="center"
                          sx={{
                            fontWeight: 600,
                            bgcolor: footerDateBlocked ? '#F0F0F0' : dailyTotalBg(dt),
                          }}
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

          {/* Weekend / holiday override confirmation dialog */}
          <Dialog open={blockDialog.open} onClose={handleBlockDialogCancel} maxWidth="xs" fullWidth>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <WarningAmberIcon sx={{ color: 'warning.main' }} />
              Override Blocked Date
            </DialogTitle>
            <DialogContent>
              <DialogContentText sx={{ mb: 2 }}>
                This day is a{' '}
                <strong>
                  {blockDialog.reason === 'weekend'
                    ? 'weekend'
                    : blockDialog.reason === 'leave'
                      ? 'planned leave day'
                      : blockDialog.reason === 'office_event'
                        ? 'blocked office event'
                        : 'public holiday'}
                </strong>.
                Time entry is normally blocked. Please provide a brief reason to override.
              </DialogContentText>
              <TextField
                autoFocus
                fullWidth
                size="small"
                label="Reason for override"
                placeholder="e.g. Urgent client deadline, on-call duty"
                value={blockOverrideReason}
                onChange={(e) => setBlockOverrideReason(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && blockOverrideReason.trim()) {
                    handleBlockDialogConfirm();
                  }
                }}
                helperText="This override applies to this session only."
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={handleBlockDialogCancel}>Cancel</Button>
              <Button
                onClick={handleBlockDialogConfirm}
                variant="contained"
                color="warning"
                disabled={!blockOverrideReason.trim()}
              >
                Override &amp; Log Time
              </Button>
            </DialogActions>
          </Dialog>
        </Box>
      )}

      {/* ================================================================= */}
      {/* TAB 1: Quick Entry                                                 */}
      {/* ================================================================= */}
      {activeTab === 1 && (
        <Box sx={{ maxWidth: 800 }}>
          {/* Project selector */}
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
                    {sortedActiveProjects.map((p) => (
                      <MenuItem key={p.id} value={p.id}>
                        {p.client ? `${p.client.name} — ${p.name}` : p.name}
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

          {/* Entry form */}
          {selectedProjectId && (
            <Card
              elevation={0}
              sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, mb: 3 }}
            >
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h4" sx={{ mb: 2.5, fontWeight: 600 }}>
                  Log Time
                  {selectedProject
                    ? ` — ${selectedProject.client ? `${selectedProject.client.name} — ` : ''}${selectedProject.name}`
                    : ''}
                </Typography>

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
                    <TextField
                      label="Hours"
                      type="number"
                      value={hours}
                      onChange={(e) => setHours(e.target.value)}
                      onBlur={() => {
                        const snapped = snapToHalf(hours);
                        if (snapped !== hours) setHours(snapped);
                      }}
                      inputProps={{ min: 0.5, step: 0.5 }}
                      placeholder="e.g. 2.5"
                      required
                      fullWidth
                    />
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
                    endIcon={
                      submitting ? <CircularProgress size={18} color="inherit" /> : <SendIcon />
                    }
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

          {/* Entries list */}
          {selectedProjectId && (
            <Card
              elevation={0}
              sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3 }}
            >
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
      )}
    </Box>
  );
}
