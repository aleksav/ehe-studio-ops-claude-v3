import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  CircularProgress,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { colors } from '@ehestudio-ops/shared';
import { api } from '../lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ByTaskType {
  task_type: string;
  hours: number;
  cost: number;
}

interface ByTeamMember {
  team_member_id: string;
  name: string;
  hours: number;
  cost: number;
}

interface ByMonth {
  month: string;
  hours: number;
  cost: number;
}

interface ProjectStats {
  total_hours: number;
  total_cost: number;
  currency_code: string;
  by_task_type: ByTaskType[];
  by_team_member: ByTeamMember[];
  by_month: ByMonth[];
}

interface ProjectDashboardTabProps {
  projectId: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TASK_TYPE_LABEL: Record<string, string> = {
  ARCHITECTURE_ENGINEERING_DIRECTION: 'Architecture & Engineering',
  DESIGN_DELIVERY_RESEARCH: 'Design & Research',
  DEVELOPMENT_TESTING: 'Development & Testing',
  BUSINESS_SUPPORT: 'Business Support',
};

function formatTaskType(value: string): string {
  return TASK_TYPE_LABEL[value] ?? value;
}

function formatCurrency(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ProjectDashboardTab({ projectId }: ProjectDashboardTabProps) {
  const [stats, setStats] = useState<ProjectStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterMode, setFilterMode] = useState<'month' | 'range'>('month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set('start_date', startDate);
      if (endDate) params.set('end_date', endDate);
      const qs = params.toString();
      const url = `/api/projects/${projectId}/stats${qs ? `?${qs}` : ''}`;
      const data = await api.get<ProjectStats>(url);
      setStats(data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [projectId, startDate, endDate]);

  useEffect(() => {
    void fetchStats();
  }, [fetchStats]);

  if (loading && !stats) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  if (!stats) return null;

  return (
    <Box>
      {/* Filter */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <ToggleButtonGroup
          value={filterMode}
          exclusive
          onChange={(_, v) => {
            if (v) {
              setFilterMode(v);
              setStartDate('');
              setEndDate('');
            }
          }}
          size="small"
        >
          <ToggleButton value="month">Month</ToggleButton>
          <ToggleButton value="range">Date Range</ToggleButton>
        </ToggleButtonGroup>
        {filterMode === 'month' ? (
          <TextField
            label="Month"
            type="month"
            size="small"
            value={startDate ? startDate.slice(0, 7) : ''}
            onChange={(e) => {
              const val = e.target.value;
              if (!val) {
                setStartDate('');
                setEndDate('');
                return;
              }
              const [y, m] = val.split('-').map(Number);
              const lastDay = new Date(y, m, 0).getDate();
              setStartDate(`${val}-01`);
              setEndDate(`${val}-${String(lastDay).padStart(2, '0')}`);
            }}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: 160 }}
          />
        ) : (
          <>
            <TextField
              label="Start Date"
              type="date"
              size="small"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 160 }}
            />
            <TextField
              label="End Date"
              type="date"
              size="small"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 160 }}
            />
          </>
        )}
      </Box>

      {loading && <LinearProgress sx={{ mb: 1 }} />}

      {/* Totals */}
      <Card
        elevation={0}
        sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, mb: 2 }}
      >
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Typography variant="body1" sx={{ fontWeight: 600, mb: 1.5 }}>
            Overview
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(2, 1fr)' },
              gap: 2,
            }}
          >
            <Box>
              <Typography variant="body2" color="text.secondary">
                Total Hours
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 700, color: colors.primary }}>
                {stats.total_hours.toFixed(1)}
              </Typography>
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary">
                Total Cost
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 700, color: colors.secondary }}>
                {formatCurrency(stats.total_cost, stats.currency_code)}
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* By Task Type */}
      {stats.by_task_type.length > 0 && (
        <Card
          elevation={0}
          sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, mb: 2 }}
        >
          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
            <Typography variant="body1" sx={{ fontWeight: 600, mb: 1 }}>
              By Task Type
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Task Type</TableCell>
                    <TableCell align="right">Hours</TableCell>
                    <TableCell align="right">Cost</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {stats.by_task_type.map((row) => (
                    <TableRow key={row.task_type}>
                      <TableCell>{formatTaskType(row.task_type)}</TableCell>
                      <TableCell align="right">{row.hours.toFixed(1)}</TableCell>
                      <TableCell align="right">
                        {formatCurrency(row.cost, stats.currency_code)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* By Team Member */}
      {stats.by_team_member.length > 0 && (
        <Card
          elevation={0}
          sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, mb: 2 }}
        >
          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
            <Typography variant="body1" sx={{ fontWeight: 600, mb: 1 }}>
              By Team Member
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Member</TableCell>
                    <TableCell align="right">Hours</TableCell>
                    <TableCell align="right">Cost</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {stats.by_team_member.map((row) => (
                    <TableRow key={row.team_member_id}>
                      <TableCell>{row.name}</TableCell>
                      <TableCell align="right">{row.hours.toFixed(1)}</TableCell>
                      <TableCell align="right">
                        {formatCurrency(row.cost, stats.currency_code)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* By Month */}
      {stats.by_month.length > 0 && (
        <Card
          elevation={0}
          sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, mb: 2 }}
        >
          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
            <Typography variant="body1" sx={{ fontWeight: 600, mb: 1 }}>
              By Month
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Month</TableCell>
                    <TableCell align="right">Hours</TableCell>
                    <TableCell align="right">Cost</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {stats.by_month.map((row) => (
                    <TableRow key={row.month}>
                      <TableCell>{row.month}</TableCell>
                      <TableCell align="right">{row.hours.toFixed(1)}</TableCell>
                      <TableCell align="right">
                        {formatCurrency(row.cost, stats.currency_code)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
