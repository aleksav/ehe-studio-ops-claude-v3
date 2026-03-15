import { useState, useEffect, useCallback } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { api, ApiError } from '../lib/api';

interface OfficeEvent {
  id: string;
  name: string;
  event_type: string;
  start_date: string;
  end_date: string;
  allow_time_entry: boolean;
  notes: string | null;
  created_at: string;
}

const EVENT_TYPE_OPTIONS = [
  { value: 'OFFICE_CLOSED', label: 'Office Closed' },
  { value: 'TEAM_SOCIAL', label: 'Team Social' },
  { value: 'IMPORTANT_EVENT', label: 'Important Event' },
];

const EVENT_TYPE_LABELS: Record<string, string> = {
  OFFICE_CLOSED: 'Office Closed',
  TEAM_SOCIAL: 'Team Social',
  IMPORTANT_EVENT: 'Important Event',
};

const EVENT_TYPE_COLORS: Record<string, 'error' | 'warning' | 'info'> = {
  OFFICE_CLOSED: 'error',
  TEAM_SOCIAL: 'warning',
  IMPORTANT_EVENT: 'info',
};

const EVENT_TYPE_ALLOW_TIME_ENTRY_DEFAULT: Record<string, boolean> = {
  OFFICE_CLOSED: false,
  TEAM_SOCIAL: true,
  IMPORTANT_EVENT: true,
};

const currentYear = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => currentYear - 1 + i);

