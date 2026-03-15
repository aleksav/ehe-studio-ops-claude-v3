import { useState, useEffect, useCallback, useMemo } from 'react';
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

interface PublicHoliday {
  id: string;
  date: string;
  name: string;
}

interface OfficeEvent {
  id: string;
  name: string;
  event_type: string;
  start_date: string;
  end_date: string;
  allow_time_entry: boolean;
}

interface HolidayFormData {
  startDate: string;
  endDate: string;
  day_type: string;
  notes: string;
}

const EMPTY_FORM: HolidayFormData = { startDate: '', endDate: '', day_type: 'FULL', notes: '' };

const DAY_TYPE_LABELS: Record<string, string> = {
  FULL: 'Full day',
  AM: 'Half day (AM)',
  PM: 'Half day (PM)',
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr.substring(0, 10) + 'T00:00:00');
  return d.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getBlockedOfficeDays(events: OfficeEvent[]): Set<string> {
  const blocked = new Set<string>();
  for (const event of events) {
    if (!event.allow_time_entry) {
      const start = new Date(event.start_date.substring(0, 10) + 'T00:00:00');
      const end = new Date(event.end_date.substring(0, 10) + 'T00:00:00');
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        blocked.add(formatDateKey(d));
      }
    }
  }
  return blocked;
}

interface ExclusionSummary {
  weekends: number;
  publicHolidays: number;
  officeBlocked: number;
  alreadyBooked: number;
}

function getEligibleDays(
  startDate: string,
  endDate: string,
  publicHolidays: Set<string>,
  blockedOfficeDays: Set<string>,
  existingHolidays: Set<string>,
): { eligible: string[]; exclusions: ExclusionSummary } {
  const days: string[] = [];
  const exclusions: ExclusionSummary = {
    weekends: 0,
    publicHolidays: 0,
    officeBlocked: 0,
    alreadyBooked: 0,
  };
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dow = d.getDay();
    if (dow === 0 || dow === 6) {
      exclusions.weekends++;
      continue;
    }
    const key = formatDateKey(d);
    if (publicHolidays.has(key)) {
      exclusions.publicHolidays++;
      continue;
    }
    if (blockedOfficeDays.has(key)) {
      exclusions.officeBlocked++;
      continue;
    }
    if (existingHolidays.has(key)) {
      exclusions.alreadyBooked++;
      continue;
    }
    days.push(key);
  }
  return { eligible: days, exclusions };
}

