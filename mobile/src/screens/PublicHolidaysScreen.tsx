import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
  TextInput,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { colors, spacing, borderRadius, typography } from '@ehestudio-ops/shared';
import { api, ApiError } from '../lib/api';

interface PublicHoliday {
  id: string;
  date: string;
  name: string;
  created_at: string;
}

const currentYear = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => currentYear - 1 + i);

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function PublicHolidaysScreen() {
  const [holidays, setHolidays] = useState<PublicHoliday[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [year, setYear] = useState(currentYear);
  const [yearPickerVisible, setYearPickerVisible] = useState(false);

  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<PublicHoliday | null>(null);
  const [formDate, setFormDate] = useState('');
  const [formName, setFormName] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchHolidays = useCallback(async () => {
    try {
      const data = await api.get<PublicHoliday[]>(`/api/public-holidays?year=${year}`);
      setHolidays(data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    setLoading(true);
    void fetchHolidays();
  }, [fetchHolidays]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchHolidays();
    setRefreshing(false);
  };

  const openCreate = () => {
    setEditingHoliday(null);
    setFormDate('');
    setFormName('');
    setModalVisible(true);
  };

  const openEdit = (holiday: PublicHoliday) => {
    setEditingHoliday(holiday);
    setFormDate(holiday.date.substring(0, 10));
    setFormName(holiday.name);
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!formDate.trim() || !formName.trim()) return;
    setSaving(true);
    try {
      if (editingHoliday) {
        await api.put(`/api/public-holidays/${editingHoliday.id}`, {
          date: formDate,
          name: formName.trim(),
        });
      } else {
        await api.post('/api/public-holidays', {
          date: formDate,
          name: formName.trim(),
        });
      }
      setModalVisible(false);
      await fetchHolidays();
    } catch (err) {
      Alert.alert('Error', err instanceof ApiError ? err.message : 'Failed to save holiday.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (holiday: PublicHoliday) => {
    Alert.alert('Delete Holiday', `Delete "${holiday.name}" (${formatDate(holiday.date)})?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/api/public-holidays/${holiday.id}`);
            await fetchHolidays();
          } catch (err) {
            Alert.alert(
              'Error',
              err instanceof ApiError ? err.message : 'Failed to delete holiday.',
            );
          }
        },
      },
    ]);
  };

  const isFormValid = formDate.trim() && formName.trim();

  const renderHoliday = ({ item }: { item: PublicHoliday }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardInfo}>
          <Text style={styles.holidayName}>{item.name}</Text>
          <Text style={styles.holidayDate}>{formatDate(item.date)}</Text>
        </View>
        <View style={styles.cardActions}>
          <TouchableOpacity onPress={() => openEdit(item)} style={styles.actionButton}>
            <Text style={styles.editText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleDelete(item)} style={styles.actionButton}>
            <Text style={styles.deleteText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={holidays}
        keyExtractor={(item) => item.id}
        renderItem={renderHoliday}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <View style={styles.headerRow}>
            <TouchableOpacity style={styles.yearButton} onPress={() => setYearPickerVisible(true)}>
              <Text style={styles.yearButtonText}>{year}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.addButton} onPress={openCreate}>
              <Text style={styles.addButtonText}>+ Add Holiday</Text>
            </TouchableOpacity>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No public holidays for {year}.</Text>
          </View>
        }
      />

      {/* Add/Edit Modal */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{editingHoliday ? 'Edit Holiday' : 'Add Holiday'}</Text>
            <TouchableOpacity onPress={handleSave} disabled={!isFormValid || saving}>
              <Text
                style={[styles.modalSave, (!isFormValid || saving) && styles.modalSaveDisabled]}
              >
                {saving ? 'Saving...' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalForm}>
            <Text style={styles.fieldLabel}>Date (YYYY-MM-DD) *</Text>
            <TextInput
              style={styles.input}
              value={formDate}
              onChangeText={setFormDate}
              placeholder="2026-01-01"
              placeholderTextColor="#999"
            />

            <Text style={styles.fieldLabel}>Holiday Name *</Text>
            <TextInput
              style={styles.input}
              value={formName}
              onChangeText={setFormName}
              placeholder="New Year's Day"
              placeholderTextColor="#999"
            />
          </ScrollView>
        </View>
      </Modal>

      {/* Year Picker Modal */}
      <Modal visible={yearPickerVisible} animationType="fade" transparent>
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerContainer}>
            <Text style={styles.pickerTitle}>Select Year</Text>
            {YEAR_OPTIONS.map((y) => (
              <TouchableOpacity
                key={y}
                style={[styles.pickerOption, y === year && styles.pickerOptionActive]}
                onPress={() => {
                  setYear(y);
                  setYearPickerVisible(false);
                }}
              >
                <Text
                  style={[styles.pickerOptionText, y === year && styles.pickerOptionTextActive]}
                >
                  {y}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.pickerCancelButton}
              onPress={() => setYearPickerVisible(false)}
            >
              <Text style={styles.pickerCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  list: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  yearButton: {
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: borderRadius.button,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  yearButtonText: {
    fontSize: typography.sizes.body1,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  addButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.button,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontSize: typography.sizes.body2,
    fontWeight: typography.weights.semibold,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: borderRadius.card,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  holidayName: {
    fontSize: typography.sizes.body1,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    marginBottom: 2,
  },
  holidayDate: {
    fontSize: typography.sizes.body2,
    color: '#666',
  },
  cardActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
  },
  editText: {
    fontSize: typography.sizes.body2,
    color: colors.secondary,
    fontWeight: typography.weights.medium,
  },
  deleteText: {
    fontSize: typography.sizes.body2,
    color: colors.error,
    fontWeight: typography.weights.medium,
  },
  emptyContainer: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: typography.sizes.body2,
    color: '#999',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  modalTitle: {
    fontSize: typography.sizes.h4,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  modalCancel: {
    fontSize: typography.sizes.body1,
    color: '#666',
  },
  modalSave: {
    fontSize: typography.sizes.body1,
    color: colors.primary,
    fontWeight: typography.weights.semibold,
  },
  modalSaveDisabled: {
    opacity: 0.5,
  },
  modalForm: {
    padding: spacing.md,
  },
  fieldLabel: {
    fontSize: typography.sizes.body2,
    fontWeight: typography.weights.medium,
    color: '#666',
    marginBottom: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: borderRadius.input,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: typography.sizes.body1,
    color: colors.text,
    marginBottom: spacing.md,
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  pickerContainer: {
    backgroundColor: '#fff',
    borderRadius: borderRadius.card,
    padding: spacing.md,
  },
  pickerTitle: {
    fontSize: typography.sizes.h4,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  pickerOption: {
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.button,
    marginBottom: spacing.xs,
  },
  pickerOptionActive: {
    backgroundColor: `${colors.primary}15`,
  },
  pickerOptionText: {
    fontSize: typography.sizes.body1,
    color: colors.text,
    textAlign: 'center',
  },
  pickerOptionTextActive: {
    color: colors.primary,
    fontWeight: typography.weights.semibold,
  },
  pickerCancelButton: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  pickerCancelText: {
    fontSize: typography.sizes.body1,
    color: '#666',
  },
});
