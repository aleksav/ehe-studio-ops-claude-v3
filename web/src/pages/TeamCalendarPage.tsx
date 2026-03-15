import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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

interface OfficeEvent {
  id: string;
  name: string;
  event_type: string;
  start_date: string;
  end_date: string;
  allow_time_entry: boolean;
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

/** Build a continuous array of DayEntry for 12 months: 6 before and 5 after the given month. */
function buildYearDays(centerYear: number, centerMonth: number): DayEntry[] {
  const entries: DayEntry[] = [];
  // Start 6 months before the center month
  let startMonth = centerMonth - 6;
  let startYear = centerYear;
  while (startMonth < 0) {
    startMonth += 12;
    startYear -= 1;
  }

  let y = startYear;
  let m = startMonth;
  for (let i = 0; i < 12; i++) {
    const days = getDaysInMonth(y, m);
    for (let d = 1; d <= days; d++) {
      entries.push({ year: y, month: m, day: d, dateKey: formatDateKey(y, m, d) });
    }
    m++;
    if (m > 11) {
      m = 0;
      y++;
    }
  }
  return entries;
}

/** Find the index of the first day of a given month in the entries array. */
function findMonthStartIndex(entries: DayEntry[], year: number, month: number): number {
  return entries.findIndex((e) => e.year === year && e.month === month);
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
// Office event colours — lighter = time entry allowed, darker = time entry blocked
const COLOR_OFFICE_CLOSED = '#EF5350'; // red (always blocked)
const COLOR_SOCIAL_BLOCKED = '#F9A825'; // dark yellow (blocked)
const COLOR_SOCIAL_ALLOWED = '#FFF176'; // light yellow (allowed)
const COLOR_IMPORTANT_BLOCKED = '#FB8C00'; // dark orange (blocked)
const COLOR_IMPORTANT_ALLOWED = '#FFCC80'; // light orange (allowed)

const NAME_COL_WIDTH = 150;
const DAY_COL_WIDTH = 32;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TeamCalendarPage() {
  const today = new Date();
  const centerYear = today.getFullYear();
  const centerMonth = today.getMonth();

  // The displayed month/year in the nav header — updated on scroll
  const [visibleMonth, setVisibleMonth] = useState(centerMonth);
  const [visibleYear, setVisibleYear] = useState(centerYear);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const hasScrolledToToday = useRef(false);

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [holidays, setHolidays] = useState<PublicHoliday[]>([]);
  const [officeEvents, setOfficeEvents] = useState<OfficeEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // Build the full year strip once (centered on current month)
  const dayEntries = useMemo(
    () => buildYearDays(centerYear, centerMonth),
    [centerYear, centerMonth],
  );
  const totalDays = dayEntries.length;

  // Determine which years are covered to fetch holidays/events
  const yearsToFetch = useMemo(() => {
    const s = new Set<number>();
    dayEntries.forEach((e) => s.add(e.year));
    return Array.from(s);
  }, [dayEntries]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const holidayPromises = yearsToFetch.map((y) =>
        api.get<PublicHoliday[]>(`/api/public-holidays?year=${y}`),
      );
      const officeEventPromises = yearsToFetch.map((y) =>
        api.get<OfficeEvent[]>(`/api/office-events?year=${y}`),
      );
      const [membersData, ...rest] = await Promise.all([
        api.get<TeamMember[]>('/api/team-members'),
        ...holidayPromises,
        ...officeEventPromises,
      ]);
      const holidayArrays = rest.slice(0, yearsToFetch.length) as PublicHoliday[][];
      const officeEventArrays = rest.slice(yearsToFetch.length) as OfficeEvent[][];
      setMembers(membersData);
      setHolidays(holidayArrays.flat());
      setOfficeEvents(officeEventArrays.flat());
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [yearsToFetch]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Scroll to the current month once data loads
  useEffect(() => {
    if (!loading && !hasScrolledToToday.current) {
      hasScrolledToToday.current = true;
      requestAnimationFrame(() => {
        const container = scrollContainerRef.current;
        if (!container) return;
        const idx = findMonthStartIndex(dayEntries, centerYear, centerMonth);
        if (idx >= 0) {
          container.scrollLeft = idx * DAY_COL_WIDTH;
        }
      });
    }
  }, [loading, dayEntries, centerYear, centerMonth]);

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

  // Build office event date map: dateKey → { event_type, allow_time_entry, name }
  const officeEventDateMap = useMemo(() => {
    const map = new Map<string, { event_type: string; allow_time_entry: boolean; name: string }>();
    officeEvents.forEach((ev) => {
      const start = ev.start_date.substring(0, 10);
      const end = ev.end_date.substring(0, 10);
      const startDate = new Date(start + 'T00:00:00');
      const endDate = new Date(end + 'T00:00:00');
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        map.set(`${d.getFullYear()}-${m}-${dd}`, {
          event_type: ev.event_type,
          allow_time_entry: ev.allow_time_entry,
          name: ev.name,
        });
      }
    });
    return map;
  }, [officeEvents]);

  // --- Wheel → horizontal scroll ---
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        container.scrollLeft += e.deltaY;
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [loading]);

  // --- Scroll → detect visible month ---
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const scrollLeft = container.scrollLeft;
      const dayIndex = Math.min(Math.floor(scrollLeft / DAY_COL_WIDTH), dayEntries.length - 1);
      const idx = Math.max(0, dayIndex);
      const entry = dayEntries[idx];
      if (entry) {
        setVisibleMonth(entry.month);
        setVisibleYear(entry.year);
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [dayEntries, loading]);

  const scrollToMonth = (targetYear: number, targetMonth: number) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const idx = findMonthStartIndex(dayEntries, targetYear, targetMonth);
    if (idx >= 0) {
      container.scrollTo({ left: idx * DAY_COL_WIDTH, behavior: 'smooth' });
    }
  };

