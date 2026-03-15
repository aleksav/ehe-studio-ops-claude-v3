import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '@ehestudio-ops/shared';
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

interface OfficeEvent {
  id: string;
  name: string;
  event_type: string;
  start_date: string;
  end_date: string;
  allow_time_entry: boolean;
}

interface PublicHoliday {
  id: string;
  date: string;
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
  return new Date(year, month, day).getDay();
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

const COLOR_WORKDAY = '#C8E6C9';
const COLOR_WEEKEND = '#FFCDD2';
const COLOR_HOLIDAY = '#E53935';
const COLOR_OFFICE_CLOSED = '#78909C';

const NAME_COL_WIDTH = 100;
const DAY_COL_WIDTH = 28;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TeamCalendarScreen() {
  const today = new Date();
  const centerYear = today.getFullYear();
  const centerMonth = today.getMonth();

  const [visibleMonth, setVisibleMonth] = useState(centerMonth);
  const [visibleYear, setVisibleYear] = useState(centerYear);

  const scrollViewRef = useRef<ScrollView>(null);
  const hasScrolledToToday = useRef(false);

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [holidays, setHolidays] = useState<PublicHoliday[]>([]);
  const [officeEvents, setOfficeEvents] = useState<OfficeEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const dayEntries = useMemo(
    () => buildYearDays(centerYear, centerMonth),
    [centerYear, centerMonth],
  );

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

  // Scroll to current month once data loads
  useEffect(() => {
    if (!loading && !hasScrolledToToday.current) {
      hasScrolledToToday.current = true;
      const idx = findMonthStartIndex(dayEntries, centerYear, centerMonth);
      if (idx >= 0) {
        setTimeout(() => {
          scrollViewRef.current?.scrollTo({ x: idx * DAY_COL_WIDTH, animated: false });
        }, 100);
      }
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

  const officeClosedDates = useMemo(() => {
    const set = new Set<string>();
    officeEvents
      .filter((ev) => ev.event_type === 'OFFICE_CLOSED')
      .forEach((ev) => {
        const start = ev.start_date.substring(0, 10);
        const end = ev.end_date.substring(0, 10);
        const startDate = new Date(start + 'T00:00:00');
        const endDate = new Date(end + 'T00:00:00');
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const dd = String(d.getDate()).padStart(2, '0');
          set.add(`${d.getFullYear()}-${m}-${dd}`);
        }
      });
    return set;
  }, [officeEvents]);

  const officeEventMarkerDates = useMemo(() => {
    const set = new Set<string>();
    officeEvents
      .filter((ev) => ev.event_type === 'TEAM_SOCIAL' || ev.event_type === 'IMPORTANT_EVENT')
      .forEach((ev) => {
        const start = ev.start_date.substring(0, 10);
        const end = ev.end_date.substring(0, 10);
        const startDate = new Date(start + 'T00:00:00');
        const endDate = new Date(end + 'T00:00:00');
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const dd = String(d.getDate()).padStart(2, '0');
          set.add(`${d.getFullYear()}-${m}-${dd}`);
        }
      });
    return set;
  }, [officeEvents]);

  const monthSpans = useMemo(() => {
    const spans: { label: string; startIndex: number; count: number }[] = [];
    let currentLabel = '';
    let start = 0;
    let count = 0;
    dayEntries.forEach((entry, i) => {
      const label = `${MONTH_NAMES[entry.month].slice(0, 3)} ${entry.year}`;
      if (label !== currentLabel) {
        if (count > 0) {
          spans.push({ label: currentLabel, startIndex: start, count });
        }
        currentLabel = label;
        start = i;
        count = 1;
      } else {
        count++;
      }
    });
    if (count > 0) {
      spans.push({ label: currentLabel, startIndex: start, count });
    }
    return spans;
  }, [dayEntries]);

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const scrollX = e.nativeEvent.contentOffset.x;
      const dayIndex = Math.max(
        0,
        Math.min(Math.floor(scrollX / DAY_COL_WIDTH), dayEntries.length - 1),
      );
      const entry = dayEntries[dayIndex];
      if (entry) {
        setVisibleMonth(entry.month);
        setVisibleYear(entry.year);
      }
    },
    [dayEntries],
  );

