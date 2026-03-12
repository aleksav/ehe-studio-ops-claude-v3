import { useState, useEffect, useCallback } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Snackbar,
  TextField,
  Typography,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import SendIcon from '@mui/icons-material/Send';
import { api, ApiError } from '../lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TeamMember {
  id: string;
  full_name: string;
  email: string;
  preferred_task_type: string | null;
  is_active: boolean;
}

interface TimeEntry {
  id: string;
  hours_worked: string | number;
}

interface TimeEntryResponse {
  id: string;
  meta?: { warning?: string };
}

export interface LogTimeModalProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
}

// ---------------------------------------------------------------------------
// Task-type helpers (same as TimeLoggingPage)
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

// ---------------------------------------------------------------------------
// Date helper
// ---------------------------------------------------------------------------

function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function LogTimeModal({ open, onClose, projectId, projectName }: LogTimeModalProps) {
  // Team members
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  // Form state
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [date, setDate] = useState(todayISO());
  const [hours, setHours] = useState('');
  const [taskType, setTaskType] = useState<string>('');
  const [notes, setNotes] = useState('');

  // Daily hours validation
  const [dailyTotal, setDailyTotal] = useState(0);
  const [dailyLoading, setDailyLoading] = useState(false);

  // Submit state
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Success snackbar
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  // ---- Fetch active team members when modal opens ----
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setMembersLoading(true);
    (async () => {
      try {
        const data = await api.get<TeamMember[]>('/api/team-members?is_active=true');
        if (!cancelled) setTeamMembers(data);
      } catch {
        // silently fail
      } finally {
        if (!cancelled) setMembersLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  // ---- Reset form when modal opens ----
  useEffect(() => {
    if (open) {
      setSelectedMemberId('');
      setDate(todayISO());
      setHours('');
      setTaskType('');
      setNotes('');
      setDailyTotal(0);
      setErrorMsg(null);
    }
  }, [open]);

  // ---- On user change: pre-fill task type from preferred_task_type ----
  const handleMemberChange = useCallback(
    (e: SelectChangeEvent) => {
      const memberId = e.target.value;
      setSelectedMemberId(memberId);

      const member = teamMembers.find((m) => m.id === memberId);
      if (member?.preferred_task_type) {
        setTaskType(member.preferred_task_type);
      } else {
        setTaskType('');
      }
    },
    [teamMembers],
  );

  // ---- On date/user change: check daily hours ----
  useEffect(() => {
    if (!selectedMemberId || !date) {
      setDailyTotal(0);
      return;
    }

    let cancelled = false;
    setDailyLoading(true);

    (async () => {
      try {
        const entries = await api.get<TimeEntry[]>(
          `/api/time-entries?team_member_id=${selectedMemberId}&date_from=${date}&date_to=${date}`,
        );
        if (!cancelled) {
          const total = entries.reduce((sum, e) => sum + parseFloat(String(e.hours_worked)), 0);
          setDailyTotal(total);
        }
      } catch {
        if (!cancelled) setDailyTotal(0);
      } finally {
        if (!cancelled) setDailyLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedMemberId, date]);

  // ---- Derived: new total if this entry is added ----
  const parsedHours = parseFloat(hours) || 0;
  const projectedTotal = dailyTotal + parsedHours;
  const isOverWarning = projectedTotal > 8;
  const isBlocked = projectedTotal >= 12;

  // ---- Submit handler ----
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMemberId || !hours || !taskType || isBlocked) return;

    setErrorMsg(null);
    setSubmitting(true);

    try {
      const result = await api.post<TimeEntryResponse>('/api/time-entries', {
        project_id: projectId,
        team_member_id: selectedMemberId,
        date,
        hours_worked: parsedHours,
        task_type: taskType,
        notes: notes.trim() || undefined,
      });

      const message = result.meta?.warning
        ? `Time logged. Warning: ${result.meta.warning}`
        : 'Time entry logged successfully.';

      setSnackbarMessage(message);
      setSnackbarOpen(true);
      onClose();
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

  const canSubmit =
    selectedMemberId && hours && parsedHours > 0 && taskType && !isBlocked && !submitting;

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 600, pb: 1 }}>
          Log Time
          <Typography variant="body2" color="text.secondary">
            {projectName}
          </Typography>
        </DialogTitle>

        <Box component="form" onSubmit={handleSubmit}>
          <DialogContent sx={{ pt: 1 }}>
            {/* Error alert */}
            {errorMsg && (
              <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
                {errorMsg}
              </Alert>
            )}

            {/* Daily cap warning/block chip */}
            {selectedMemberId && parsedHours > 0 && !dailyLoading && (
              <>
                {isBlocked && (
                  <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
                    Daily total would be {projectedTotal.toFixed(1)}h. Maximum 12h per day.
                  </Alert>
                )}
                {isOverWarning && !isBlocked && (
                  <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
                    Daily total would be {projectedTotal.toFixed(1)}h (exceeds 8h).
                  </Alert>
                )}
              </>
            )}

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                gap: 2.5,
              }}
            >
              {/* User selector */}
              <FormControl fullWidth required sx={{ gridColumn: { sm: '1 / -1' } }}>
                <InputLabel id="log-time-member-label">Team Member</InputLabel>
                <Select
                  labelId="log-time-member-label"
                  value={selectedMemberId}
                  label="Team Member"
                  onChange={handleMemberChange}
                  disabled={membersLoading}
                >
                  {membersLoading ? (
                    <MenuItem disabled value="">
                      Loading...
                    </MenuItem>
                  ) : (
                    teamMembers.map((m) => (
                      <MenuItem key={m.id} value={m.id}>
                        {m.full_name}
                      </MenuItem>
                    ))
                  )}
                </Select>
              </FormControl>

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
                <InputLabel id="log-time-task-type-label">Task Type</InputLabel>
                <Select
                  labelId="log-time-task-type-label"
                  value={taskType}
                  label="Task Type"
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

            {/* Daily hours summary chip */}
            {selectedMemberId && !dailyLoading && dailyTotal > 0 && (
              <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Chip
                  icon={<AccessTimeIcon sx={{ fontSize: 16 }} />}
                  label={`${dailyTotal.toFixed(1)}h already logged on ${date}`}
                  size="small"
                  color={dailyTotal > 8 ? 'warning' : 'default'}
                  variant="outlined"
                  sx={{ fontWeight: 600 }}
                />
              </Box>
            )}
          </DialogContent>

          <DialogActions sx={{ px: 3, pb: 2.5 }}>
            <Button onClick={onClose} color="inherit" disabled={submitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={!canSubmit}
              endIcon={submitting ? <CircularProgress size={18} color="inherit" /> : <SendIcon />}
              sx={{
                bgcolor: 'primary.main',
                '&:hover': { bgcolor: 'primary.dark' },
                px: 3,
              }}
            >
              {submitting ? 'Logging...' : 'Log Entry'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* Success snackbar */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbarOpen(false)}
          severity="success"
          sx={{ borderRadius: 2, width: '100%' }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </>
  );
}