  const handlePrev = () => {
    const prevMonth = visibleMonth === 0 ? 11 : visibleMonth - 1;
    const prevYear = visibleMonth === 0 ? visibleYear - 1 : visibleYear;
    scrollToMonth(prevYear, prevMonth);
  };

  const handleNext = () => {
    const nextMonthVal = visibleMonth === 11 ? 0 : visibleMonth + 1;
    const nextYearVal = visibleMonth === 11 ? visibleYear + 1 : visibleYear;
    scrollToMonth(nextYearVal, nextMonthVal);
  };

  const getCellColor = (entry: DayEntry): string => {
    if (holidaySet.has(entry.dateKey)) return COLOR_HOLIDAY;
    const ev = officeEventDateMap.get(entry.dateKey);
    if (ev) {
      if (ev.event_type === 'OFFICE_CLOSED') return COLOR_OFFICE_CLOSED;
      if (ev.event_type === 'TEAM_SOCIAL')
        return ev.allow_time_entry ? COLOR_SOCIAL_ALLOWED : COLOR_SOCIAL_BLOCKED;
      if (ev.event_type === 'IMPORTANT_EVENT')
        return ev.allow_time_entry ? COLOR_IMPORTANT_ALLOWED : COLOR_IMPORTANT_BLOCKED;
    }
    if (isWeekend(entry.year, entry.month, entry.day)) return COLOR_WEEKEND;
    return COLOR_WORKDAY;
  };

  const getCellTooltip = (entry: DayEntry): string | undefined => {
    return holidayNameMap.get(entry.dateKey) ?? officeEventDateMap.get(entry.dateKey)?.name;
  };

  const hasEventMarker = (entry: DayEntry): boolean => {
    const ev = officeEventDateMap.get(entry.dateKey);
    return !!ev && ev.event_type !== 'OFFICE_CLOSED';
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
          {MONTH_NAMES[visibleMonth]} {visibleYear}
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
          { color: COLOR_OFFICE_CLOSED, label: 'Office Closed' },
          { color: COLOR_SOCIAL_ALLOWED, label: 'Team Social' },
          { color: COLOR_IMPORTANT_ALLOWED, label: 'Important Event' },
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
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              bgcolor: '#1E6FE9',
            }}
          />
          <Typography variant="caption">Event</Typography>
        </Box>
      </Box>

      {/* Grid */}
      <Box
        ref={scrollContainerRef}
        data-testid="calendar-scroll-container"
        sx={{
          overflowX: 'auto',
          overflowY: 'hidden',
          position: 'relative',
          maxWidth: '100%',
          cursor: 'ew-resize',
          '&::-webkit-scrollbar': { height: 8 },
          '&::-webkit-scrollbar-thumb': {
            bgcolor: 'rgba(0,0,0,0.2)',
            borderRadius: 4,
          },
        }}
      >
        <Box
          component="table"
          sx={{
            borderCollapse: 'collapse',
            width: NAME_COL_WIDTH + totalDays * DAY_COL_WIDTH,
            tableLayout: 'fixed',
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
                        position: 'relative',
                      }}
                    >
                      {hasEventMarker(entry) && (
                        <Box
                          sx={{
                            position: 'absolute',
                            top: 2,
                            right: 2,
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            bgcolor: '#1E6FE9',
                          }}
                        />
                      )}
                    </Box>
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