  const scrollToMonth = (targetYear: number, targetMonth: number) => {
    const idx = findMonthStartIndex(dayEntries, targetYear, targetMonth);
    if (idx >= 0) {
      scrollViewRef.current?.scrollTo({ x: idx * DAY_COL_WIDTH, animated: true });
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
    if (officeClosedDates.has(entry.dateKey)) return COLOR_OFFICE_CLOSED;
    if (isWeekend(entry.year, entry.month, entry.day)) return COLOR_WEEKEND;
    return COLOR_WORKDAY;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Navigation */}
      <View style={styles.navRow}>
        <TouchableOpacity
          onPress={handlePrev}
          style={styles.navButton}
          accessibilityLabel="Previous month"
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>
          {MONTH_NAMES[visibleMonth]} {visibleYear}
        </Text>
        <TouchableOpacity
          onPress={handleNext}
          style={styles.navButton}
          accessibilityLabel="Next month"
        >
          <Ionicons name="chevron-forward" size={22} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Legend */}
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, { backgroundColor: COLOR_WORKDAY }]} />
          <Text style={styles.legendLabel}>Workday</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, { backgroundColor: COLOR_WEEKEND }]} />
          <Text style={styles.legendLabel}>Weekend</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, { backgroundColor: COLOR_HOLIDAY }]} />
          <Text style={styles.legendLabel}>Holiday</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, { backgroundColor: COLOR_OFFICE_CLOSED }]} />
          <Text style={styles.legendLabel}>Office Closed</Text>
        </View>
      </View>

      {/* Grid */}
      <View style={styles.gridContainer}>
        {/* Sticky name column */}
        <View style={styles.stickyNameColumn}>
          <View style={styles.monthLabelPlaceholder} />
          <View style={styles.nameHeaderCell}>
            <Text style={styles.headerText}>Name</Text>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            {activeMembers.map((member) => (
              <View key={member.id} style={styles.nameCell}>
                <Text style={styles.nameText} numberOfLines={1}>
                  {member.full_name}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* Scrollable day columns */}
        <ScrollView
          ref={scrollViewRef}
          horizontal
          showsHorizontalScrollIndicator
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          <View>
            {/* Month label row */}
            <View style={styles.monthLabelRow}>
              {monthSpans.map((span) => (
                <View
                  key={`${span.label}-${span.startIndex}`}
                  style={[
                    styles.monthLabelCell,
                    {
                      width: span.count * DAY_COL_WIDTH,
                      borderLeftWidth: span.startIndex > 0 ? 2 : 0,
                    },
                  ]}
                >
                  <Text style={styles.monthLabelText}>{span.label}</Text>
                </View>
              ))}
            </View>

            {/* Day number header row */}
            <View style={styles.headerRow}>
              {dayEntries.map((entry, i) => {
                const isMonthBoundary = i > 0 && dayEntries[i - 1].month !== entry.month;
                return (
                  <View
                    key={`hdr-${entry.dateKey}`}
                    style={[
                      styles.dayHeaderCell,
                      isMonthBoundary ? styles.monthBoundaryLeft : null,
                    ]}
                  >
                    <Text style={styles.dayOfWeekText}>
                      {DAY_LABELS[getDayOfWeek(entry.year, entry.month, entry.day)]}
                    </Text>
                    <Text style={styles.dayNumberText}>{entry.day}</Text>
                  </View>
                );
              })}
            </View>

            {/* Data rows */}
            <ScrollView showsVerticalScrollIndicator={false}>
              {activeMembers.map((member) => (
                <View key={member.id} style={styles.dataRow}>
                  {dayEntries.map((entry, i) => {
                    const isMonthBoundary = i > 0 && dayEntries[i - 1].month !== entry.month;
                    return (
                      <View
                        key={`${member.id}-${entry.dateKey}`}
                        style={[
                          styles.dayCell,
                          { backgroundColor: getCellColor(entry) },
                          isMonthBoundary ? styles.monthBoundaryLeft : null,
                        ]}
                      >
                        {officeEventMarkerDates.has(entry.dateKey) && (
                          <View style={styles.eventMarker} />
                        )}
                      </View>
                    );
                  })}
                </View>
              ))}
            </ScrollView>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  navButton: {
    padding: spacing.xs,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navTitle: {
    fontSize: typography.sizes.h3,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    minWidth: 160,
    textAlign: 'center',
  },
  legendRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendSwatch: {
    width: 12,
    height: 12,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.12)',
  },
  legendLabel: {
    fontSize: 11,
    color: '#666',
  },
  gridContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  stickyNameColumn: {
    width: NAME_COL_WIDTH,
    backgroundColor: '#FAFAFA',
    zIndex: 2,
  },
  monthLabelPlaceholder: {
    height: 20,
  },
  nameHeaderCell: {
    width: NAME_COL_WIDTH,
    height: 32,
    justifyContent: 'flex-end',
    paddingBottom: 4,
    paddingLeft: spacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: colors.divider,
  },
  headerText: {
    fontSize: 11,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  monthLabelRow: {
    flexDirection: 'row',
    height: 20,
  },
  monthLabelCell: {
    justifyContent: 'center',
    paddingLeft: 4,
    borderLeftColor: colors.divider,
  },
  monthLabelText: {
    fontSize: 10,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  headerRow: {
    flexDirection: 'row',
    borderBottomWidth: 2,
    borderBottomColor: colors.divider,
  },
  dayHeaderCell: {
    width: DAY_COL_WIDTH,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 4,
  },
  dayOfWeekText: {
    fontSize: 8,
    color: '#666',
  },
  dayNumberText: {
    fontSize: 10,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  dataRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.08)',
  },
  nameCell: {
    width: NAME_COL_WIDTH,
    height: DAY_COL_WIDTH,
    justifyContent: 'center',
    paddingLeft: spacing.sm,
    backgroundColor: '#FAFAFA',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.08)',
  },
  nameText: {
    fontSize: 10,
    fontWeight: typography.weights.medium,
    color: colors.text,
  },
  dayCell: {
    width: DAY_COL_WIDTH,
    height: DAY_COL_WIDTH,
    borderRightWidth: 1,
    borderRightColor: 'rgba(0,0,0,0.06)',
  },
  monthBoundaryLeft: {
    borderLeftWidth: 2,
    borderLeftColor: colors.divider,
  },
  eventMarker: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#1E6FE9',
  },
});
