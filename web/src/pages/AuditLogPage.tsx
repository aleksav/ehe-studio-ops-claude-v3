import React, { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Chip,
  Collapse,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Pagination,
  Select,
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
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { api } from '../lib/api';

interface AuditLogActor {
  id: string;
  full_name: string;
  email: string;
}

interface AuditLogEntry {
  id: string;
  entity_type: string;
  entity_id: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  actor_id: string | null;
  actor: AuditLogActor | null;
  changed_fields: Record<string, unknown> | null;
  created_at: string;
}

interface AuditLogResponse {
  data: AuditLogEntry[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
}

const ACTION_COLORS: Record<string, 'success' | 'warning' | 'error'> = {
  CREATE: 'success',
  UPDATE: 'warning',
  DELETE: 'error',
};

const ENTITY_TYPES = [
  'Client',
  'Milestone',
  'Project',
  'Task',
  'TaskAssignment',
  'TaskRate',
  'TeamMember',
  'TimeEntry',
  'User',
];
const ACTIONS = ['CREATE', 'UPDATE', 'DELETE'];

export default function AuditLogPage({ embedded = false }: { embedded?: boolean }) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [pagination, setPagination] = useState({ page: 1, per_page: 25, total: 0, total_pages: 0 });
  const [loading, setLoading] = useState(true);

  // Filters
  const [entityType, setEntityType] = useState('');
  const [action, setAction] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Expanded rows
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const fetchLogs = useCallback(
    async (page: number) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set('page', String(page));
        params.set('per_page', '25');
        if (entityType) params.set('entity_type', entityType);
        if (action) params.set('action', action);
        if (dateFrom) params.set('date_from', dateFrom);
        if (dateTo) params.set('date_to', dateTo);

        const result = await api.get<AuditLogResponse>(`/api/audit-logs?${params.toString()}`);
        setLogs(result.data);
        setPagination(result.pagination);
      } catch (err) {
        console.error('Failed to fetch audit logs:', err);
      } finally {
        setLoading(false);
      }
    },
    [entityType, action, dateFrom, dateTo],
  );

  useEffect(() => {
    fetchLogs(1);
  }, [fetchLogs]);

  const handlePageChange = (_: React.ChangeEvent<unknown>, page: number) => {
    fetchLogs(page);
  };

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <Box sx={embedded ? undefined : { p: { xs: 2, sm: 4 } }}>
      {!embedded && (
        <Typography
          variant="h5"
          sx={{ fontFamily: '"DM Sans", sans-serif', fontWeight: 700, mb: 3 }}
        >
          Audit Log
        </Typography>
      )}

      {/* Filter bar */}
      <Box
        sx={{
          display: 'flex',
          gap: 2,
          mb: 3,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Entity Type</InputLabel>
          <Select
            value={entityType}
            label="Entity Type"
            onChange={(e) => setEntityType(e.target.value)}
          >
            <MenuItem value="">All</MenuItem>
            {ENTITY_TYPES.map((t) => (
              <MenuItem key={t} value={t}>
                {t}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 130 }}>
          <InputLabel>Action</InputLabel>
          <Select value={action} label="Action" onChange={(e) => setAction(e.target.value)}>
            <MenuItem value="">All</MenuItem>
            {ACTIONS.map((a) => (
              <MenuItem key={a} value={a}>
                {a}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <TextField
          size="small"
          label="From"
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={{ width: 160 }}
        />

        <TextField
          size="small"
          label="To"
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={{ width: 160 }}
        />
      </Box>

      {/* Table */}
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell width={40} />
              <TableCell>Timestamp</TableCell>
              <TableCell>Action</TableCell>
              <TableCell>Entity Type</TableCell>
              <TableCell>Entity ID</TableCell>
              <TableCell>Actor</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">Loading...</Typography>
                </TableCell>
              </TableRow>
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">No audit logs found.</Typography>
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => {
                const isExpanded = expandedRows.has(log.id);
                return (
                  <React.Fragment key={log.id}>
                    <TableRow hover>
                      <TableCell>
                        {log.changed_fields && (
                          <IconButton size="small" onClick={() => toggleRow(log.id)}>
                            {isExpanded ? (
                              <ExpandLessIcon fontSize="small" />
                            ) : (
                              <ExpandMoreIcon fontSize="small" />
                            )}
                          </IconButton>
                        )}
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        {new Date(log.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={log.action}
                          color={ACTION_COLORS[log.action] ?? 'default'}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>{log.entity_type}</TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>
                        {log.entity_id}
                      </TableCell>
                      <TableCell>
                        {log.actor ? (
                          <Tooltip title={log.actor.email} arrow>
                            <span>{log.actor.full_name}</span>
                          </Tooltip>
                        ) : (
                          '--'
                        )}
                      </TableCell>
                    </TableRow>
                    {log.changed_fields && (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          sx={{ py: 0, borderBottom: isExpanded ? undefined : 'none' }}
                        >
                          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                            <Box
                              sx={{
                                my: 1,
                                p: 2,
                                bgcolor: 'grey.50',
                                borderRadius: 1,
                                border: '1px solid',
                                borderColor: 'divider',
                              }}
                            >
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                display="block"
                                mb={1}
                              >
                                Changed Fields
                              </Typography>
                              <Box
                                component="pre"
                                sx={{
                                  m: 0,
                                  fontSize: 12,
                                  fontFamily: 'monospace',
                                  whiteSpace: 'pre-wrap',
                                  wordBreak: 'break-word',
                                }}
                              >
                                {JSON.stringify(log.changed_fields, null, 2)}
                              </Box>
                            </Box>
                          </Collapse>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination */}
      {pagination.total_pages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <Pagination
            count={pagination.total_pages}
            page={pagination.page}
            onChange={handlePageChange}
            color="primary"
          />
        </Box>
      )}

      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ mt: 1, display: 'block', textAlign: 'center' }}
      >
        {pagination.total} total entries
      </Typography>
    </Box>
  );
}
