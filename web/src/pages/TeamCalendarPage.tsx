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

interface DayEntry {
  year: number;
  month: number; // 0-based
  day: number;
  dateKey: string;
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

/** Return the next month/year pair given a 0-based month. */
function nextMonth(year: number, month: number): { year: number; month: number } {
  return month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 };
}

/** Build a continuous array of DayEntry for two months starting at (year, month). */
function buildTwoMonthDays(year: number, month: number): DayEntry[] {
  const entries: DayEntry[] = [];

  // First month
  const days1 = getDaysInMonth(year, month);
  for (let d = 1; d <= days1; d++) {
    entries.push({ year, month, day: d, dateKey: formatDateKey(year, month, d) });
  }

  // Second month
  const nm = nextMonth(year, month);
  const days2 = getDaysInMonth(nm.year, nm.month);
  for (let d = 1; d <= days2; d++) {
    entries.push({
      year: nm.year,
      month: nm.month,
      day: d,
      dateKey: formatDateKey(nm.year, nm.month, d),
    });
  }

  return entries;
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

  // The second month may be in a different year, so fetch holidays for both.
  const nm = nextMonth(year, month);
  const yearsToFetch = useMemo(() => {
    const s = new Set<number>();
    s.add(year);
    s.add(nm.year);
    return Array.from(s);
  }, [year, nm.year]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const holidayPromises = yearsToFetch.map((y) =>
        api.get<PublicHoliday[]>(`/api/public-holidays?year=${y}`),
      );
      const [membersData, ...holidayArrays] = await Promise.all([
        api.get<TeamMember[]>('/api/team-members'),
        ...holidayPromises,
      ]);
      setMembers(membersData);
      setHolidays(holidayArrays.flat());
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [yearsToFetch]);

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

  // Build the continuous 2-month strip
  const dayEntries = useMemo(() => buildTwoMonthDays(year, month), [year, month]);
  const totalDays = dayEntries.length;

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

  const getCellColor = (entry: DayEntry): string => {
    if (holidaySet.has(entry.dateKey)) return COLOR_HOLIDAY;
    if (isWeekend(entry.year, entry.month, entry.day)) return COLOR_WEEKEND;
    return COLOR_WORKDAY;
  };

  const getCellTooltip = (entry: DayEntry): string | undefined => {
    return holidayNameMap.get(entry.dateKey);
  };

  // Compute month label spans for the top header row
  const monthSpans = useMemo(() => {
    const spans: { label: string; colStart: number; colSpan: number }[] = [];
    let currentLabel = '';
    let start = 0;
    let count = 0;
    dayEntries.forEach((entry, i) => {
      const label = `${MONTH_NAMES[entry.month]} ${entry.year}`;
      if (label !== currentLabel) {
        if (count > 0) {
          spans.push({ label: currentLabel, colStart: start, colSpan: count });
        }
        currentLabel = label;
        start = i;
        count = 1;
      } else {
        count++;
      }
    });
    if (count > 0) {
      spans.push({ label: currentLabel, colStart: start, colSpan: count });
    }
    return spans;
  }, [dayEntries]);

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
        <IconButton onClick={handlePrev} size="small" aria-label="Previous month">
          <ChevronLeftIcon />
        </IconButton>
        <Typography variant="h6" sx={{ fontWeight: 600, minWidth: 180, textAlign: 'center' }}>
          {MONTH_NAMES[month]} {year}
        </Typography>
        <IconButton onClick={handleNext} size="small" aria-label="Next month">
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
      <Box sx={{ overflowX: 'auto', position: 'relative' }}>
        <Box
          component="table"
          sx={{
            borderCollapse: 'collapse',
            minWidth: NAME_COL_WIDTH + totalDays * DAY_COL_WIDTH,
          }}
        >
          {/* Month label row */}
          <Box component="thead">
            <Box component="tr">
              <Box
                component="th"
                sx={{
                  position: 'sticky',
                  left: 0,
                  zIndex: 3,
                  bgcolor: 'background.default',
                  width: NAME_COL_WIDTH,
                  minWidth: NAME_COL_WIDTH,
                }}
              />
              {monthSpans.map((span) => (
                <Box
                  component="th"
                  key={`${span.label}-${span.colStart}`}
                  colSpan={span.colSpan}
                  sx={{
                    textAlign: 'left',
                    px: 0.5,
                    py: 0.5,
                    borderLeft: span.colStart > 0 ? '2px solid' : 'none',
                    borderColor: 'divider',
                    bgcolor: 'background.default',
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{ fontWeight: 700, fontSize: 11, whiteSpace: 'nowrap' }}
                  >
                    {span.label}
                  </Typography>
                </Box>
              ))}
            </Box>

            {/* Day number header row */}
            <Box component="tr">
              <Box
                component="th"
                sx={{
                  position: 'sticky',
                  left: 0,
                  zIndex: 3,
                  bgcolor: 'background.default',
                  borderBottom: '2px solid',
                  borderColor: 'divider',
                  width: NAME_COL_WIDTH,
                  minWidth: NAME_COL_WIDTH,
                  textAlign: 'left',
                  pl: 1,
                  pb: 0.5,
                  verticalAlign: 'bottom',
                }}
              >
                <Typography variant="caption" fontWeight={600}>
                  Team Member
                </Typography>
              </Box>
              {dayEntries.map((entry, i) => {
                const isMonthBoundary = i > 0 && dayEntries[i - 1].month !== entry.month;
                return (
                  <Box
                    component="th"
                    key={`hdr-${entry.dateKey}`}
                    sx={{
                      width: DAY_COL_WIDTH,
                      minWidth: DAY_COL_WIDTH,
                      borderBottom: '2px solid',
                      borderColor: 'divider',
                      borderLeft: isMonthBoundary ? '2px solid' : 'none',
                      textAlign: 'center',
                      verticalAlign: 'bottom',
                      pb: 0.5,
                      px: 0,
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{ fontSize: 9, color: 'text.disabled', lineHeight: 1, display: 'block' }}
                    >
                      {DAY_LABELS[getDayOfWeek(entry.year, entry.month, entry.day)]}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{ fontSize: 11, fontWeight: 600, lineHeight: 1.2, display: 'block' }}
                    >
                      {entry.day}
                    </Typography>
                  </Box>
                );
              })}
            </Box>
          </Box>

          {/* Data rows */}
          <Box component="tbody">
            {activeMembers.map((member) => (
              <Box component="tr" key={member.id}>
                {/* Name cell */}
                <Box
                  component="td"
                  sx={{
                    position: 'sticky',
                    left: 0,
                    zIndex: 1,
                    bgcolor: 'background.default',
                    pl: 1,
                    height: DAY_COL_WIDTH,
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    width: NAME_COL_WIDTH,
                    minWidth: NAME_COL_WIDTH,
                    overflow: 'hidden',
                    verticalAlign: 'middle',
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
                      display: 'block',
                      maxWidth: NAME_COL_WIDTH - 16,
                    }}
                  >
                    {member.full_name}
                  </Typography>
                </Box>

                {/* Day cells */}
                {dayEntries.map((entry, i) => {
                  const tooltip = getCellTooltip(entry);
                  const isMonthBoundary = i > 0 && dayEntries[i - 1].month !== entry.month;
                  return (
                    <Box
                      component="td"
                      key={`${member.id}-${entry.dateKey}`}
                      title={tooltip}
                      sx={{
                        height: DAY_COL_WIDTH,
                        width: DAY_COL_WIDTH,
                        minWidth: DAY_COL_WIDTH,
                        bgcolor: getCellColor(entry),
                        borderBottom: '1px solid',
                        borderRight: '1px solid',
                        borderLeft: isMonthBoundary ? '2px solid' : 'none',
                        borderColor: 'rgba(0,0,0,0.08)',
                        cursor: tooltip ? 'help' : 'default',
                        p: 0,
                      }}
                    />
                  );
                })}
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
