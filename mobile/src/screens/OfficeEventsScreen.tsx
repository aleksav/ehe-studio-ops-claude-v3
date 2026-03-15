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
  Switch,
} from 'react-native';
import { colors, spacing, borderRadius, typography } from '@ehestudio-ops/shared';
import { api, ApiError } from '../lib/api';

interface OfficeEvent {
  id: string;
  name: string;
  event_type: string;
  start_date: string;
  end_date: string;
  allow_time_entry: boolean;
  notes: string | null;
  created_at: string;
}

const EVENT_TYPE_OPTIONS = [
  { value: 'OFFICE_CLOSED', label: 'Office Closed' },
  { value: 'TEAM_SOCIAL', label: 'Team Social' },
  { value: 'IMPORTANT_EVENT', label: 'Important Event' },
];

const EVENT_TYPE_LABELS: Record<string, string> = {
  OFFICE_CLOSED: 'Office Closed',
  TEAM_SOCIAL: 'Team Social',
  IMPORTANT_EVENT: 'Important Event',
};

const EVENT_TYPE_COLORS: Record<string, string> = {
  OFFICE_CLOSED: colors.error,
  TEAM_SOCIAL: colors.secondary,
  IMPORTANT_EVENT: '#F59E0B',
};

const currentYear = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => currentYear - 1 + i);

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateRange(startDate: string, endDate: string): string {
  const start = formatDate(startDate);
  const end = formatDate(endDate);
  return start === end ? start : `${start} - ${end}`;
}