export default function OfficeEventsPage({ embedded = false }: { embedded?: boolean }) {
  const [events, setEvents] = useState<OfficeEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [year, setYear] = useState<number>(currentYear);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<OfficeEvent | null>(null);
  const [formName, setFormName] = useState('');
  const [formEventType, setFormEventType] = useState('OFFICE_CLOSED');
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formAllowTimeEntry, setFormAllowTimeEntry] = useState(false);
  const [formNotes, setFormNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Delete confirm
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingEvent, setDeletingEvent] = useState<OfficeEvent | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Snackbar
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');

  // When start date changes, default end date to it if end date is empty or earlier
  useEffect(() => {
    if (formStartDate && (!formEndDate || formEndDate < formStartDate)) {
      setFormEndDate(formStartDate);
    }
  }, [formStartDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchEvents = useCallback(async () => {
    try {
      setFetchError(null);
      const data = await api.get<OfficeEvent[]>(`/api/office-events?year=${year}`);
      setEvents(data);
    } catch {
      setFetchError('Failed to load office events. Please try refreshing the page.');
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    setLoading(true);
    void fetchEvents();
  }, [fetchEvents]);

  const handleYearChange = (e: SelectChangeEvent<number>) => {
    setYear(Number(e.target.value));
  };

  const openCreate = () => {
    setEditingEvent(null);
    setFormName('');
    setFormEventType('OFFICE_CLOSED');
    setFormStartDate('');
    setFormEndDate('');
    setFormAllowTimeEntry(false);
    setFormNotes('');
    setErrorMsg(null);
    setDialogOpen(true);
  };

  const openEdit = (event: OfficeEvent) => {
    setEditingEvent(event);
    setFormName(event.name);
    setFormEventType(event.event_type);
    setFormStartDate(event.start_date.substring(0, 10));
    setFormEndDate(event.end_date.substring(0, 10));
    setFormAllowTimeEntry(event.allow_time_entry);
    setFormNotes(event.notes ?? '');
    setErrorMsg(null);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim() || !formStartDate.trim() || !formEndDate.trim()) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      const payload = {
        name: formName.trim(),
        event_type: formEventType,
        start_date: formStartDate,
        end_date: formEndDate,
        allow_time_entry: formAllowTimeEntry,
        notes: formNotes.trim() || null,
      };
      if (editingEvent) {
        await api.put(`/api/office-events/${editingEvent.id}`, payload);
        setSnackbarMessage('Office event updated.');
      } else {
        await api.post('/api/office-events', payload);
        setSnackbarMessage('Office event created.');
      }
      setSnackbarSeverity('success');
      setDialogOpen(false);
      setSnackbarOpen(true);
      await fetchEvents();
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingEvent) return;
    setDeleting(true);
    try {
      await api.delete(`/api/office-events/${deletingEvent.id}`);
      setDeleteDialogOpen(false);
      setDeletingEvent(null);
      setSnackbarMessage('Office event deleted.');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
      await fetchEvents();
    } catch (err) {
      setSnackbarMessage(err instanceof ApiError ? err.message : 'Failed to delete office event.');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatDateRange = (startDate: string, endDate: string) => {
    const start = formatDate(startDate);
    const end = formatDate(endDate);
    return start === end ? start : `${start} - ${end}`;
  };

  const isFormValid =
    formName.trim() && formStartDate.trim() && formEndDate.trim() && formEndDate >= formStartDate;

  return (
    <Box sx={embedded ? undefined : { p: { xs: 2, sm: 4 } }}>
      {!embedded && (
        <>
          <Typography variant="h3" sx={{ fontWeight: 600, mb: 1 }}>
            Office Events
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            Manage office closures, team socials, and important events.
          </Typography>
        </>
      )}

      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 2,
        }}
      >
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Year</InputLabel>
          <Select value={year} label="Year" onChange={handleYearChange}>
            {YEAR_OPTIONS.map((y) => (
              <MenuItem key={y} value={y}>
                {y}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate} size="small">
          Add Event
        </Button>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress size={28} />
        </Box>
      ) : fetchError ? (
        <Alert severity="error" sx={{ borderRadius: 2 }}>
          {fetchError}
        </Alert>
      ) : events.length === 0 ? (
        <Alert severity="info" sx={{ borderRadius: 2 }}>
          No office events for {year}.
        </Alert>
      ) : (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Date Range</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Time Entry</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="right">
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {events.map((ev) => (
                <TableRow key={ev.id} hover>
                  <TableCell>{ev.name}</TableCell>
                  <TableCell>
                    <Chip
                      label={EVENT_TYPE_LABELS[ev.event_type] ?? ev.event_type}
                      color={EVENT_TYPE_COLORS[ev.event_type] ?? 'default'}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>{formatDateRange(ev.start_date, ev.end_date)}</TableCell>
                  <TableCell>
                    <Chip
                      label={ev.allow_time_entry ? 'Allowed' : 'Blocked'}
                      color={ev.allow_time_entry ? 'success' : 'default'}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Edit">
                      <IconButton size="small" aria-label="Edit" onClick={() => openEdit(ev)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton
                        size="small"
                        color="error"
                        aria-label="Delete"
                        onClick={() => {
                          setDeletingEvent(ev);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Create/Edit Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 600 }}>
          {editingEvent ? 'Edit Office Event' : 'Add Office Event'}
        </DialogTitle>
        <DialogContent>
          {errorMsg && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
              {errorMsg}
            </Alert>
          )}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
            <TextField
              label="Event Name"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              required
              fullWidth
              autoFocus
            />
            <FormControl fullWidth>
              <InputLabel>Event Type</InputLabel>
              <Select
                value={formEventType}
                label="Event Type"
                onChange={(e) => {
                  const type = e.target.value;
                  setFormEventType(type);
                  if (!editingEvent) {
                    setFormAllowTimeEntry(EVENT_TYPE_ALLOW_TIME_ENTRY_DEFAULT[type] ?? false);
                  }
                }}
              >
                {EVENT_TYPE_OPTIONS.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Start Date"
              type="date"
              value={formStartDate}
              onChange={(e) => setFormStartDate(e.target.value)}
              required
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="End Date"
              type="date"
              value={formEndDate}
              onChange={(e) => setFormEndDate(e.target.value)}
              required
              fullWidth
              InputLabelProps={{ shrink: true }}
              helperText={
                formStartDate && formEndDate && formEndDate < formStartDate
                  ? 'End date must be on or after start date'
                  : undefined
              }
              error={!!(formStartDate && formEndDate && formEndDate < formStartDate)}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={formAllowTimeEntry}
                  onChange={(e) => setFormAllowTimeEntry(e.target.checked)}
                />
              }
              label="Allow time entry on these days"
            />
            <TextField
              label="Notes"
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              fullWidth
              multiline
              rows={3}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setDialogOpen(false)} color="inherit" disabled={saving}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleSave} disabled={!isFormValid || saving}>
            {saving ? 'Saving...' : editingEvent ? 'Save Changes' : 'Add Event'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 600 }}>Delete Office Event</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete <strong>{deletingEvent?.name}</strong> (
            {deletingEvent ? formatDateRange(deletingEvent.start_date, deletingEvent.end_date) : ''}
            )?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setDeleteDialogOpen(false)} color="inherit" disabled={deleting}>
            Cancel
          </Button>
          <Button variant="contained" color="error" onClick={handleDelete} disabled={deleting}>
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
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
