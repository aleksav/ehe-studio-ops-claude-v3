import { useState, useEffect, useCallback } from 'react';
import {
  Alert,
  Avatar,
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
  InputLabel,
  MenuItem,
  Select,
  Snackbar,
  TextField,
  Typography,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import PersonOffIcon from '@mui/icons-material/PersonOff';
import PersonIcon from '@mui/icons-material/Person';
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

interface MemberFormData {
  full_name: string;
  email: string;
  preferred_task_type: string;
}

const EMPTY_FORM: MemberFormData = {
  full_name: '',
  email: '',
  preferred_task_type: '',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TASK_TYPES = [
  'ARCHITECTURE_ENGINEERING_DIRECTION',
  'DESIGN_DELIVERY_RESEARCH',
  'DEVELOPMENT_TESTING',
  'BUSINESS_SUPPORT',
] as const;

const TASK_TYPE_LABELS: Record<string, string> = {
  ARCHITECTURE_ENGINEERING_DIRECTION: 'Architecture & Engineering Direction',
  DESIGN_DELIVERY_RESEARCH: 'Design, Delivery & Research',
  DEVELOPMENT_TESTING: 'Development & Testing',
  BUSINESS_SUPPORT: 'Business Support',
};

function formatTaskType(value: string | null): string | null {
  if (!value) return null;
  return TASK_TYPE_LABELS[value] ?? value;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [form, setForm] = useState<MemberFormData>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  // Snackbar state
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');

  // ---- Fetch members ----
  const fetchMembers = useCallback(async () => {
    try {
      const data = await api.get<TeamMember[]>('/api/team-members');
      setMembers(data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  // ---- Snackbar helper ----
  const showSnackbar = (message: string, severity: 'success' | 'error' = 'success') => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  };

  // ---- Open dialog for create ----
  const handleOpenCreate = () => {
    setEditingMember(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  // ---- Open dialog for edit ----
  const handleOpenEdit = (member: TeamMember) => {
    setEditingMember(member);
    setForm({
      full_name: member.full_name,
      email: member.email,
      preferred_task_type: member.preferred_task_type ?? '',
    });
    setDialogOpen(true);
  };

  // ---- Close dialog ----
  const handleCloseDialog = () => {
    if (submitting) return;
    setDialogOpen(false);
    setEditingMember(null);
  };

  // ---- Submit create/edit ----
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim() || !form.email.trim() || submitting) return;

    setSubmitting(true);

    const payload: Record<string, unknown> = {
      full_name: form.full_name.trim(),
      email: form.email.trim(),
      preferred_task_type: form.preferred_task_type || null,
    };

    try {
      if (editingMember) {
        await api.put(`/api/team-members/${editingMember.id}`, payload);
        showSnackbar('Team member updated successfully.');
      } else {
        await api.post('/api/team-members', payload);
        showSnackbar('Team member added successfully.');
      }
      setDialogOpen(false);
      setEditingMember(null);
      await fetchMembers();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
      showSnackbar(message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ---- Toggle active/inactive ----
  const handleToggleActive = async (member: TeamMember) => {
    try {
      await api.put(`/api/team-members/${member.id}`, {
        is_active: !member.is_active,
      });
      showSnackbar(
        member.is_active
          ? `"${member.full_name}" deactivated.`
          : `"${member.full_name}" activated.`,
      );
      await fetchMembers();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
      showSnackbar(message, 'error');
    }
  };

  return (
    <Box sx={{ p: { xs: 2, sm: 4 } }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          mb: 1,
        }}
      >
        <Typography variant="h3" sx={{ fontWeight: 600 }}>
          Team
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenCreate}>
          Add Team Member
        </Button>
      </Box>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Studio team members.
      </Typography>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress size={28} />
        </Box>
      ) : members.length === 0 ? (
        <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
          <CardContent sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              No team members found.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: '1fr 1fr',
              md: '1fr 1fr 1fr',
            },
            gap: 3,
          }}
        >
          {members.map((member) => (
            <Card
              key={member.id}
              elevation={0}
              sx={{
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 3,
              }}
            >
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                  <Avatar
                    sx={{
                      bgcolor: 'primary.main',
                      width: 44,
                      height: 44,
                      fontSize: 16,
                      fontWeight: 600,
                    }}
                  >
                    {getInitials(member.full_name)}
                  </Avatar>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                      {member.full_name}
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {member.email}
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  <Chip
                    label={member.is_active ? 'Active' : 'Inactive'}
                    size="small"
                    color={member.is_active ? 'success' : 'default'}
                    sx={{ fontSize: 11, height: 22 }}
                  />
                  {formatTaskType(member.preferred_task_type) && (
                    <Chip
                      label={formatTaskType(member.preferred_task_type)}
                      size="small"
                      variant="outlined"
                      sx={{ fontSize: 11, height: 22 }}
                    />
                  )}
                </Box>

                {/* Action buttons */}
                <Box sx={{ display: 'flex', gap: 1, mt: 2, pt: 1 }}>
                  <Button
                    size="small"
                    startIcon={<EditIcon />}
                    onClick={() => handleOpenEdit(member)}
                  >
                    Edit
                  </Button>
                  <Button
                    size="small"
                    color={member.is_active ? 'warning' : 'success'}
                    startIcon={member.is_active ? <PersonOffIcon /> : <PersonIcon />}
                    onClick={() => handleToggleActive(member)}
                  >
                    {member.is_active ? 'Deactivate' : 'Activate'}
                  </Button>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      {/* Create / Edit Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 600, pb: 1 }}>
          {editingMember ? 'Edit Team Member' : 'Add Team Member'}
        </DialogTitle>
        <Box component="form" onSubmit={handleSubmit}>
          <DialogContent sx={{ pt: 1 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <TextField
                label="Full Name"
                value={form.full_name}
                onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                required
                fullWidth
                autoFocus
              />
              <TextField
                label="Email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                required
                fullWidth
              />
              <FormControl fullWidth>
                <InputLabel id="member-task-type-label">Preferred Task Type</InputLabel>
                <Select
                  labelId="member-task-type-label"
                  value={form.preferred_task_type}
                  label="Preferred Task Type"
                  onChange={(e: SelectChangeEvent) =>
                    setForm((f) => ({ ...f, preferred_task_type: e.target.value }))
                  }
                >
                  <MenuItem value="">
                    <em>None</em>
                  </MenuItem>
                  {TASK_TYPES.map((t) => (
                    <MenuItem key={t} value={t}>
                      {TASK_TYPE_LABELS[t]}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5 }}>
            <Button onClick={handleCloseDialog} color="inherit" disabled={submitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={!form.full_name.trim() || !form.email.trim() || submitting}
              endIcon={submitting ? <CircularProgress size={18} color="inherit" /> : undefined}
              sx={{ px: 3 }}
            >
              {submitting ? 'Saving...' : editingMember ? 'Save Changes' : 'Add Member'}
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
