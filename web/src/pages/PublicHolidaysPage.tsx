import { useState, useEffect, useCallback } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
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

interface PublicHoliday {
  id: string;
  date: string;
  name: string;
  created_at: string;
}

const currentYear = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => currentYear - 1 + i);

export default function PublicHolidaysPage({ embedded = false }: { embedded?: boolean }) {
  const [holidays, setHolidays] = useState<PublicHoliday[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [year, setYear] = useState<number>(currentYear);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<PublicHoliday | null>(null);
  const [formDate, setFormDate] = useState('');
  const [formName, setFormName] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Delete confirm
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingHoliday, setDeletingHoliday] = useState<PublicHoliday | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Snackbar
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');

  const fetchHolidays = useCallback(async () => {
    try {
      setFetchError(null);
      const data = await api.get<PublicHoliday[]>(`/api/public-holidays?year=${year}`);
      setHolidays(data);
    } catch {
      setFetchError('Failed to load public holidays. Please try refreshing the page.');
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    setLoading(true);
    void fetchHolidays();
  }, [fetchHolidays]);

  const handleYearChange = (e: SelectChangeEvent<number>) => {
    setYear(Number(e.target.value));
  };

  const openCreate = () => {
    setEditingHoliday(null);
    setFormDate('');
    setFormName('');
    setErrorMsg(null);
    setDialogOpen(true);
  };

  const openEdit = (holiday: PublicHoliday) => {
    setEditingHoliday(holiday);
    setFormDate(holiday.date.substring(0, 10));
    setFormName(holiday.name);
    setErrorMsg(null);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formDate.trim() || !formName.trim()) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      if (editingHoliday) {
        await api.put(`/api/public-holidays/${editingHoliday.id}`, {
          date: formDate,
          name: formName.trim(),
        });
        setSnackbarMessage('Holiday updated.');
      } else {
        await api.post('/api/public-holidays', {
          date: formDate,
          name: formName.trim(),
        });
        setSnackbarMessage('Holiday created.');
      }
      setSnackbarSeverity('success');
      setDialogOpen(false);
      setSnackbarOpen(true);
      await fetchHolidays();
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingHoliday) return;
    setDeleting(true);
    try {
      await api.delete(`/api/public-holidays/${deletingHoliday.id}`);
      setDeleteDialogOpen(false);
      setDeletingHoliday(null);
      setSnackbarMessage('Holiday deleted.');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
      await fetchHolidays();
    } catch (err) {
      setSnackbarMessage(err instanceof ApiError ? err.message : 'Failed to delete holiday.');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <Box sx={embedded ? undefined : { p: { xs: 2, sm: 4 } }}>
      {!embedded && (
        <>
          <Typography variant="h3" sx={{ fontWeight: 600, mb: 1 }}>
            Public Holidays
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            Manage public holidays that block time logging.
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
          Add Holiday
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
      ) : holidays.length === 0 ? (
        <Alert severity="info" sx={{ borderRadius: 2 }}>
          No public holidays for {year}.
        </Alert>
      ) : (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="right">
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {holidays.map((h) => (
                <TableRow key={h.id} hover>
                  <TableCell>{formatDate(h.date)}</TableCell>
                  <TableCell>{h.name}</TableCell>
                  <TableCell align="right">
                    <Tooltip title="Edit">
                      <IconButton size="small" aria-label="Edit" onClick={() => openEdit(h)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton
                        size="small"
                        color="error"
                        aria-label="Delete"
                        onClick={() => {
                          setDeletingHoliday(h);
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
          {editingHoliday ? 'Edit Holiday' : 'Add Holiday'}
        </DialogTitle>
        <DialogContent>
          {errorMsg && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
              {errorMsg}
            </Alert>
          )}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
            <TextField
              label="Date"
              type="date"
              value={formDate}
              onChange={(e) => setFormDate(e.target.value)}
              required
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Holiday Name"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              required
              fullWidth
              autoFocus
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setDialogOpen(false)} color="inherit" disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={!formDate.trim() || !formName.trim() || saving}
          >
            {saving ? 'Saving...' : editingHoliday ? 'Save Changes' : 'Add Holiday'}
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
        <DialogTitle sx={{ fontWeight: 600 }}>Delete Holiday</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete <strong>{deletingHoliday?.name}</strong> (
            {deletingHoliday ? formatDate(deletingHoliday.date) : ''})?
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
