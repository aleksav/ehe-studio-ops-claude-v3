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
        <TouchableOpacity onPress={handlePrev} style={styles.navButton}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>
          {MONTH_NAMES[month]} {year}
        </Text>
        <TouchableOpacity onPress={handleNext} style={styles.navButton}>
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

      {/* Grid */}
      <ScrollView horizontal showsHorizontalScrollIndicator>
        <View>
          {/* Header row */}
          <View style={styles.headerRow}>
            <View style={styles.nameHeaderCell}>
              <Text style={styles.headerText}>Name</Text>
            </View>
            {days.map((day) => (
              <View key={day} style={styles.dayHeaderCell}>
                <Text style={styles.dayOfWeekText}>
                  {DAY_LABELS[getDayOfWeek(year, month, day)]}
                </Text>
                <Text style={styles.dayNumberText}>{day}</Text>
              </View>
            ))}
          </View>

          {/* Data rows */}
          <ScrollView showsVerticalScrollIndicator>
            {activeMembers.map((member) => (
              <View key={member.id} style={styles.dataRow}>
                <View style={styles.nameCell}>
                  <Text style={styles.nameText} numberOfLines={1}>
                    {member.full_name}
                  </Text>
                </View>
                {days.map((day) => (
                  <View
                    key={day}
                    style={[styles.dayCell, { backgroundColor: getCellColor(day) }]}
                  />
                ))}
              </View>
            ))}
          </ScrollView>
        </View>
      </ScrollView>
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
  headerRow: {
    flexDirection: 'row',
    borderBottomWidth: 2,
    borderBottomColor: colors.divider,
  },
  nameHeaderCell: {
    width: NAME_COL_WIDTH,
    justifyContent: 'flex-end',
    paddingBottom: 4,
    paddingLeft: spacing.sm,
  },
  headerText: {
    fontSize: 11,
    fontWeight: typography.weights.semibold,
    color: colors.text,
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
});
