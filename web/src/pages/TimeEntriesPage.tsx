import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import { api } from '../lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TimeEntryProject {
  id: string;
  name: string;
  status: string;
}

interface TimeEntryMember {
  id: string;
  full_name: string;
  email: string;
}

interface TimeEntry {
  id: string;
  project_id: string;
  team_member_id: string;
  date: string;
  hours_worked: number;
  task_type: string;
  notes: string | null;
  project: TimeEntryProject;
  team_member: TimeEntryMember;
}

interface ClientOption {
  id: string;
  name: string;
}

interface ProjectOption {
  id: string;
  name: string;
  client_id: string | null;
}

interface MemberOption {
  id: string;
  full_name: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TASK_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'ARCHITECTURE_ENGINEERING_DIRECTION', label: 'Architecture & Engineering' },
  { value: 'DESIGN_DELIVERY_RESEARCH', label: 'Design & Research' },
  { value: 'DEVELOPMENT_TESTING', label: 'Development & Testing' },
  { value: 'BUSINESS_SUPPORT', label: 'Business Support' },
];

const TASK_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  TASK_TYPE_OPTIONS.map((o) => [o.value, o.label]),
);

const TASK_TYPE_COLOR: Record<string, string> = {
  ARCHITECTURE_ENGINEERING_DIRECTION: '#7C3AED',
  DESIGN_DELIVERY_RESEARCH: '#0891B2',
  DEVELOPMENT_TESTING: '#059669',
  BUSINESS_SUPPORT: '#D97706',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TimeEntriesPage({ embedded }: { embedded?: boolean }) {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [members, setMembers] = useState<MemberOption[]>([]);

  // Filters
  const [clientId, setClientId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [memberId, setMemberId] = useState('');
  const [taskType, setTaskType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Fetch filter options on mount
  useEffect(() => {
    api
      .get<ClientOption[]>('/api/clients')
      .then((c) => setClients(c.sort((a, b) => a.name.localeCompare(b.name))))
      .catch(() => {});
    api
      .get<ProjectOption[]>('/api/projects')
      .then((p) => setProjects(p.sort((a, b) => a.name.localeCompare(b.name))))
      .catch(() => {});
    api
      .get<MemberOption[]>('/api/team-members')
      .then((m) => setMembers(m.sort((a, b) => a.full_name.localeCompare(b.full_name))))
      .catch(() => {});
  }, []);

  const filteredProjects = useMemo(
    () => (clientId ? projects.filter((p) => p.client_id === clientId) : projects),
    [projects, clientId],
  );

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (clientId && !projectId) params.set('client_id', clientId);
      if (projectId) params.set('project_id', projectId);
      if (memberId) params.set('team_member_id', memberId);
      if (taskType) params.set('task_type', taskType);
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);
      const qs = params.toString();
      const data = await api.get<TimeEntry[]>(`/api/time-entries${qs ? `?${qs}` : ''}`);
      setEntries(data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [clientId, projectId, memberId, taskType, dateFrom, dateTo]);

  useEffect(() => {
    void fetchEntries();
  }, [fetchEntries]);

  const totalHours = useMemo(
    () => entries.reduce((sum, e) => sum + Number(e.hours_worked), 0),
    [entries],
  );

  return (
    <Box>
      {!embedded && (
        <Typography variant="h5" sx={{ fontWeight: 600, mb: 2 }}>
          Time Entries
        </Typography>
      )}

      {/* Filters */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Client</InputLabel>
          <Select
            value={clientId}
            label="Client"
            onChange={(e: SelectChangeEvent) => {
              setClientId(e.target.value);
              setProjectId('');
            }}
          >
            <MenuItem value="">All</MenuItem>
            {clients.map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {c.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Project</InputLabel>
          <Select
            value={projectId}
            label="Project"
            onChange={(e: SelectChangeEvent) => setProjectId(e.target.value)}
          >
            <MenuItem value="">All</MenuItem>
            {filteredProjects.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Team Member</InputLabel>
          <Select
            value={memberId}
            label="Team Member"
            onChange={(e: SelectChangeEvent) => setMemberId(e.target.value)}
          >
            <MenuItem value="">All</MenuItem>
            {members.map((m) => (
              <MenuItem key={m.id} value={m.id}>
                {m.full_name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Task Type</InputLabel>
          <Select
            value={taskType}
            label="Task Type"
            onChange={(e: SelectChangeEvent) => setTaskType(e.target.value)}
          >
            <MenuItem value="">All</MenuItem>
            {TASK_TYPE_OPTIONS.map((t) => (
              <MenuItem key={t.value} value={t.value}>
                {t.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <TextField
          label="From"
          type="date"
          size="small"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={{ minWidth: 150 }}
        />
        <TextField
          label="To"
          type="date"
          size="small"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={{ minWidth: 150 }}
        />
      </Box>

      {/* Summary */}
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        {entries.length} entries &middot; {totalHours.toFixed(1)} hours
      </Typography>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress size={28} />
        </Box>
      ) : entries.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
          No time entries found.
        </Typography>
      ) : (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Team Member</TableCell>
                <TableCell>Project</TableCell>
                <TableCell>Task Type</TableCell>
                <TableCell align="right">Hours</TableCell>
                <TableCell>Notes</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.id} hover>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    {new Date(entry.date.substring(0, 10) + 'T00:00:00').toLocaleDateString(
                      'en-GB',
                      { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' },
                    )}
                  </TableCell>
                  <TableCell>{entry.team_member.full_name}</TableCell>
                  <TableCell>{entry.project.name}</TableCell>
                  <TableCell>
                    <Chip
                      label={TASK_TYPE_LABEL[entry.task_type] ?? entry.task_type}
                      size="small"
                      sx={{
                        fontSize: 11,
                        height: 22,
                        bgcolor: TASK_TYPE_COLOR[entry.task_type] ?? '#888',
                        color: '#fff',
                      }}
                    />
                  </TableCell>
                  <TableCell align="right">{Number(entry.hours_worked).toFixed(1)}</TableCell>
                  <TableCell>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{
                        maxWidth: 200,
                        display: 'block',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {entry.notes || '—'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
