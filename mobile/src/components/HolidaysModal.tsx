import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography } from '@ehestudio-ops/shared';
import { api, ApiError } from '../lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PlannedHoliday {
  id: string;
  team_member_id: string;
  date: string;
  day_type: 'FULL' | 'AM' | 'PM';
  notes: string | null;
}

interface HolidayAllowance {
  total: number;
  used: number;
  remaining: number;
}

interface PublicHoliday {
  id: string;
  date: string;
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

const DAY_TYPE_LABELS: Record<string, string> = {
  FULL: 'Full day',
  AM: 'Half day (AM)',
  PM: 'Half day (PM)',
};

const DAY_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'FULL', label: 'Full day' },
  { value: 'AM', label: 'Half day (AM)' },
  { value: 'PM', label: 'Half day (PM)' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr: string): string {
  const d = new Date(dateStr.substring(0, 10) + 'T00:00:00');
  return d.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function todayKey(): string {
  return formatDateKey(new Date());
}

function getBlockedOfficeDays(events: OfficeEvent[]): Set<string> {
  const blocked = new Set<string>();
  for (const event of events) {
    if (!event.allow_time_entry) {
      const start = new Date(event.start_date.substring(0, 10) + 'T00:00:00');
      const end = new Date(event.end_date.substring(0, 10) + 'T00:00:00');
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        blocked.add(formatDateKey(d));
      }
    }
  }
  return blocked;
}

interface ExclusionSummary {
  weekends: number;
  publicHolidays: number;
  officeBlocked: number;
  alreadyBooked: number;
}

function getEligibleDays(
  startDate: string,
  endDate: string,
  publicHolidays: Set<string>,
  blockedOfficeDays: Set<string>,
  existingHolidays: Set<string>,
): { eligible: string[]; exclusions: ExclusionSummary } {
  const days: string[] = [];
  const exclusions: ExclusionSummary = {
    weekends: 0,
    publicHolidays: 0,
    officeBlocked: 0,
    alreadyBooked: 0,
  };
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dow = d.getDay();
    if (dow === 0 || dow === 6) {
      exclusions.weekends++;
      continue;
    }
    const key = formatDateKey(d);
    if (publicHolidays.has(key)) {
      exclusions.publicHolidays++;
      continue;
    }
    if (blockedOfficeDays.has(key)) {
      exclusions.officeBlocked++;
      continue;
    }
    if (existingHolidays.has(key)) {
      exclusions.alreadyBooked++;
      continue;
    }
    days.push(key);
  }
  return { eligible: days, exclusions };
}

function buildExclusionText(exclusions: ExclusionSummary): string {
  const parts: string[] = [];
  if (exclusions.weekends > 0) {
    parts.push(`${exclusions.weekends} weekend${exclusions.weekends > 1 ? 's' : ''}`);
  }
  if (exclusions.publicHolidays > 0) {
    parts.push(
      `${exclusions.publicHolidays} public holiday${exclusions.publicHolidays > 1 ? 's' : ''}`,
    );
  }
  if (exclusions.officeBlocked > 0) {
    parts.push(
      `${exclusions.officeBlocked} office closed day${exclusions.officeBlocked > 1 ? 's' : ''}`,
    );
  }
  if (exclusions.alreadyBooked > 0) {
    parts.push(
      `${exclusions.alreadyBooked} already booked day${exclusions.alreadyBooked > 1 ? 's' : ''}`,
    );
  }
  if (parts.length === 0) return '';
  return parts.join(', ') + ' excluded';
}

const isValidDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface HolidaysModalProps {
  visible: boolean;
  onClose: () => void;
  teamMemberId: string;
  /** Called after holidays are added/removed so the parent can refresh leaveDates */
  onHolidaysChanged?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function HolidaysModal({
  visible,
  onClose,
  teamMemberId,
  onHolidaysChanged,
}: HolidaysModalProps) {
  const [holidays, setHolidays] = useState<PlannedHoliday[]>([]);
  const [allowance, setAllowance] = useState<HolidayAllowance | null>(null);
  const [loading, setLoading] = useState(true);

  // Add form state
  const [formVisible, setFormVisible] = useState(false);
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formDayType, setFormDayType] = useState('FULL');
  const [formNotes, setFormNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Exclusion data
  const [publicHolidaysList, setPublicHolidaysList] = useState<PublicHoliday[]>([]);
  const [officeEventsList, setOfficeEventsList] = useState<OfficeEvent[]>([]);

  const year = new Date().getFullYear();
  const today = todayKey();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [h, a, ph, oe] = await Promise.all([
        api.get<PlannedHoliday[]>(`/api/team-members/${teamMemberId}/holidays?year=${year}`),
        api.get<HolidayAllowance>(
          `/api/team-members/${teamMemberId}/holiday-allowance?year=${year}`,
        ),
        api.get<PublicHoliday[]>(`/api/public-holidays?year=${year}`),
        api.get<OfficeEvent[]>(`/api/office-events?year=${year}`),
      ]);
      setHolidays(h);
      setAllowance(a);
      setPublicHolidaysList(ph);
      setOfficeEventsList(oe);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [teamMemberId, year]);

  useEffect(() => {
    if (visible) fetchData();
  }, [visible, fetchData]);

  const publicHolidayDates = useMemo(
    () => new Set(publicHolidaysList.map((ph) => ph.date.substring(0, 10))),
    [publicHolidaysList],
  );

  const blockedOfficeDays = useMemo(
    () => getBlockedOfficeDays(officeEventsList),
    [officeEventsList],
  );

  const existingHolidayDates = useMemo(
    () => new Set(holidays.map((h) => h.date.substring(0, 10))),
    [holidays],
  );

  const rangePreview = useMemo(() => {
    if (!isValidDate(formStartDate) || !isValidDate(formEndDate)) return null;
    if (formStartDate > formEndDate) return null;
    return getEligibleDays(
      formStartDate,
      formEndDate,
      publicHolidayDates,
      blockedOfficeDays,
      existingHolidayDates,
    );
  }, [formStartDate, formEndDate, publicHolidayDates, blockedOfficeDays, existingHolidayDates]);

  const handleOpenAdd = () => {
    setFormStartDate('');
    setFormEndDate('');
    setFormDayType('FULL');
    setFormNotes('');
    setFormVisible(true);
  };

  const handleStartDateChange = (value: string) => {
    setFormStartDate(value);
    if (isValidDate(value) && (!isValidDate(formEndDate) || formEndDate < value)) {
      setFormEndDate(value);
    }
  };

  const handleSubmit = async () => {
    if (!formStartDate || submitting) return;
    if (!isValidDate(formStartDate)) {
      Alert.alert('Error', 'Start date must be in YYYY-MM-DD format');
      return;
    }
    if (!isValidDate(formEndDate)) {
      Alert.alert('Error', 'End date must be in YYYY-MM-DD format');
      return;
    }
    if (formStartDate > formEndDate) {
      Alert.alert('Error', 'End date must be on or after start date');
      return;
    }

    setSubmitting(true);
    try {
      const { eligible } = getEligibleDays(
        formStartDate,
        formEndDate,
        publicHolidayDates,
        blockedOfficeDays,
        existingHolidayDates,
      );

      if (eligible.length === 0) {
        Alert.alert('Error', 'No eligible working days in the selected range.');
        setSubmitting(false);
        return;
      }

      const results = await Promise.allSettled(
        eligible.map((date) =>
          api.post(`/api/team-members/${teamMemberId}/holidays`, {
            date,
            day_type: formDayType,
            notes: formNotes || undefined,
          }),
        ),
      );

      const failed = results.filter((r) => r.status === 'rejected').length;
      if (failed > 0) {
        Alert.alert(
          'Partial Success',
          `${eligible.length - failed} holidays added, ${failed} failed.`,
        );
      } else {
        Alert.alert(
          'Success',
          `${eligible.length} holiday${eligible.length > 1 ? 's' : ''} added.`,
        );
      }
      setFormVisible(false);
      await fetchData();
      onHolidaysChanged?.();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Something went wrong.';
      Alert.alert('Error', message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (holiday: PlannedHoliday) => {
    Alert.alert('Delete Holiday', `Remove ${formatDate(holiday.date)}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/api/team-members/${teamMemberId}/holidays/${holiday.id}`);
            await fetchData();
            onHolidaysChanged?.();
          } catch (err) {
            const message = err instanceof ApiError ? err.message : 'Something went wrong.';
            Alert.alert('Error', message);
          }
        },
      },
    ]);
  };

  const canSubmit =
    isValidDate(formStartDate) &&
    isValidDate(formEndDate) &&
    formStartDate <= formEndDate &&
    rangePreview !== null &&
    rangePreview.eligible.length > 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>My Holidays</Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator
              size="large"
              color={colors.primary}
              style={{ marginVertical: spacing.lg }}
            />
          ) : (
            <ScrollView style={{ flex: 1 }}>
              {/* Allowance bar */}
              {allowance && (
                <View style={styles.allowanceCard}>
                  <View style={styles.allowanceRow}>
                    <Text style={styles.allowanceLabel}>{year} Allowance</Text>
                    <Text style={styles.allowanceValue}>
                      {allowance.used} / {allowance.total} used
                    </Text>
                  </View>
                  <View style={styles.progressBarBg}>
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          width: `${Math.min((allowance.used / allowance.total) * 100, 100)}%`,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.remainingText}>{allowance.remaining} days remaining</Text>
                </View>
              )}

              {/* Add button */}
              <TouchableOpacity style={styles.addButton} onPress={handleOpenAdd}>
                <Ionicons name="add" size={18} color={colors.primary} />
                <Text style={styles.addButtonText}>Add Holiday</Text>
              </TouchableOpacity>

              {/* Holiday list */}
              {holidays.length === 0 ? (
                <Text style={styles.emptyText}>No holidays planned for {year}.</Text>
              ) : (
                holidays.map((holiday) => {
                  const isFuture = holiday.date.substring(0, 10) >= today;
                  return (
                    <View key={holiday.id} style={styles.holidayCard}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.holidayDate}>{formatDate(holiday.date)}</Text>
                        <Text style={styles.holidayType}>
                          {DAY_TYPE_LABELS[holiday.day_type]}
                          {holiday.notes ? ` — ${holiday.notes}` : ''}
                        </Text>
                      </View>
                      {isFuture && (
                        <TouchableOpacity
                          onPress={() => handleDelete(holiday)}
                          style={styles.iconButton}
                          accessibilityLabel="Delete holiday"
                        >
                          <Ionicons name="trash" size={18} color="#DC2626" />
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })
              )}
            </ScrollView>
          )}

          {/* Add Holiday form modal */}
          <Modal
            visible={formVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setFormVisible(false)}
          >
            <View style={styles.overlay}>
              <View style={styles.formContent}>
                <Text style={styles.title}>Add Holiday</Text>

                <Text style={styles.fieldLabel}>Start Date (YYYY-MM-DD)</Text>
                <TextInput
                  style={styles.input}
                  value={formStartDate}
                  onChangeText={handleStartDateChange}
                  placeholder="2026-03-20"
                  autoFocus
                />
                <Text style={styles.fieldLabel}>End Date (YYYY-MM-DD)</Text>
                <TextInput
                  style={styles.input}
                  value={formEndDate}
                  onChangeText={setFormEndDate}
                  placeholder="2026-03-25"
                />

                <Text style={styles.fieldLabel}>Day Type</Text>
                <View style={styles.dayTypeRow}>
                  {DAY_TYPE_OPTIONS.map((opt) => (
                    <TouchableOpacity
                      key={opt.value}
                      style={[
                        styles.dayTypeButton,
                        formDayType === opt.value && styles.dayTypeButtonActive,
                      ]}
                      onPress={() => setFormDayType(opt.value)}
                    >
                      <Text
                        style={[
                          styles.dayTypeButtonText,
                          formDayType === opt.value && styles.dayTypeButtonTextActive,
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.fieldLabel}>Notes (optional)</Text>
                <TextInput
                  style={[styles.input, { height: 60 }]}
                  value={formNotes}
                  onChangeText={setFormNotes}
                  placeholder="Optional notes"
                  multiline
                />

                {/* Range preview */}
                {isValidDate(formStartDate) &&
                  isValidDate(formEndDate) &&
                  formStartDate <= formEndDate && (
                    <View style={styles.previewBox}>
                      {rangePreview && rangePreview.eligible.length > 0 ? (
                        <>
                          <Text style={styles.previewText}>
                            {rangePreview.eligible.length} working day
                            {rangePreview.eligible.length > 1 ? 's' : ''} will be booked
                          </Text>
                          {buildExclusionText(rangePreview.exclusions) !== '' && (
                            <Text style={styles.previewExclusion}>
                              {buildExclusionText(rangePreview.exclusions)}
                            </Text>
                          )}
                        </>
                      ) : rangePreview && rangePreview.eligible.length === 0 ? (
                        <>
                          <Text style={styles.previewWarning}>
                            No eligible working days in the selected range.
                          </Text>
                          {buildExclusionText(rangePreview.exclusions) !== '' && (
                            <Text style={styles.previewExclusion}>
                              {buildExclusionText(rangePreview.exclusions)}
                            </Text>
                          )}
                        </>
                      ) : null}
                    </View>
                  )}

                {isValidDate(formStartDate) &&
                  isValidDate(formEndDate) &&
                  formStartDate > formEndDate && (
                    <View style={styles.previewBox}>
                      <Text style={styles.previewWarning}>
                        End date must be on or after start date.
                      </Text>
                    </View>
                  )}

                <View style={styles.formActions}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => setFormVisible(false)}
                    disabled={submitting}
                  >
                    <Text style={styles.cancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.submitButton, (!canSubmit || submitting) && { opacity: 0.5 }]}
                    onPress={handleSubmit}
                    disabled={!canSubmit || submitting}
                  >
                    {submitting ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.submitText}>
                        {rangePreview && rangePreview.eligible.length > 1
                          ? `Add ${rangePreview.eligible.length} Days`
                          : 'Add'}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        </View>
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  content: {
    backgroundColor: '#fff',
    borderRadius: borderRadius.card,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 440,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: typography.sizes.body1,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    flex: 1,
  },
  closeButton: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  allowanceCard: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  allowanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  allowanceLabel: {
    fontSize: typography.sizes.body2,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  allowanceValue: {
    fontSize: typography.sizes.caption,
    color: '#666',
  },
  progressBarBg: {
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressBarFill: {
    height: 8,
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  remainingText: {
    fontSize: 11,
    color: '#999',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
    minHeight: 44,
  },
  addButtonText: {
    fontSize: typography.sizes.body2,
    fontWeight: typography.weights.semibold,
    color: colors.primary,
  },
  emptyText: {
    fontSize: typography.sizes.body2,
    color: '#999',
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  holidayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 8,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  holidayDate: {
    fontSize: typography.sizes.body2,
    fontWeight: typography.weights.medium,
    color: colors.text,
  },
  holidayType: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  iconButton: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  formContent: {
    backgroundColor: '#fff',
    borderRadius: borderRadius.card,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 400,
  },
  fieldLabel: {
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    marginBottom: 4,
    marginTop: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: typography.sizes.body1,
    color: colors.text,
  },
  dayTypeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  dayTypeButton: {
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.chip,
    borderWidth: 1,
    borderColor: colors.divider,
    minHeight: 44,
    justifyContent: 'center',
  },
  dayTypeButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dayTypeButtonText: {
    fontSize: typography.sizes.body2,
    color: colors.text,
  },
  dayTypeButtonTextActive: {
    color: '#fff',
    fontWeight: typography.weights.semibold,
  },
  previewBox: {
    backgroundColor: '#F0F4FF',
    borderRadius: 8,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  previewText: {
    fontSize: typography.sizes.body2,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  previewExclusion: {
    fontSize: typography.sizes.caption,
    color: '#666',
    marginTop: 2,
  },
  previewWarning: {
    fontSize: typography.sizes.body2,
    fontWeight: typography.weights.semibold,
    color: '#F59E0B',
  },
  formActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  cancelButton: {
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    minHeight: 44,
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: typography.sizes.body1,
    color: '#666',
    fontWeight: '600',
  },
  submitButton: {
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
    borderRadius: 8,
    backgroundColor: colors.primary,
    minHeight: 44,
    justifyContent: 'center',
  },
  submitText: {
    fontSize: typography.sizes.body1,
    color: '#fff',
    fontWeight: '600',
  },
});
