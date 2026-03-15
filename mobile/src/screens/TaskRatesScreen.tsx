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

const TASK_TYPES = [
  'ARCHITECTURE_ENGINEERING_DIRECTION',
  'DESIGN_DELIVERY_RESEARCH',
  'DEVELOPMENT_TESTING',
  'BUSINESS_SUPPORT',
] as const;

const TASK_TYPE_LABELS: Record<string, string> = {
  ARCHITECTURE_ENGINEERING_DIRECTION: 'Architecture / Engineering Direction',
  DESIGN_DELIVERY_RESEARCH: 'Design / Delivery / Research',
  DEVELOPMENT_TESTING: 'Development / Testing',
  BUSINESS_SUPPORT: 'Business Support',
};

interface TaskRate {
  id: string;
  task_type: string;
  day_rate: number | string;
  currency_code: string;
  effective_from: string;
  effective_to: string | null;
  created_at: string;
  updated_at: string;
}

export default function TaskRatesScreen() {
  const [rates, setRates] = useState<TaskRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRate, setEditingRate] = useState<TaskRate | null>(null);
  const [formTaskType, setFormTaskType] = useState<string>(TASK_TYPES[0]);
  const [formDayRate, setFormDayRate] = useState('');
  const [formCurrency, setFormCurrency] = useState('GBP');
  const [formEffectiveFrom, setFormEffectiveFrom] = useState('');
  const [saving, setSaving] = useState(false);
  const [typePickerVisible, setTypePickerVisible] = useState(false);

  const fetchRates = useCallback(async () => {
    try {
      const data = await api.get<TaskRate[]>('/api/task-rates/current');
      setRates(data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRates();
  }, [fetchRates]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchRates();
    setRefreshing(false);
  };

  const openCreate = () => {
    setEditingRate(null);
    setFormTaskType(TASK_TYPES[0]);
    setFormDayRate('');
    setFormCurrency('GBP');
    setFormEffectiveFrom(new Date().toISOString().split('T')[0]);
    setModalVisible(true);
  };

  const openEdit = (rate: TaskRate) => {
    setEditingRate(rate);
    setFormTaskType(rate.task_type);
    setFormDayRate(String(rate.day_rate));
    setFormCurrency(rate.currency_code);
    setFormEffectiveFrom(rate.effective_from.split('T')[0]);
    setModalVisible(true);
  };

  const handleSave = async () => {
    const dayRateNum = parseFloat(formDayRate);
    if (!formDayRate || isNaN(dayRateNum) || dayRateNum <= 0) return;
    if (!formEffectiveFrom) return;

    setSaving(true);
    try {
      if (editingRate) {
        await api.put(`/api/task-rates/${editingRate.id}`, {
          day_rate: dayRateNum,
          currency_code: formCurrency.trim() || 'GBP',
          effective_from: formEffectiveFrom,
        });
      } else {
        await api.post('/api/task-rates', {
          task_type: formTaskType,
          day_rate: dayRateNum,
          currency_code: formCurrency.trim() || 'GBP',
          effective_from: formEffectiveFrom,
        });
      }
      setModalVisible(false);
      await fetchRates();
    } catch (err) {
      Alert.alert('Error', err instanceof ApiError ? err.message : 'Failed to save task rate.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (rate: TaskRate) => {
    Alert.alert('Delete Rate', `Delete the ${TASK_TYPE_LABELS[rate.task_type]} rate?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/api/task-rates/${rate.id}`);
            await fetchRates();
          } catch (err) {
            Alert.alert(
              'Error',
              err instanceof ApiError ? err.message : 'Failed to delete task rate.',
            );
          }
        },
      },
    ]);
  };

  const isFormValid =
    formTaskType &&
    formDayRate &&
    !isNaN(parseFloat(formDayRate)) &&
    parseFloat(formDayRate) > 0 &&
    formEffectiveFrom;

  const renderRate = ({ item }: { item: TaskRate }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.taskType}>{TASK_TYPE_LABELS[item.task_type] ?? item.task_type}</Text>
        <View style={styles.cardActions}>
          <TouchableOpacity onPress={() => openEdit(item)} style={styles.actionButton}>
            <Text style={styles.editText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleDelete(item)} style={styles.actionButton}>
            <Text style={styles.deleteText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.rateRow}>
        <Text style={styles.rateValue}>
          {item.currency_code} {Number(item.day_rate).toFixed(2)}
        </Text>
        <Text style={styles.rateLabel}>/ day</Text>
      </View>
      <Text style={styles.effectiveDate}>
        From {new Date(item.effective_from).toLocaleDateString()}
      </Text>
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
        data={rates}
        keyExtractor={(item) => item.id}
        renderItem={renderRate}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <TouchableOpacity style={styles.addButton} onPress={openCreate}>
            <Text style={styles.addButtonText}>+ Add Rate</Text>
          </TouchableOpacity>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No task rates yet. Add one to get started.</Text>
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
            <Text style={styles.modalTitle}>{editingRate ? 'Edit Rate' : 'Add Rate'}</Text>
            <TouchableOpacity onPress={handleSave} disabled={!isFormValid || saving}>
              <Text
                style={[styles.modalSave, (!isFormValid || saving) && styles.modalSaveDisabled]}
              >
                {saving ? 'Saving...' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalForm}>
            <Text style={styles.fieldLabel}>Task Type *</Text>
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={() => setTypePickerVisible(true)}
              disabled={!!editingRate}
            >
              <Text style={[styles.pickerButtonText, !!editingRate && { color: '#999' }]}>
                {TASK_TYPE_LABELS[formTaskType]}
              </Text>
            </TouchableOpacity>

            <Text style={styles.fieldLabel}>Day Rate *</Text>
            <TextInput
              style={styles.input}
              value={formDayRate}
              onChangeText={setFormDayRate}
              placeholder="0.00"
              placeholderTextColor="#999"
              keyboardType="decimal-pad"
            />

            <Text style={styles.fieldLabel}>Currency Code</Text>
            <TextInput
              style={styles.input}
              value={formCurrency}
              onChangeText={(t) => setFormCurrency(t.toUpperCase())}
              placeholder="GBP"
              placeholderTextColor="#999"
              maxLength={3}
              autoCapitalize="characters"
            />

            <Text style={styles.fieldLabel}>Effective From *</Text>
            <TextInput
              style={styles.input}
              value={formEffectiveFrom}
              onChangeText={setFormEffectiveFrom}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#999"
            />
          </ScrollView>
        </View>
      </Modal>

      {/* Task Type Picker Modal */}
      <Modal visible={typePickerVisible} animationType="fade" transparent>
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerContainer}>
            <Text style={styles.pickerTitle}>Select Task Type</Text>
            {TASK_TYPES.map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.pickerOption, t === formTaskType && styles.pickerOptionActive]}
                onPress={() => {
                  setFormTaskType(t);
                  setTypePickerVisible(false);
                }}
              >
                <Text
                  style={[
                    styles.pickerOptionText,
                    t === formTaskType && styles.pickerOptionTextActive,
                  ]}
                >
                  {TASK_TYPE_LABELS[t]}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.pickerCancelButton}
              onPress={() => setTypePickerVisible(false)}
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
    marginBottom: spacing.xs,
  },
  taskType: {
    fontSize: typography.sizes.body1,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    flex: 1,
    marginRight: spacing.sm,
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
  rateRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 2,
  },
  rateValue: {
    fontSize: typography.sizes.h3,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  rateLabel: {
    fontSize: typography.sizes.body2,
    color: '#666',
    marginLeft: spacing.xs,
  },
  effectiveDate: {
    fontSize: typography.sizes.caption,
    color: '#999',
  },
  addButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.button,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  addButtonText: {
    color: '#fff',
    fontSize: typography.sizes.body2,
    fontWeight: typography.weights.semibold,
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
  pickerButton: {
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: borderRadius.input,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    marginBottom: spacing.md,
  },
  pickerButtonText: {
    fontSize: typography.sizes.body1,
    color: colors.text,
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
