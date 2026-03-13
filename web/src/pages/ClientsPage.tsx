import { useState, useEffect } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Snackbar,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { api, ApiError } from '../lib/api';

interface Client {
  id: string;
  name: string;
  contact_name: string | null;
  contact_email: string | null;
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [formName, setFormName] = useState('');
  const [formContactName, setFormContactName] = useState('');
  const [formContactEmail, setFormContactEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Delete confirm
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingClient, setDeletingClient] = useState<Client | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Snackbar
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');

  const fetchClients = async () => {
    try {
      setFetchError(null);
      const data = await api.get<Client[]>('/api/clients');
      setClients(data);
    } catch {
      setFetchError('Failed to load clients. Please try refreshing the page.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchClients();
  }, []);

  const openCreate = () => {
    setEditingClient(null);
    setFormName('');
    setFormContactName('');
    setFormContactEmail('');
    setErrorMsg(null);
    setDialogOpen(true);
  };

  const openEdit = (client: Client) => {
    setEditingClient(client);
    setFormName(client.name);
    setFormContactName(client.contact_name ?? '');
    setFormContactEmail(client.contact_email ?? '');
    setErrorMsg(null);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      if (editingClient) {
        await api.put(`/api/clients/${editingClient.id}`, {
          name: formName.trim(),
          contact_name: formContactName.trim() || null,
          contact_email: formContactEmail.trim() || null,
        });
        setSnackbarMessage('Client updated.');
      } else {
        await api.post('/api/clients', {
          name: formName.trim(),
          contact_name: formContactName.trim() || undefined,
          contact_email: formContactEmail.trim() || undefined,
        });
        setSnackbarMessage('Client created.');
      }
      setSnackbarSeverity('success');
      setDialogOpen(false);
      setSnackbarOpen(true);
      await fetchClients();
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingClient) return;
    setDeleting(true);
    try {
      await api.delete(`/api/clients/${deletingClient.id}`);
      setDeleteDialogOpen(false);
      setDeletingClient(null);
      setSnackbarMessage('Client deleted.');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
      await fetchClients();
    } catch (err) {
      setSnackbarMessage(err instanceof ApiError ? err.message : 'Failed to delete client.');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 2, sm: 4 } }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="h3" sx={{ fontWeight: 600 }}>
          Clients
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate} size="small">
          New Client
        </Button>
      </Box>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Manage your studio clients.
      </Typography>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress size={28} />
        </Box>
      ) : fetchError ? (
        <Alert severity="error" sx={{ borderRadius: 2 }}>
          {fetchError}
        </Alert>
      ) : clients.length === 0 ? (
        <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
          <CardContent sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              No clients yet. Create one to get started.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' },
            gap: 3,
          }}
        >
          {clients.map((client) => (
            <Card
              key={client.id}
              elevation={0}
              sx={{
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 3,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <CardContent sx={{ p: 3, flex: 1, display: 'flex', flexDirection: 'column' }}>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    mb: 1,
                  }}
                >
                  <Typography variant="h4" sx={{ fontWeight: 600, flex: 1, mr: 1 }}>
                    {client.name}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <Tooltip title="Edit">
                      <IconButton size="small" aria-label="Edit" onClick={() => openEdit(client)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton
                        size="small"
                        color="error"
                        aria-label="Delete"
                        onClick={() => {
                          setDeletingClient(client);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>
                {client.contact_name && (
                  <Typography variant="body2" color="text.secondary">
                    {client.contact_name}
                  </Typography>
                )}
                {client.contact_email && (
                  <Typography variant="body2" color="text.secondary">
                    {client.contact_email}
                  </Typography>
                )}
              </CardContent>
            </Card>
          ))}
        </Box>
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
          {editingClient ? 'Edit Client' : 'New Client'}
        </DialogTitle>
        <DialogContent>
          {errorMsg && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
              {errorMsg}
            </Alert>
          )}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
            <TextField
              label="Client Name"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              required
              fullWidth
              autoFocus
            />
            <TextField
              label="Contact Name"
              value={formContactName}
              onChange={(e) => setFormContactName(e.target.value)}
              fullWidth
            />
            <TextField
              label="Contact Email"
              type="email"
              value={formContactEmail}
              onChange={(e) => setFormContactEmail(e.target.value)}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setDialogOpen(false)} color="inherit" disabled={saving}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleSave} disabled={!formName.trim() || saving}>
            {saving ? 'Saving...' : editingClient ? 'Save Changes' : 'Create Client'}
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
        <DialogTitle sx={{ fontWeight: 600 }}>Delete Client</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete <strong>{deletingClient?.name}</strong>? Projects
            assigned to this client will become unassigned.
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
