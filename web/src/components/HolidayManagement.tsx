import { useState, useEffect, useCallback } from 'react';
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
  FormControl,
  IconButton,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Snackbar,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { api, ApiError } from '../lib/api';

interface PlannedHoliday {
  id: string;
  team_member_id: string;
  date: string;
  day_type: 'FULL' | 'AM' | 'PM';
  notes: string | null;
}

interface HolidayAllowance {
  total: number;
  used: number;
  remaining: number;
}

interface HolidayFormData {
  date: string;
  day_type: string;
  notes: string;
}

const EMPTY_FORM: HolidayFormData = { date: '', day_type: 'FULL', notes: '' };

const DAY_TYPE_LABELS: Record<string, string> = {
  FULL: 'Full day',
  AM: 'Half day (AM)',
  PM: 'Half day (PM)',
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function HolidayManagement({ teamMemberId }: { teamMemberId: string }) {
  const [holidays, setHolidays] = useState<PlannedHoliday[]>([]);
  const [allowance, setAllowance] = useState<HolidayAllowance | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<PlannedHoliday | null>(null);
  const [form, setForm] = useState<HolidayFormData>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');

  const year = new Date().getFullYear();

  const fetchData = useCallback(async () => {
    try {
      const [h, a] = await Promise.all([
        api.get<PlannedHoliday[]>(`/api/team-members/${teamMemberId}/holidays?year=${year}`),
        api.get<HolidayAllowance>(
          `/api/team-members/${teamMemberId}/holiday-allowance?year=${year}`,
        ),
      ]);
      setHolidays(h);
      setAllowance(a);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [teamMemberId, year]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const showSnackbar = (message: string, severity: 'success' | 'error' = 'success') => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  };

  const handleOpenCreate = () => {
    setEditingHoliday(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const handleOpenEdit = (holiday: PlannedHoliday) => {
    setEditingHoliday(holiday);
    setForm({
      date: holiday.date.substring(0, 10),
      day_type: holiday.day_type,
      notes: holiday.notes ?? '',
    });
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    if (submitting) return;
    setDialogOpen(false);
    setEditingHoliday(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.date || submitting) return;

    setSubmitting(true);
    const payload = {
      date: form.date,
      day_type: form.day_type,
      notes: form.notes || undefined,
    };

    try {
      if (editingHoliday) {
        await api.put(`/api/team-members/${teamMemberId}/holidays/${editingHoliday.id}`, payload);
        showSnackbar('Holiday updated.');
      } else {
        await api.post(`/api/team-members/${teamMemberId}/holidays`, payload);
        showSnackbar('Holiday added.');
      }
      setDialogOpen(false);
      setEditingHoliday(null);
      await fetchData();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Something went wrong.';
      showSnackbar(message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (holiday: PlannedHoliday) => {
    try {
      await api.delete(`/api/team-members/${teamMemberId}/holidays/${holiday.id}`);
      showSnackbar('Holiday removed.');
      await fetchData();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Something went wrong.';
      showSnackbar(message, 'error');
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  const usedPercent = allowance ? (allowance.used / allowance.total) * 100 : 0;

  return (
    <Box>
      {/* Allowance summary */}
      {allowance && (
        <Card
          elevation={0}
          sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, mb: 2 }}
        >
          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
            <Box
              sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}
            >
              <Typography variant="body2" fontWeight={600}>
                {year} Holiday Allowance
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {allowance.used} / {allowance.total} days used
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={Math.min(usedPercent, 100)}
              sx={{ height: 8, borderRadius: 4, mb: 0.5 }}
            />
            <Typography variant="caption" color="text.secondary">
              {allowance.remaining} days remaining
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* Holiday list header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="body2" fontWeight={600}>
          Planned Holidays
        </Typography>
        <Button size="small" startIcon={<AddIcon />} onClick={handleOpenCreate}>
          Add Holiday
        </Button>
      </Box>

      {/* Holiday list */}
      {holidays.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No holidays planned for {year}.
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {holidays.map((holiday) => (
            <Card
              key={holiday.id}
              elevation={0}
              sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}
            >
              <CardContent
                sx={{
                  p: 1.5,
                  '&:last-child': { pb: 1.5 },
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Box>
                  <Typography variant="body2" fontWeight={500}>
                    {formatDate(holiday.date)}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 0.5 }}>
                    <Chip
                      label={DAY_TYPE_LABELS[holiday.day_type]}
                      size="small"
                      sx={{ fontSize: 11, height: 20 }}
                    />
                    {holiday.notes && (
                      <Typography variant="caption" color="text.secondary">
                        {holiday.notes}
                      </Typography>
                    )}
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  <Tooltip title="Edit">
                    <IconButton
                      size="small"
                      onClick={() => handleOpenEdit(holiday)}
                      aria-label="Edit holiday"
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton
                      size="small"
                      onClick={() => handleDelete(holiday)}
                      aria-label="Delete holiday"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      {/* Add/Edit Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 600, pb: 1 }}>
          {editingHoliday ? 'Edit Holiday' : 'Add Holiday'}
        </DialogTitle>
        <Box component="form" onSubmit={handleSubmit}>
          <DialogContent sx={{ pt: 1 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <TextField
                label="Date"
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                required
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
              <FormControl fullWidth>
                <InputLabel id="day-type-label">Day Type</InputLabel>
                <Select
                  labelId="day-type-label"
                  value={form.day_type}
                  label="Day Type"
                  onChange={(e: SelectChangeEvent) =>
                    setForm((f) => ({ ...f, day_type: e.target.value }))
                  }
                >
                  <MenuItem value="FULL">Full day</MenuItem>
                  <MenuItem value="AM">Half day (AM)</MenuItem>
                  <MenuItem value="PM">Half day (PM)</MenuItem>
                </Select>
              </FormControl>
              <TextField
                label="Notes (optional)"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                fullWidth
                multiline
                rows={2}
              />
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5 }}>
            <Button onClick={handleCloseDialog} color="inherit" disabled={submitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={!form.date || submitting}
              endIcon={submitting ? <CircularProgress size={18} color="inherit" /> : undefined}
              sx={{ px: 3 }}
            >
              {submitting ? 'Saving...' : editingHoliday ? 'Save' : 'Add'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* Snackbar */}
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
