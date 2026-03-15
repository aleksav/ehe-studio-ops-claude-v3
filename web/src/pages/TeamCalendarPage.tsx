import { useState, useEffect, useCallback, useMemo } from 'react';
import { Box, CircularProgress, IconButton, Typography } from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { api } from '../lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TeamMember {
  id: string;
  full_name: string;
  email: string;
  is_active: boolean;
}

interface PublicHoliday {
  id: string;
  date: string; // YYYY-MM-DD
  name: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getDayOfWeek(year: number, month: number, day: number): number {
  return new Date(year, month, day).getDay(); // 0 = Sun
}

function isWeekend(year: number, month: number, day: number): boolean {
  const dow = getDayOfWeek(year, month, day);
  return dow === 0 || dow === 6;
}

function formatDateKey(year: number, month: number, day: number): string {
  const m = String(month + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

// Colours
const COLOR_WORKDAY = '#C8E6C9'; // light green
const COLOR_WEEKEND = '#FFCDD2'; // light red
const COLOR_HOLIDAY = '#E53935'; // darker red

const NAME_COL_WIDTH = 150;
const DAY_COL_WIDTH = 32;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TeamCalendarPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [holidays, setHolidays] = useState<PublicHoliday[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [membersData, holidaysData] = await Promise.all([
        api.get<TeamMember[]>('/api/team-members'),
        api.get<PublicHoliday[]>(`/api/public-holidays?year=${year}`),
      ]);
      setMembers(membersData);
      setHolidays(holidaysData);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const activeMembers = useMemo(
    () => members.filter((m) => m.is_active).sort((a, b) => a.full_name.localeCompare(b.full_name)),
    [members],
  );

  const holidaySet = useMemo(() => {
    const set = new Set<string>();
    holidays.forEach((h) => set.add(h.date));
    return set;
  }, [holidays]);

  const holidayNameMap = useMemo(() => {
    const map = new Map<string, string>();
    holidays.forEach((h) => map.set(h.date, h.name));
    return map;
  }, [holidays]);

  const daysInMonth = getDaysInMonth(year, month);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const handlePrev = () => {
    if (month === 0) {
      setMonth(11);
      setYear(year - 1);
    } else {
      setMonth(month - 1);
    }
  };

  const handleNext = () => {
    if (month === 11) {
      setMonth(0);
      setYear(year + 1);
    } else {
      setMonth(month + 1);
    }
  };

  const getCellColor = (day: number): string => {
    const key = formatDateKey(year, month, day);
    if (holidaySet.has(key)) return COLOR_HOLIDAY;
    if (isWeekend(year, month, day)) return COLOR_WEEKEND;
    return COLOR_WORKDAY;
  };

  const getCellTooltip = (day: number): string | undefined => {
    const key = formatDateKey(year, month, day);
    return holidayNameMap.get(key);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 10 }}>
        <CircularProgress color="primary" />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 4 } }}>
      {/* Header */}
      <Typography variant="h3" sx={{ fontWeight: 600, mb: 1 }}>
        Team Calendar
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Monthly availability overview for all active team members.
      </Typography>

      {/* Navigation */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 1 }}>
        <IconButton onClick={handlePrev} size="small">
          <ChevronLeftIcon />
        </IconButton>
        <Typography variant="h6" sx={{ fontWeight: 600, minWidth: 180, textAlign: 'center' }}>
          {MONTH_NAMES[month]} {year}
        </Typography>
        <IconButton onClick={handleNext} size="small">
          <ChevronRightIcon />
        </IconButton>
      </Box>

      {/* Legend */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        {[
          { color: COLOR_WORKDAY, label: 'Workday' },
          { color: COLOR_WEEKEND, label: 'Weekend' },
          { color: COLOR_HOLIDAY, label: 'Public Holiday' },
        ].map(({ color, label }) => (
          <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box
              sx={{
                width: 14,
                height: 14,
                bgcolor: color,
                borderRadius: 0.5,
                border: '1px solid rgba(0,0,0,0.12)',
              }}
            />
            <Typography variant="caption">{label}</Typography>
          </Box>
        ))}
      </Box>

      {/* Grid */}
      <Box sx={{ overflowX: 'auto' }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: `${NAME_COL_WIDTH}px repeat(${daysInMonth}, ${DAY_COL_WIDTH}px)`,
            gap: 0,
            minWidth: NAME_COL_WIDTH + daysInMonth * DAY_COL_WIDTH,
          }}
        >
          {/* Header row */}
          <Box
            sx={{
              position: 'sticky',
              left: 0,
              zIndex: 2,
              bgcolor: 'background.default',
              borderBottom: '2px solid',
              borderColor: 'divider',
              display: 'flex',
              alignItems: 'flex-end',
              pb: 0.5,
              pl: 1,
            }}
          >
            <Typography variant="caption" fontWeight={600}>
              Team Member
            </Typography>
          </Box>
          {days.map((day) => (
            <Box
              key={day}
              sx={{
                borderBottom: '2px solid',
                borderColor: 'divider',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'flex-end',
                pb: 0.5,
              }}
            >
              <Typography
                variant="caption"
                sx={{ fontSize: 9, color: 'text.disabled', lineHeight: 1 }}
              >
                {DAY_LABELS[getDayOfWeek(year, month, day)]}
              </Typography>
              <Typography variant="caption" sx={{ fontSize: 11, fontWeight: 600, lineHeight: 1.2 }}>
                {day}
              </Typography>
            </Box>
          ))}

          {/* Data rows */}
          {activeMembers.map((member) => (
            <>
              {/* Name cell */}
              <Box
                key={`name-${member.id}`}
                sx={{
                  position: 'sticky',
                  left: 0,
                  zIndex: 1,
                  bgcolor: 'background.default',
                  display: 'flex',
                  alignItems: 'center',
                  pl: 1,
                  height: DAY_COL_WIDTH,
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  overflow: 'hidden',
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    fontSize: 11,
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: NAME_COL_WIDTH - 16,
                  }}
                >
                  {member.full_name}
                </Typography>
              </Box>

              {/* Day cells */}
              {days.map((day) => {
                const tooltip = getCellTooltip(day);
                return (
                  <Box
                    key={`${member.id}-${day}`}
                    title={tooltip}
                    sx={{
                      height: DAY_COL_WIDTH,
                      bgcolor: getCellColor(day),
                      borderBottom: '1px solid',
                      borderRight: '1px solid',
                      borderColor: 'rgba(0,0,0,0.08)',
                      cursor: tooltip ? 'help' : 'default',
                    }}
                  />
                );
              })}
            </>
          ))}
        </Box>
      </Box>
    </Box>
  );
}
