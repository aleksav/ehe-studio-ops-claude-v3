import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { colors, spacing, borderRadius, typography } from '@ehestudio-ops/shared';
import { TaskType } from '@ehestudio-ops/shared';
import { useAuth } from '../contexts/AuthContext';
import { api, ApiError } from '../lib/api';

interface Project {
  id: string;
  name: string;
  status: string;
  client: { id: string; name: string } | null;
}

interface TimeEntry {
  id: string;
  project_id: string;
  team_member_id: string;
  date: string;
  hours_worked: string | number;
  task_type: string;
  notes: string | null;
}

const TASK_TYPE_LABELS: Record<string, string> = {
  ARCHITECTURE_ENGINEERING_DIRECTION: 'Arch & Eng Direction',
  DESIGN_DELIVERY_RESEARCH: 'Design & Research',
  DEVELOPMENT_TESTING: 'Dev & Testing',
  BUSINESS_SUPPORT: 'Business Support',
};

const TASK_TYPES = Object.values(TaskType);

function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export default function TimeLoggingScreen() {
  const { user } = useAuth();
  const teamMemberId = user?.team_member?.id ?? null;

  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [projectPickerVisible, setProjectPickerVisible] = useState(false);

  // Form
  const [date, setDate] = useState(todayISO());
  const [hours, setHours] = useState('');
  const [taskType, setTaskType] = useState<string>(TASK_TYPES[0]);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Entries
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.get<Project[]>('/api/projects');
        setProjects(
          data
            .filter((p) => p.status !== 'ARCHIVED')
            .sort((a, b) => {
              const ca = a.client?.name ?? '';
              const cb = b.client?.name ?? '';
              const cmp = ca.localeCompare(cb);
              return cmp !== 0 ? cmp : a.name.localeCompare(b.name);
            }),
        );
      } catch {
        // silently fail
      } finally {
        setProjectsLoading(false);
      }
    })();
  }, []);

  const fetchEntries = useCallback(async () => {
    if (!selectedProject || !teamMemberId) return;
    setEntriesLoading(true);
    try {
      const data = await api.get<TimeEntry[]>(
        `/api/time-entries?project_id=${selectedProject.id}&team_member_id=${teamMemberId}`,
      );
      setEntries(data);
    } catch {
      setEntries([]);
    } finally {
      setEntriesLoading(false);
    }
  }, [selectedProject, teamMemberId]);

  useEffect(() => {
    void fetchEntries();
  }, [fetchEntries]);

  const handleSubmit = async () => {
    if (!selectedProject || !teamMemberId || !hours || !taskType) return;

    setSubmitting(true);
    try {
      await api.post('/api/time-entries', {
        project_id: selectedProject.id,
        team_member_id: teamMemberId,
        date,
        hours_worked: parseFloat(hours),
        task_type: taskType,
        notes: notes.trim() || undefined,
      });
      Alert.alert('Success', 'Time entry logged successfully.');
      setHours('');
      setNotes('');
      void fetchEntries();
    } catch (err) {
      Alert.alert(
        'Error',
        err instanceof ApiError ? err.message : 'Something went wrong. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const projectLabel = selectedProject
    ? selectedProject.client
      ? `${selectedProject.client.name} - ${selectedProject.name}`
      : selectedProject.name
    : 'Select project';

  const projectTotal = entries.reduce((sum, e) => sum + parseFloat(String(e.hours_worked)), 0);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Quick Entry</Text>
      <Text style={styles.subtitle}>Log time against a project.</Text>

      {/* Project Selector */}
      {projectsLoading ? (
        <ActivityIndicator size="small" color={colors.primary} style={styles.loader} />
      ) : (
        <TouchableOpacity style={styles.picker} onPress={() => setProjectPickerVisible(true)}>
          <Text style={[styles.pickerText, !selectedProject && styles.pickerPlaceholder]}>
            {projectLabel}
          </Text>
        </TouchableOpacity>
      )}

      {/* Project Picker Modal */}
      <Modal visible={projectPickerVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Project</Text>
            <TouchableOpacity onPress={() => setProjectPickerVisible(false)}>
              <Text style={styles.modalClose}>Done</Text>
            </TouchableOpacity>
          </View>
          <ScrollView>
            {projects.map((p) => {
              const label = p.client ? `${p.client.name} - ${p.name}` : p.name;
              return (
                <TouchableOpacity
                  key={p.id}
                  style={[
                    styles.modalItem,
                    selectedProject?.id === p.id && styles.modalItemSelected,
                  ]}
                  onPress={() => {
                    setSelectedProject(p);
                    setProjectPickerVisible(false);
                  }}
                >
                  <Text
                    style={[
                      styles.modalItemText,
                      selectedProject?.id === p.id && styles.modalItemTextSelected,
                    ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </Modal>

      {/* Entry Form */}
      {selectedProject && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Log Time</Text>

          <Text style={styles.fieldLabel}>Date</Text>
          <TextInput
            style={styles.input}
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#999"
          />

          <Text style={styles.fieldLabel}>Hours</Text>
          <TextInput
            style={styles.input}
            value={hours}
            onChangeText={setHours}
            placeholder="e.g. 2.5"
            placeholderTextColor="#999"
            keyboardType="decimal-pad"
          />

          <Text style={styles.fieldLabel}>Task Type</Text>
          <View style={styles.taskTypeRow}>
            {TASK_TYPES.map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.taskTypeChip, taskType === t && styles.taskTypeChipActive]}
                onPress={() => setTaskType(t)}
              >
                <Text style={[styles.taskTypeText, taskType === t && styles.taskTypeTextActive]}>
                  {TASK_TYPE_LABELS[t] ?? t}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.fieldLabel}>Notes (optional)</Text>
          <TextInput
            style={[styles.input, styles.multilineInput]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Add notes..."
            placeholderTextColor="#999"
            multiline
          />

          <TouchableOpacity
            style={[
              styles.submitButton,
              (submitting || !hours || !taskType) && styles.buttonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={submitting || !hours || !taskType}
          >
            <Text style={styles.submitText}>{submitting ? 'Logging...' : 'Log Entry'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Entries List */}
      {selectedProject && (
        <View style={styles.card}>
          <View style={styles.entriesHeader}>
            <Text style={styles.cardTitle}>Entries</Text>
            <Text style={styles.totalBadge}>{projectTotal.toFixed(1)}h total</Text>
          </View>

          {entriesLoading ? (
            <ActivityIndicator size="small" color={colors.primary} style={styles.loader} />
          ) : entries.length === 0 ? (
            <Text style={styles.emptyText}>No entries yet for this project.</Text>
          ) : (
            entries.slice(0, 20).map((entry) => (
              <View key={entry.id} style={styles.entryRow}>
                <Text style={styles.entryHours}>
                  {parseFloat(String(entry.hours_worked)).toFixed(1)}h
                </Text>
                <View style={styles.entryContent}>
                  <Text style={styles.entryTaskType}>
                    {TASK_TYPE_LABELS[entry.task_type] ?? entry.task_type}
                  </Text>
                  <Text style={styles.entryDate}>
                    {new Date(entry.date).toLocaleDateString('en-GB', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                    })}
                  </Text>
                  {entry.notes && <Text style={styles.entryNotes}>{entry.notes}</Text>}
                </View>
              </View>
            ))
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  title: {
    fontSize: typography.sizes.h3,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.sizes.body2,
    color: '#666',
    marginBottom: spacing.lg,
  },
  loader: {
    paddingVertical: spacing.lg,
  },
  picker: {
    backgroundColor: '#fff',
    borderRadius: borderRadius.input,
    borderWidth: 1,
    borderColor: colors.divider,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    marginBottom: spacing.md,
  },
  pickerText: {
    fontSize: typography.sizes.body1,
    color: colors.text,
  },
  pickerPlaceholder: {
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
  modalClose: {
    fontSize: typography.sizes.body1,
    color: colors.primary,
    fontWeight: typography.weights.semibold,
  },
  modalItem: {
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  modalItemSelected: {
    backgroundColor: colors.primary + '10',
  },
  modalItemText: {
    fontSize: typography.sizes.body1,
    color: colors.text,
  },
  modalItemTextSelected: {
    color: colors.primary,
    fontWeight: typography.weights.semibold,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: borderRadius.card,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardTitle: {
    fontSize: typography.sizes.h4,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    marginBottom: spacing.md,
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
  multilineInput: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  taskTypeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  taskTypeChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: borderRadius.chip,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  taskTypeChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  taskTypeText: {
    fontSize: typography.sizes.caption,
    color: '#666',
  },
  taskTypeTextActive: {
    color: '#fff',
    fontWeight: typography.weights.semibold,
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.button,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  submitText: {
    color: '#fff',
    fontSize: typography.sizes.body1,
    fontWeight: typography.weights.semibold,
  },
  entriesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalBadge: {
    fontSize: typography.sizes.caption,
    color: colors.secondary,
    fontWeight: typography.weights.semibold,
  },
  emptyText: {
    fontSize: typography.sizes.body2,
    color: '#999',
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  entryRow: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  entryHours: {
    fontSize: typography.sizes.body2,
    fontWeight: typography.weights.bold,
    color: colors.primary,
    minWidth: 42,
  },
  entryContent: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  entryTaskType: {
    fontSize: typography.sizes.body2,
    fontWeight: typography.weights.medium,
    color: colors.text,
  },
  entryDate: {
    fontSize: typography.sizes.caption,
    color: '#666',
    marginTop: 2,
  },
  entryNotes: {
    fontSize: typography.sizes.body2,
    color: '#666',
    marginTop: 2,
  },
});
