import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
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

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

interface Props {
  teamMemberId: string;
  memberName: string;
  visible: boolean;
  onClose: () => void;
}

export default function HolidayManagementModal({
  teamMemberId,
  memberName,
  visible,
  onClose,
}: Props) {
  const [holidays, setHolidays] = useState<PlannedHoliday[]>([]);
  const [allowance, setAllowance] = useState<HolidayAllowance | null>(null);
  const [loading, setLoading] = useState(true);

  // Add/Edit form state
  const [formVisible, setFormVisible] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<PlannedHoliday | null>(null);
  const [formDate, setFormDate] = useState('');
  const [formDayType, setFormDayType] = useState('FULL');
  const [formNotes, setFormNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const year = new Date().getFullYear();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [h, a] = await Promise.all([
        api.get<PlannedHoliday[]>(`/api/team-members/${teamMemberId}/holidays?year=${year}`),
        api.get<HolidayAllowance>(
          `/api/team-members/${teamMemberId}/holiday-allowance?year=${year}`,
        ),
      ]);
      setHolidays(h);
      setAllowance(a);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [teamMemberId, year]);

  useEffect(() => {
    if (visible) fetchData();
  }, [visible, fetchData]);

  const handleOpenCreate = () => {
    setEditingHoliday(null);
    setFormDate('');
    setFormDayType('FULL');
    setFormNotes('');
    setFormVisible(true);
  };

  const handleOpenEdit = (holiday: PlannedHoliday) => {
    setEditingHoliday(holiday);
    setFormDate(holiday.date.substring(0, 10));
    setFormDayType(holiday.day_type);
    setFormNotes(holiday.notes ?? '');
    setFormVisible(true);
  };

  const handleSubmit = async () => {
    if (!formDate || submitting) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(formDate)) {
      Alert.alert('Error', 'Date must be in YYYY-MM-DD format');
      return;
    }

    setSubmitting(true);
    const payload = {
      date: formDate,
      day_type: formDayType,
      notes: formNotes || undefined,
    };

    try {
      if (editingHoliday) {
        await api.put(`/api/team-members/${teamMemberId}/holidays/${editingHoliday.id}`, payload);
        Alert.alert('Success', 'Holiday updated.');
      } else {
        await api.post(`/api/team-members/${teamMemberId}/holidays`, payload);
        Alert.alert('Success', 'Holiday added.');
      }
      setFormVisible(false);
      setEditingHoliday(null);
      await fetchData();
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
          } catch (err) {
            const message = err instanceof ApiError ? err.message : 'Something went wrong.';
            Alert.alert('Error', message);
          }
        },
      },
    ]);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Holidays — {memberName}</Text>
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
              <TouchableOpacity style={styles.addButton} onPress={handleOpenCreate}>
                <Ionicons name="add" size={18} color={colors.primary} />
                <Text style={styles.addButtonText}>Add Holiday</Text>
              </TouchableOpacity>

              {/* Holiday list */}
              {holidays.length === 0 ? (
                <Text style={styles.emptyText}>No holidays planned for {year}.</Text>
              ) : (
                holidays.map((holiday) => (
                  <View key={holiday.id} style={styles.holidayCard}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.holidayDate}>{formatDate(holiday.date)}</Text>
                      <Text style={styles.holidayType}>
                        {DAY_TYPE_LABELS[holiday.day_type]}
                        {holiday.notes ? ` — ${holiday.notes}` : ''}
                      </Text>
                    </View>
                    <View style={styles.holidayActions}>
                      <TouchableOpacity
                        onPress={() => handleOpenEdit(holiday)}
                        style={styles.iconButton}
                        accessibilityLabel="Edit holiday"
                      >
                        <Ionicons name="pencil" size={18} color={colors.text} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDelete(holiday)}
                        style={styles.iconButton}
                        accessibilityLabel="Delete holiday"
                      >
                        <Ionicons name="trash" size={18} color="#DC2626" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          )}

          {/* Add/Edit form modal */}
          <Modal
            visible={formVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setFormVisible(false)}
          >
            <View style={styles.overlay}>
              <View style={styles.formContent}>
                <Text style={styles.title}>{editingHoliday ? 'Edit Holiday' : 'Add Holiday'}</Text>
                <Text style={styles.fieldLabel}>Date (YYYY-MM-DD)</Text>
                <TextInput
                  style={styles.input}
                  value={formDate}
                  onChangeText={setFormDate}
                  placeholder="2026-03-20"
                  autoFocus
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
                <View style={styles.formActions}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => setFormVisible(false)}
                    disabled={submitting}
                  >
                    <Text style={styles.cancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.submitButton, (!formDate || submitting) && { opacity: 0.5 }]}
                    onPress={handleSubmit}
                    disabled={!formDate || submitting}
                  >
                    {submitting ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.submitText}>{editingHoliday ? 'Save' : 'Add'}</Text>
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
  holidayActions: {
    flexDirection: 'row',
    gap: spacing.xs,
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