export default function OfficeEventsScreen() {
  const [events, setEvents] = useState<OfficeEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [year, setYear] = useState(currentYear);
  const [yearPickerVisible, setYearPickerVisible] = useState(false);

  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [editingEvent, setEditingEvent] = useState<OfficeEvent | null>(null);
  const [formName, setFormName] = useState('');
  const [formEventType, setFormEventType] = useState('OFFICE_CLOSED');
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formAllowTimeEntry, setFormAllowTimeEntry] = useState(false);
  const [formNotes, setFormNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [typePickerVisible, setTypePickerVisible] = useState(false);

  const fetchEvents = useCallback(async () => {
    try {
      const data = await api.get<OfficeEvent[]>(`/api/office-events?year=${year}`);
      setEvents(data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    setLoading(true);
    void fetchEvents();
  }, [fetchEvents]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchEvents();
    setRefreshing(false);
  };

  const openCreate = () => {
    setEditingEvent(null);
    setFormName('');
    setFormEventType('OFFICE_CLOSED');
    setFormStartDate('');
    setFormEndDate('');
    setFormAllowTimeEntry(false);
    setFormNotes('');
    setModalVisible(true);
  };

  const openEdit = (event: OfficeEvent) => {
    setEditingEvent(event);
    setFormName(event.name);
    setFormEventType(event.event_type);
    setFormStartDate(event.start_date.substring(0, 10));
    setFormEndDate(event.end_date.substring(0, 10));
    setFormAllowTimeEntry(event.allow_time_entry);
    setFormNotes(event.notes ?? '');
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!formName.trim() || !formStartDate.trim() || !formEndDate.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: formName.trim(),
        event_type: formEventType,
        start_date: formStartDate,
        end_date: formEndDate,
        allow_time_entry: formAllowTimeEntry,
        notes: formNotes.trim() || null,
      };
      if (editingEvent) {
        await api.put(`/api/office-events/${editingEvent.id}`, payload);
      } else {
        await api.post('/api/office-events', payload);
      }
      setModalVisible(false);
      await fetchEvents();
    } catch (err) {
      Alert.alert('Error', err instanceof ApiError ? err.message : 'Failed to save event.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (event: OfficeEvent) => {
    Alert.alert(
      'Delete Event',
      `Delete "${event.name}" (${formatDateRange(event.start_date, event.end_date)})?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/api/office-events/${event.id}`);
              await fetchEvents();
            } catch (err) {
              Alert.alert(
                'Error',
                err instanceof ApiError ? err.message : 'Failed to delete event.',
              );
            }
          },
        },
      ],
    );
  };

  const isFormValid =
    formName.trim() && formStartDate.trim() && formEndDate.trim() && formEndDate >= formStartDate;

  const renderEvent = ({ item }: { item: OfficeEvent }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardInfo}>
          <Text style={styles.eventName}>{item.name}</Text>
          <View style={styles.chipRow}>
            <View
              style={[
                styles.chip,
                { borderColor: EVENT_TYPE_COLORS[item.event_type] ?? colors.divider },
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: EVENT_TYPE_COLORS[item.event_type] ?? colors.text },
                ]}
              >
                {EVENT_TYPE_LABELS[item.event_type] ?? item.event_type}
              </Text>
            </View>
            <View
              style={[
                styles.chip,
                {
                  borderColor: item.allow_time_entry ? '#4CAF50' : colors.divider,
                },
              ]}
            >
              <Text
                style={[styles.chipText, { color: item.allow_time_entry ? '#4CAF50' : '#999' }]}
              >
                {item.allow_time_entry ? 'Time Allowed' : 'Time Blocked'}
              </Text>
            </View>
          </View>
          <Text style={styles.eventDate}>{formatDateRange(item.start_date, item.end_date)}</Text>
          {item.notes ? <Text style={styles.eventNotes}>{item.notes}</Text> : null}
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
        data={events}
        keyExtractor={(item) => item.id}
        renderItem={renderEvent}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <View style={styles.headerRow}>
            <TouchableOpacity style={styles.yearButton} onPress={() => setYearPickerVisible(true)}>
              <Text style={styles.yearButtonText}>{year}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.addButton} onPress={openCreate}>
              <Text style={styles.addButtonText}>+ Add Event</Text>
            </TouchableOpacity>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No office events for {year}.</Text>
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
            <Text style={styles.modalTitle}>{editingEvent ? 'Edit Event' : 'Add Event'}</Text>
            <TouchableOpacity onPress={handleSave} disabled={!isFormValid || saving}>
              <Text
                style={[styles.modalSave, (!isFormValid || saving) && styles.modalSaveDisabled]}
              >
                {saving ? 'Saving...' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalForm}>
            <Text style={styles.fieldLabel}>Event Name *</Text>
            <TextInput
              style={styles.input}
              value={formName}
              onChangeText={setFormName}
              placeholder="Christmas Office Closure"
              placeholderTextColor="#999"
            />

            <Text style={styles.fieldLabel}>Event Type *</Text>
            <TouchableOpacity style={styles.input} onPress={() => setTypePickerVisible(true)}>
              <Text style={{ fontSize: typography.sizes.body1, color: colors.text }}>
                {EVENT_TYPE_LABELS[formEventType] ?? formEventType}
              </Text>
            </TouchableOpacity>

            <Text style={styles.fieldLabel}>Start Date (YYYY-MM-DD) *</Text>
            <TextInput
              style={styles.input}
              value={formStartDate}
              onChangeText={setFormStartDate}
              placeholder="2026-12-23"
              placeholderTextColor="#999"
            />

            <Text style={styles.fieldLabel}>End Date (YYYY-MM-DD) *</Text>
            <TextInput
              style={styles.input}
              value={formEndDate}
              onChangeText={setFormEndDate}
              placeholder="2027-01-02"
              placeholderTextColor="#999"
            />

            <View style={styles.switchRow}>
              <Text style={styles.fieldLabel}>Allow Time Entry</Text>
              <Switch
                value={formAllowTimeEntry}
                onValueChange={setFormAllowTimeEntry}
                trackColor={{ true: colors.primary }}
              />
            </View>

            <Text style={styles.fieldLabel}>Notes</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formNotes}
              onChangeText={setFormNotes}
              placeholder="Optional notes..."
              placeholderTextColor="#999"
              multiline
              numberOfLines={3}
            />
          </ScrollView>
        </View>
      </Modal>

      {/* Event Type Picker Modal */}
      <Modal visible={typePickerVisible} animationType="fade" transparent>
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerContainer}>
            <Text style={styles.pickerTitle}>Select Event Type</Text>
            {EVENT_TYPE_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.pickerOption,
                  opt.value === formEventType && styles.pickerOptionActive,
                ]}
                onPress={() => {
                  setFormEventType(opt.value);
                  setTypePickerVisible(false);
                }}
              >
                <Text
                  style={[
                    styles.pickerOptionText,
                    opt.value === formEventType && styles.pickerOptionTextActive,
                  ]}
                >
                  {opt.label}
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
  eventName: {
    fontSize: typography.sizes.body1,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    marginBottom: 4,
  },
  chipRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: 4,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  chipText: {
    fontSize: 11,
    fontWeight: typography.weights.medium,
  },
  eventDate: {
    fontSize: typography.sizes.body2,
    color: '#666',
  },
  eventNotes: {
    fontSize: typography.sizes.body2,
    color: '#888',
    marginTop: 4,
    fontStyle: 'italic',
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
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
