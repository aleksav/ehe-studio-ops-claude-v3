import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Box, CircularProgress, IconButton, Typography } from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { api } from '../lib/api';
import CalendarGrid from '../components/CalendarGrid';
import {
  type TeamMember,
  type PublicHoliday,
  type OfficeEvent,
  type OfficeEventInfo,
  MONTH_NAMES,
  COLOR_WORKDAY,
  COLOR_WEEKEND,
  COLOR_HOLIDAY,
  COLOR_OFFICE_CLOSED,
  COLOR_SOCIAL_ALLOWED,
  COLOR_IMPORTANT_ALLOWED,
  DAY_COL_WIDTH,
  buildMonthRange,
  normaliseYearMonth,
  findMonthStartIndex,
} from './teamCalendarUtils';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TeamCalendarPage() {
  const today = new Date();
  const centerYear = today.getFullYear();
  const centerMonth = today.getMonth();

  const [visibleMonth, setVisibleMonth] = useState(centerMonth);
  const [visibleYear, setVisibleYear] = useState(centerYear);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const hasScrolledToToday = useRef(false);

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [holidays, setHolidays] = useState<PublicHoliday[]>([]);
  const [officeEvents, setOfficeEvents] = useState<OfficeEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // Dynamic month range state for infinite scroll
  const [rangeStartYear, rangeStartMonth] = useMemo(
    () => normaliseYearMonth(centerYear, centerMonth - 6),
    [centerYear, centerMonth],
  );
  const [startYear, setStartYear] = useState(rangeStartYear);
  const [startMonth, setStartMonth] = useState(rangeStartMonth);
  const [monthCount, setMonthCount] = useState(12);

  const fetchedYearsRef = useRef<Set<number>>(new Set());

  // Drag-to-scroll state
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, scrollLeft: 0 });

  const dayEntries = useMemo(
    () => buildMonthRange(startYear, startMonth, monthCount),
    [startYear, startMonth, monthCount],
  );

  const yearsToFetch = useMemo(() => {
    const s = new Set<number>();
    dayEntries.forEach((e) => s.add(e.year));
    return Array.from(s);
  }, [dayEntries]);

  const fetchYearsData = useCallback(async (years: number[]) => {
    const newYears = years.filter((y) => !fetchedYearsRef.current.has(y));
    if (newYears.length === 0) return;
    try {
      const hPromises = newYears.map((y) =>
        api.get<PublicHoliday[]>(`/api/public-holidays?year=${y}`),
      );
      const ePromises = newYears.map((y) => api.get<OfficeEvent[]>(`/api/office-events?year=${y}`));
      const results = await Promise.all([...hPromises, ...ePromises]);
      const hArrays = results.slice(0, newYears.length) as PublicHoliday[][];
      const eArrays = results.slice(newYears.length) as OfficeEvent[][];
      newYears.forEach((y) => fetchedYearsRef.current.add(y));
      setHolidays((prev) => [...prev, ...hArrays.flat()]);
      setOfficeEvents((prev) => [...prev, ...eArrays.flat()]);
    } catch {
      // silently fail
    }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const hPromises = yearsToFetch.map((y) =>
        api.get<PublicHoliday[]>(`/api/public-holidays?year=${y}`),
      );
      const ePromises = yearsToFetch.map((y) =>
        api.get<OfficeEvent[]>(`/api/office-events?year=${y}`),
      );
      const [membersData, ...rest] = await Promise.all([
        api.get<TeamMember[]>('/api/team-members'),
        ...hPromises,
        ...ePromises,
      ]);
      const hArrays = rest.slice(0, yearsToFetch.length) as PublicHoliday[][];
      const eArrays = rest.slice(yearsToFetch.length) as OfficeEvent[][];
      setMembers(membersData);
      setHolidays(hArrays.flat());
      setOfficeEvents(eArrays.flat());
      yearsToFetch.forEach((y) => fetchedYearsRef.current.add(y));
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
        if (idx >= 0) container.scrollLeft = idx * DAY_COL_WIDTH;
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

  const officeEventDateMap = useMemo(() => {
    const map = new Map<string, OfficeEventInfo>();
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

  // --- Wheel -> horizontal scroll ---
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

  // --- Drag-to-scroll ---
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const onMouseDown = (e: MouseEvent) => {
      if (e.offsetY > container.clientHeight) return;
      setIsDragging(true);
      dragStartRef.current = { x: e.pageX, scrollLeft: container.scrollLeft };
      e.preventDefault();
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      container.scrollLeft = dragStartRef.current.scrollLeft - (e.pageX - dragStartRef.current.x);
    };
    const onMouseUp = () => {
      if (isDragging) setIsDragging(false);
    };
    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      container.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isDragging, loading]);

  // --- Scroll -> detect visible month + infinite scroll ---
  const isExpandingRef = useRef(false);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const handleScroll = () => {
      const sl = container.scrollLeft;
      const idx = Math.max(0, Math.min(Math.floor(sl / DAY_COL_WIDTH), dayEntries.length - 1));
      const entry = dayEntries[idx];
      if (entry) {
        setVisibleMonth(entry.month);
        setVisibleYear(entry.year);
      }
      // Prepend months when near the start
      if (sl < 200 && !isExpandingRef.current) {
        isExpandingRef.current = true;
        const [newStartY, newStartM] = normaliseYearMonth(startYear, startMonth - 6);
        const prepended = buildMonthRange(newStartY, newStartM, 6);
        const addedWidth = prepended.length * DAY_COL_WIDTH;
        setStartYear(newStartY);
        setStartMonth(newStartM);
        setMonthCount((prev) => prev + 6);
        const newYears = new Set<number>();
        prepended.forEach((e) => newYears.add(e.year));
        fetchYearsData(Array.from(newYears));
        requestAnimationFrame(() => {
          container.scrollLeft += addedWidth;
          isExpandingRef.current = false;
        });
      }
      // Append months when near the end
      const maxScroll = container.scrollWidth - container.clientWidth;
      if (maxScroll - sl < 200 && !isExpandingRef.current) {
        isExpandingRef.current = true;
        const [endY, endM] = normaliseYearMonth(startYear, startMonth + monthCount);
        const appended = buildMonthRange(endY, endM, 6);
        setMonthCount((prev) => prev + 6);
        const newYears = new Set<number>();
        appended.forEach((e) => newYears.add(e.year));
        fetchYearsData(Array.from(newYears));
        requestAnimationFrame(() => {
          isExpandingRef.current = false;
        });
      }
    };
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [dayEntries, loading, startYear, startMonth, monthCount, fetchYearsData]);

  const scrollToMonth = (targetYear: number, targetMonth: number) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const idx = findMonthStartIndex(dayEntries, targetYear, targetMonth);
    if (idx >= 0) container.scrollTo({ left: idx * DAY_COL_WIDTH, behavior: 'smooth' });
  };

  const handlePrev = () => {
    const pm = visibleMonth === 0 ? 11 : visibleMonth - 1;
    const py = visibleMonth === 0 ? visibleYear - 1 : visibleYear;
    scrollToMonth(py, pm);
  };

  const handleNext = () => {
    const nm = visibleMonth === 11 ? 0 : visibleMonth + 1;
    const ny = visibleMonth === 11 ? visibleYear + 1 : visibleYear;
    scrollToMonth(ny, nm);
  };

  const monthSpans = useMemo(() => {
    const spans: { label: string; colStart: number; colSpan: number }[] = [];
    let currentLabel = '';
    let start = 0;
    let count = 0;
    dayEntries.forEach((entry, i) => {
      const label = `${MONTH_NAMES[entry.month]} ${entry.year}`;
      if (label !== currentLabel) {
        if (count > 0) spans.push({ label: currentLabel, colStart: start, colSpan: count });
        currentLabel = label;
        start = i;
        count = 1;
      } else {
        count++;
      }
    });
    if (count > 0) spans.push({ label: currentLabel, colStart: start, colSpan: count });
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
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#1E6FE9' }} />
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
          cursor: isDragging ? 'grabbing' : 'grab',
          userSelect: isDragging ? 'none' : 'auto',
          '&::-webkit-scrollbar': { height: 8 },
          '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(0,0,0,0.2)', borderRadius: 4 },
        }}
      >
        <CalendarGrid
          dayEntries={dayEntries}
          activeMembers={activeMembers}
          holidaySet={holidaySet}
          holidayNameMap={holidayNameMap}
          officeEventDateMap={officeEventDateMap}
          monthSpans={monthSpans}
        />
      </Box>
    </Box>
  );
}
