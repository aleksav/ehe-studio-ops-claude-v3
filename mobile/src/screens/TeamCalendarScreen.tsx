import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
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

function nextMonth(year: number, month: number): { year: number; month: number } {
  return month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 };
}

function buildTwoMonthDays(year: number, month: number): DayEntry[] {
  const entries: DayEntry[] = [];

  const days1 = getDaysInMonth(year, month);
  for (let d = 1; d <= days1; d++) {
    entries.push({ year, month, day: d, dateKey: formatDateKey(year, month, d) });
  }

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

const COLOR_WORKDAY = '#C8E6C9';
const COLOR_WEEKEND = '#FFCDD2';
const COLOR_HOLIDAY = '#E53935';

const NAME_COL_WIDTH = 100;
const DAY_COL_WIDTH = 28;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TeamCalendarScreen() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [holidays, setHolidays] = useState<PublicHoliday[]>([]);
  const [loading, setLoading] = useState(true);

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

  const dayEntries = useMemo(() => buildTwoMonthDays(year, month), [year, month]);

  // Compute month boundary indices for labels
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
          {MONTH_NAMES[month]} {year}
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
      </View>

      {/* Grid: sticky name column on left + horizontally scrollable day columns */}
      <View style={styles.gridContainer}>
        {/* Sticky name column */}
        <View style={styles.stickyNameColumn}>
          {/* Empty cell for month label row */}
          <View style={styles.monthLabelPlaceholder} />
          {/* Empty cell for day header row */}
          <View style={styles.nameHeaderCell}>
            <Text style={styles.headerText}>Name</Text>
          </View>
          {/* Member name cells */}
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
        <ScrollView horizontal showsHorizontalScrollIndicator>
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
                      />
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
});
