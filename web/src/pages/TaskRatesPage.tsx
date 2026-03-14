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
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Snackbar,
  Switch,
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
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { api, ApiError } from '../lib/api';

const TASK_TYPES = [
  'ARCHITECTURE_ENGINEERING_DIRECTION',
  'DESIGN_DELIVERY_RESEARCH',
  'DEVELOPMENT_TESTING',
  'BUSINESS_SUPPORT',
] as const;

const TASK_TYPE_LABELS: Record<string, string> = {
  ARCHITECTURE_ENGINEERING_DIRECTION: 'Architecture / Engineering Direction',
  DESIGN_DELIVERY_RESEARCH: 'Design / Delivery / Research',
  DEVELOPMENT_TESTING: 'Development / Testing',
  BUSINESS_SUPPORT: 'Business Support',
};

interface TaskRate {
  id: string;
  task_type: string;
  day_rate: number;
  currency_code: string;
  effective_from: string;
  effective_to: string | null;
  created_at: string;
  updated_at: string;
}

export default function TaskRatesPage({ embedded = false }: { embedded?: boolean }) {
  const [rates, setRates] = useState<TaskRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [showExpired, setShowExpired] = useState(false);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<TaskRate | null>(null);
  const [formTaskType, setFormTaskType] = useState<string>(TASK_TYPES[0]);
  const [formDayRate, setFormDayRate] = useState('');
  const [formCurrency, setFormCurrency] = useState('GBP');
  const [formEffectiveFrom, setFormEffectiveFrom] = useState('');
  const [formEffectiveTo, setFormEffectiveTo] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Delete confirm
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingRate, setDeletingRate] = useState<TaskRate | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Snackbar
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');

  const fetchRates = useCallback(async () => {
    try {
      setFetchError(null);
      const endpoint = showExpired ? '/api/task-rates' : '/api/task-rates/current';
      const data = await api.get<TaskRate[]>(endpoint);
      setRates(data);
    } catch {
      setFetchError('Failed to load task rates. Please try refreshing the page.');
    } finally {
      setLoading(false);
    }
  }, [showExpired]);

  useEffect(() => {
    setLoading(true);
    void fetchRates();
  }, [fetchRates]);

  const openCreate = () => {
    setEditingRate(null);
    setFormTaskType(TASK_TYPES[0]);
    setFormDayRate('');
    setFormCurrency('GBP');
    setFormEffectiveFrom(new Date().toISOString().split('T')[0]);
    setFormEffectiveTo('');
    setErrorMsg(null);
    setDialogOpen(true);
  };

  const openEdit = (rate: TaskRate) => {
    setEditingRate(rate);
    setFormTaskType(rate.task_type);
    setFormDayRate(String(rate.day_rate));
    setFormCurrency(rate.currency_code);
    setFormEffectiveFrom(rate.effective_from.split('T')[0]);
    setFormEffectiveTo(rate.effective_to ? rate.effective_to.split('T')[0] : '');
    setErrorMsg(null);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const dayRateNum = parseFloat(formDayRate);
    if (!formDayRate || isNaN(dayRateNum) || dayRateNum <= 0) return;
    if (!formEffectiveFrom) return;

    setSaving(true);
    setErrorMsg(null);
    try {
      if (editingRate) {
        await api.put(`/api/task-rates/${editingRate.id}`, {
          day_rate: dayRateNum,
          currency_code: formCurrency.trim() || 'GBP',
          effective_from: formEffectiveFrom,
          effective_to: formEffectiveTo || null,
        });
        setSnackbarMessage('Task rate updated.');
      } else {
        await api.post('/api/task-rates', {
          task_type: formTaskType,
          day_rate: dayRateNum,
          currency_code: formCurrency.trim() || 'GBP',
          effective_from: formEffectiveFrom,
          effective_to: formEffectiveTo || null,
        });
        setSnackbarMessage('Task rate created.');
      }
      setSnackbarSeverity('success');
      setDialogOpen(false);
      setSnackbarOpen(true);
      await fetchRates();
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingRate) return;
    setDeleting(true);
    try {
      await api.delete(`/api/task-rates/${deletingRate.id}`);
      setDeleteDialogOpen(false);
      setDeletingRate(null);
      setSnackbarMessage('Task rate deleted.');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
      await fetchRates();
    } catch (err) {
      setSnackbarMessage(err instanceof ApiError ? err.message : 'Failed to delete task rate.');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    } finally {
      setDeleting(false);
    }
  };

  const isFormValid =
    formTaskType &&
    formDayRate &&
    !isNaN(parseFloat(formDayRate)) &&
    parseFloat(formDayRate) > 0 &&
    formEffectiveFrom;

  return (
    <Box sx={embedded ? undefined : { p: { xs: 2, sm: 4 } }}>
      {!embedded && (
        <>
          <Box
            sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}
          >
            <Typography variant="h3" sx={{ fontWeight: 600 }}>
              Task Rates
            </Typography>
            <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate} size="small">
              Add Rate
            </Button>
          </Box>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
            Manage day rates per task type.
          </Typography>
        </>
      )}

      {/* Toolbar */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 2,
        }}
      >
        <FormControlLabel
          control={
            <Switch
              checked={showExpired}
              onChange={(e) => setShowExpired(e.target.checked)}
              size="small"
            />
          }
          label={<Typography variant="body2">Show expired / historical rates</Typography>}
        />
        {embedded && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate} size="small">
            Add Rate
          </Button>
        )}
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress size={28} />
        </Box>
      ) : fetchError ? (
        <Alert severity="error" sx={{ borderRadius: 2 }}>
          {fetchError}
        </Alert>
      ) : rates.length === 0 ? (
        <Box
          sx={{
            py: 4,
            textAlign: 'center',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 3,
          }}
        >
          <Typography variant="body2" color="text.secondary">
            No task rates found. Add one to get started.
          </Typography>
        </Box>
      ) : (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Task Type</TableCell>
                <TableCell align="right">Day Rate</TableCell>
                <TableCell>Currency</TableCell>
                <TableCell>Effective From</TableCell>
                {showExpired && <TableCell>Effective To</TableCell>}
                <TableCell width={100} align="right">
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rates.map((rate) => (
                <TableRow key={rate.id} hover>
                  <TableCell>{TASK_TYPE_LABELS[rate.task_type] ?? rate.task_type}</TableCell>
                  <TableCell align="right" sx={{ fontFamily: 'monospace' }}>
                    {rate.day_rate.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </TableCell>
                  <TableCell>{rate.currency_code}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    {new Date(rate.effective_from).toLocaleDateString()}
                  </TableCell>
                  {showExpired && (
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      {rate.effective_to ? new Date(rate.effective_to).toLocaleDateString() : '--'}
                    </TableCell>
                  )}
                  <TableCell align="right">
                    <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                      <Tooltip title="Edit">
                        <IconButton size="small" aria-label="Edit" onClick={() => openEdit(rate)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton
                          size="small"
                          color="error"
                          aria-label="Delete"
                          onClick={() => {
                            setDeletingRate(rate);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
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
          {editingRate ? 'Edit Task Rate' : 'Add Task Rate'}
        </DialogTitle>
        <DialogContent>
          {errorMsg && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
              {errorMsg}
            </Alert>
          )}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
            <FormControl fullWidth disabled={!!editingRate}>
              <InputLabel>Task Type</InputLabel>
              <Select
                value={formTaskType}
                label="Task Type"
                onChange={(e) => setFormTaskType(e.target.value)}
              >
                {TASK_TYPES.map((t) => (
                  <MenuItem key={t} value={t}>
                    {TASK_TYPE_LABELS[t]}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Day Rate"
              type="number"
              value={formDayRate}
              onChange={(e) => setFormDayRate(e.target.value)}
              required
              fullWidth
              inputProps={{ min: 0, step: '0.01' }}
            />
            <TextField
              label="Currency Code"
              value={formCurrency}
              onChange={(e) => setFormCurrency(e.target.value.toUpperCase())}
              fullWidth
              inputProps={{ maxLength: 3 }}
              helperText="3-letter ISO code (e.g. GBP, USD)"
            />
            <TextField
              label="Effective From"
              type="date"
              value={formEffectiveFrom}
              onChange={(e) => setFormEffectiveFrom(e.target.value)}
              required
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Effective To"
              type="date"
              value={formEffectiveTo}
              onChange={(e) => setFormEffectiveTo(e.target.value)}
              fullWidth
              InputLabelProps={{ shrink: true }}
              helperText="Leave empty for currently active rates"
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setDialogOpen(false)} color="inherit" disabled={saving}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleSave} disabled={!isFormValid || saving}>
            {saving ? 'Saving...' : editingRate ? 'Save Changes' : 'Add Rate'}
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
        <DialogTitle sx={{ fontWeight: 600 }}>Delete Task Rate</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the{' '}
            <strong>{TASK_TYPE_LABELS[deletingRate?.task_type ?? '']}</strong> rate?
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