function buildExclusionText(exclusions: ExclusionSummary): string {
  const parts: string[] = [];
  if (exclusions.weekends > 0) {
    parts.push(`${exclusions.weekends} weekend${exclusions.weekends > 1 ? 's' : ''}`);
  }
  if (exclusions.publicHolidays > 0) {
    parts.push(
      `${exclusions.publicHolidays} public holiday${exclusions.publicHolidays > 1 ? 's' : ''}`,
    );
  }
  if (exclusions.officeBlocked > 0) {
    parts.push(
      `${exclusions.officeBlocked} office closed day${exclusions.officeBlocked > 1 ? 's' : ''}`,
    );
  }
  if (exclusions.alreadyBooked > 0) {
    parts.push(
      `${exclusions.alreadyBooked} already booked day${exclusions.alreadyBooked > 1 ? 's' : ''}`,
    );
  }
  if (parts.length === 0) return '';
  return parts.join(', ') + ' excluded';
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

  // Exclusion data
  const [publicHolidaysList, setPublicHolidaysList] = useState<PublicHoliday[]>([]);
  const [officeEventsList, setOfficeEventsList] = useState<OfficeEvent[]>([]);

  const year = new Date().getFullYear();

  const fetchData = useCallback(async () => {
    try {
      const [h, a, ph, oe] = await Promise.all([
        api.get<PlannedHoliday[]>(`/api/team-members/${teamMemberId}/holidays?year=${year}`),
        api.get<HolidayAllowance>(
          `/api/team-members/${teamMemberId}/holiday-allowance?year=${year}`,
        ),
        api.get<PublicHoliday[]>(`/api/public-holidays?year=${year}`),
        api.get<OfficeEvent[]>(`/api/office-events?year=${year}`),
      ]);
      setHolidays(h);
      setAllowance(a);
      setPublicHolidaysList(ph);
      setOfficeEventsList(oe);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [teamMemberId, year]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const publicHolidayDates = useMemo(
    () => new Set(publicHolidaysList.map((ph) => ph.date.substring(0, 10))),
    [publicHolidaysList],
  );

  const blockedOfficeDays = useMemo(
    () => getBlockedOfficeDays(officeEventsList),
    [officeEventsList],
  );

  const existingHolidayDates = useMemo(
    () => new Set(holidays.map((h) => h.date.substring(0, 10))),
    [holidays],
  );

  const rangePreview = useMemo(() => {
    if (!form.startDate || !form.endDate || editingHoliday) return null;
    if (form.startDate > form.endDate) return null;
    return getEligibleDays(
      form.startDate,
      form.endDate,
      publicHolidayDates,
      blockedOfficeDays,
      existingHolidayDates,
    );
  }, [
    form.startDate,
    form.endDate,
    editingHoliday,
    publicHolidayDates,
    blockedOfficeDays,
    existingHolidayDates,
  ]);

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
      startDate: holiday.date.substring(0, 10),
      endDate: holiday.date.substring(0, 10),
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

  const handleStartDateChange = (value: string) => {
    setForm((f) => ({
      ...f,
      startDate: value,
      endDate: f.endDate && f.endDate >= value ? f.endDate : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.startDate || submitting) return;

    setSubmitting(true);

    try {
      if (editingHoliday) {
        // Edit mode: single date update
        const payload = {
          date: form.startDate,
          day_type: form.day_type,
          notes: form.notes || undefined,
        };
        await api.put(`/api/team-members/${teamMemberId}/holidays/${editingHoliday.id}`, payload);
        showSnackbar('Holiday updated.');
      } else {
        // Create mode: batch create for each eligible day
        const endDate = form.endDate || form.startDate;
        const { eligible } = getEligibleDays(
          form.startDate,
          endDate,
          publicHolidayDates,
          blockedOfficeDays,
          existingHolidayDates,
        );

        if (eligible.length === 0) {
          showSnackbar('No eligible working days in the selected range.', 'error');
          setSubmitting(false);
          return;
        }

        const results = await Promise.allSettled(
          eligible.map((date) =>
            api.post(`/api/team-members/${teamMemberId}/holidays`, {
              date,
              day_type: form.day_type,
              notes: form.notes || undefined,
            }),
          ),
        );

        const failed = results.filter((r) => r.status === 'rejected').length;
        if (failed > 0) {
          showSnackbar(
            `${eligible.length - failed} holidays added, ${failed} failed.`,
            failed === eligible.length ? 'error' : 'success',
          );
        } else {
          showSnackbar(`${eligible.length} holiday${eligible.length > 1 ? 's' : ''} added.`);
        }
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
  const isCreateMode = !editingHoliday;
  const canSubmitCreate = isCreateMode && rangePreview && rangePreview.eligible.length > 0;
  const canSubmitEdit = !isCreateMode && form.startDate;
  const canSubmit = canSubmitCreate || canSubmitEdit;

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
              {editingHoliday ? (
                <TextField
                  label="Date"
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                  required
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                />
              ) : (
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <TextField
                    label="Start Date"
                    type="date"
                    value={form.startDate}
                    onChange={(e) => handleStartDateChange(e.target.value)}
                    required
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                  />
                  <TextField
                    label="End Date"
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                    required
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                    inputProps={{ min: form.startDate || undefined }}
                  />
                </Box>
              )}
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
              {/* Range preview (create mode only) */}
              {isCreateMode && form.startDate && form.endDate && (
                <Box>
                  {rangePreview && rangePreview.eligible.length > 0 && (
                    <Alert severity="info" sx={{ borderRadius: 2 }}>
                      <Typography variant="body2" fontWeight={600}>
                        {rangePreview.eligible.length} working day
                        {rangePreview.eligible.length > 1 ? 's' : ''} will be booked
                      </Typography>
                      {buildExclusionText(rangePreview.exclusions) && (
                        <Typography variant="caption" color="text.secondary">
                          {buildExclusionText(rangePreview.exclusions)}
                        </Typography>
                      )}
                    </Alert>
                  )}
                  {rangePreview && rangePreview.eligible.length === 0 && (
                    <Alert severity="warning" sx={{ borderRadius: 2 }}>
                      No eligible working days in the selected range.
                      {buildExclusionText(rangePreview.exclusions) && (
                        <Typography variant="caption" display="block">
                          {buildExclusionText(rangePreview.exclusions)}
                        </Typography>
                      )}
                    </Alert>
                  )}
                  {form.startDate > form.endDate && (
                    <Alert severity="error" sx={{ borderRadius: 2 }}>
                      End date must be on or after start date.
                    </Alert>
                  )}
                </Box>
              )}
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5 }}>
            <Button onClick={handleCloseDialog} color="inherit" disabled={submitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={!canSubmit || submitting}
              endIcon={submitting ? <CircularProgress size={18} color="inherit" /> : undefined}
              sx={{ px: 3 }}
            >
              {submitting
                ? 'Saving...'
                : editingHoliday
                  ? 'Save'
                  : rangePreview && rangePreview.eligible.length > 1
                    ? `Add ${rangePreview.eligible.length} Days`
                    : 'Add'}
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
