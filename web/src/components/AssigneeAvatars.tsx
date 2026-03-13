import { useState, useEffect } from 'react';
import {
  Avatar,
  AvatarGroup,
  Box,
  Checkbox,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Popover,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { api } from '../lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TeamMemberRef {
  id: string;
  full_name: string;
  email: string;
}

export interface Assignment {
  id: string;
  team_member_id: string;
  team_member: TeamMemberRef;
}

interface AssigneeAvatarsProps {
  taskId: string;
  assignments: Assignment[];
  onAssignmentsChange: (taskId: string, assignments: Assignment[]) => void;
}

interface TeamMember {
  id: string;
  full_name: string;
  email: string;
  is_active: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const AVATAR_PALETTE = [
  '#1976D2',
  '#388E3C',
  '#D32F2F',
  '#7B1FA2',
  '#F57C00',
  '#0288D1',
  '#C2185B',
  '#00796B',
  '#5D4037',
  '#455A64',
];

function hashName(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

function getAvatarColor(name: string): string {
  return AVATAR_PALETTE[hashName(name) % AVATAR_PALETTE.length];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AssigneeAvatars({
  taskId,
  assignments,
  onAssignmentsChange,
}: AssigneeAvatarsProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(false);

  const open = Boolean(anchorEl);

  const handleOpen = (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    setAnchorEl(e.currentTarget);
  };

  const handleClose = (e: React.MouseEvent | object) => {
    if ('stopPropagation' in e && typeof (e as React.MouseEvent).stopPropagation === 'function') {
      (e as React.MouseEvent).stopPropagation();
    }
    setAnchorEl(null);
  };

  // Fetch team members when popover opens
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    api
      .get<TeamMember[]>('/api/team-members?is_active=true')
      .then((data) => {
        if (!cancelled) setTeamMembers(data);
      })
      .catch(() => {
        // silently fail
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const assignedIds = new Set(assignments.map((a) => a.team_member_id));

  const handleToggle = async (member: TeamMember, e: React.MouseEvent) => {
    e.stopPropagation();
    const isAssigned = assignedIds.has(member.id);

    if (isAssigned) {
      // Unassign
      try {
        await api.delete(`/api/tasks/${taskId}/assignments/${member.id}`);
        const updated = assignments.filter((a) => a.team_member_id !== member.id);
        onAssignmentsChange(taskId, updated);
      } catch {
        // silently fail
      }
    } else {
      // Assign
      try {
        const result = await api.post<Assignment>(`/api/tasks/${taskId}/assignments`, {
          team_member_id: member.id,
        });
        const newAssignment: Assignment = {
          id: result.id,
          team_member_id: member.id,
          team_member: { id: member.id, full_name: member.full_name, email: member.email },
        };
        onAssignmentsChange(taskId, [...assignments, newAssignment]);
      } catch {
        // silently fail
      }
    }
  };

  return (
    <Box
      sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
      onClick={(e) => e.stopPropagation()}
    >
      {assignments.length > 0 && (
        <AvatarGroup
          max={3}
          sx={{
            '& .MuiAvatar-root': {
              width: 24,
              height: 24,
              fontSize: 11,
              fontWeight: 600,
              border: '2px solid #fff',
            },
          }}
        >
          {assignments.map((a) => (
            <Tooltip key={a.team_member_id} title={a.team_member.full_name}>
              <Avatar sx={{ bgcolor: getAvatarColor(a.team_member.full_name) }}>
                {getInitials(a.team_member.full_name)}
              </Avatar>
            </Tooltip>
          ))}
        </AvatarGroup>
      )}

      <Tooltip title="Assign team member">
        <IconButton
          size="small"
          onClick={handleOpen}
          sx={{
            width: 24,
            height: 24,
            border: '1px dashed',
            borderColor: 'divider',
            '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
          }}
        >
          <AddIcon sx={{ fontSize: 14 }} />
        </IconButton>
      </Tooltip>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        onClick={(e) => e.stopPropagation()}
      >
        <Box sx={{ minWidth: 240, maxHeight: 320, overflow: 'auto' }}>
          <Typography variant="subtitle2" sx={{ px: 2, pt: 1.5, pb: 0.5, fontWeight: 600 }}>
            Assign Members
          </Typography>
          {loading ? (
            <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 2 }}>
              Loading...
            </Typography>
          ) : teamMembers.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 2 }}>
              No active team members
            </Typography>
          ) : (
            <List dense disablePadding>
              {teamMembers.map((member) => {
                const checked = assignedIds.has(member.id);
                return (
                  <ListItem key={member.id} disablePadding>
                    <ListItemButton onClick={(e) => handleToggle(member, e)} dense>
                      <ListItemIcon sx={{ minWidth: 36 }}>
                        <Checkbox
                          edge="start"
                          checked={checked}
                          disableRipple
                          size="small"
                          onClick={(e) => e.stopPropagation()}
                          onChange={() => {}}
                          tabIndex={-1}
                        />
                      </ListItemIcon>
                      <ListItemText
                        primary={member.full_name}
                        primaryTypographyProps={{ variant: 'body2' }}
                      />
                    </ListItemButton>
                  </ListItem>
                );
              })}
            </List>
          )}
        </Box>
      </Popover>
    </Box>
  );
}
