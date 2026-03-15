import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography } from '@ehestudio-ops/shared';
import { api } from '../lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TimeEntryProject {
  id: string;
  name: string;
}

interface TimeEntryMember {
  id: string;
  full_name: string;
}

interface TimeEntry {
  id: string;
  project_id: string;
  team_member_id: string;
  date: string;
  hours_worked: number | string;
  task_type: string;
  notes: string | null;
  project: TimeEntryProject;
  team_member: TimeEntryMember;
}

interface ClientOption {
  id: string;
  name: string;
}

interface ProjectOption {
  id: string;
  name: string;
  client_id: string | null;
}

interface MemberOption {
  id: string;
  full_name: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TASK_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'ARCHITECTURE_ENGINEERING_DIRECTION', label: 'Arch & Eng' },
  { value: 'DESIGN_DELIVERY_RESEARCH', label: 'Design & Research' },
  { value: 'DEVELOPMENT_TESTING', label: 'Dev & Testing' },
  { value: 'BUSINESS_SUPPORT', label: 'Business Support' },
];

const TASK_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  TASK_TYPE_OPTIONS.map((o) => [o.value, o.label]),
);

const TASK_TYPE_COLOR: Record<string, string> = {
  ARCHITECTURE_ENGINEERING_DIRECTION: '#7C3AED',
  DESIGN_DELIVERY_RESEARCH: '#0891B2',
  DEVELOPMENT_TESTING: '#059669',
  BUSINESS_SUPPORT: '#D97706',
};

// ---------------------------------------------------------------------------
// Picker Modal
// ---------------------------------------------------------------------------

interface PickerOption {
  value: string;
  label: string;
}

function PickerModal({
  visible,
  onClose,
  title,
  options,
  selected,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  options: PickerOption[];
  selected: string;
  onSelect: (value: string) => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={pickerStyles.overlay}>
        <View style={pickerStyles.content}>
          <Text style={pickerStyles.title}>{title}</Text>
          <ScrollView style={{ maxHeight: 400 }}>
            <TouchableOpacity
              style={[pickerStyles.option, !selected && pickerStyles.optionActive]}
              onPress={() => {
                onSelect('');
                onClose();
              }}
            >
              <Text style={[pickerStyles.optionText, !selected && pickerStyles.optionTextActive]}>
                All
              </Text>
            </TouchableOpacity>
            {options.map((opt) => {
              const isActive = selected === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[pickerStyles.option, isActive && pickerStyles.optionActive]}
                  onPress={() => {
                    onSelect(opt.value);
                    onClose();
                  }}
                >
                  <Text
                    style={[pickerStyles.optionText, isActive && pickerStyles.optionTextActive]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <TouchableOpacity style={pickerStyles.cancelButton} onPress={onClose}>
            <Text style={pickerStyles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const pickerStyles = StyleSheet.create({
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
    maxWidth: 360,
  },
  title: {
    fontSize: typography.sizes.body1,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  option: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.button,
    marginBottom: 4,
    minHeight: 44,
    justifyContent: 'center',
  },
  optionActive: {
    backgroundColor: colors.primary,
  },
  optionText: {
    fontSize: typography.sizes.body2,
    color: colors.text,
  },
  optionTextActive: {
    color: '#fff',
    fontWeight: typography.weights.semibold,
  },
  cancelButton: {
    marginTop: spacing.md,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: typography.sizes.body1,
    color: '#666',
    fontWeight: '600',
  },
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TimeEntriesScreen() {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [members, setMembers] = useState<MemberOption[]>([]);

  // Filters
  const [clientId, setClientId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [memberId, setMemberId] = useState('');
  const [taskType, setTaskType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Picker modals
  const [clientPickerOpen, setClientPickerOpen] = useState(false);
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const [memberPickerOpen, setMemberPickerOpen] = useState(false);
  const [taskTypePickerOpen, setTaskTypePickerOpen] = useState(false);

  useEffect(() => {
    api
      .get<ClientOption[]>('/api/clients')
      .then((c) => setClients(c.sort((a, b) => a.name.localeCompare(b.name))))
      .catch(() => {});
    api
      .get<ProjectOption[]>('/api/projects')
      .then((p) => setProjects(p.sort((a, b) => a.name.localeCompare(b.name))))
      .catch(() => {});
    api
      .get<MemberOption[]>('/api/team-members')
      .then((m) => setMembers(m.sort((a, b) => a.full_name.localeCompare(b.full_name))))
      .catch(() => {});
  }, []);

  const filteredProjects = useMemo(
    () => (clientId ? projects.filter((p) => p.client_id === clientId) : projects),
    [projects, clientId],
  );

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (clientId && !projectId) params.set('client_id', clientId);
      if (projectId) params.set('project_id', projectId);
      if (memberId) params.set('team_member_id', memberId);
      if (taskType) params.set('task_type', taskType);
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);
      const qs = params.toString();
      const data = await api.get<TimeEntry[]>(`/api/time-entries${qs ? `?${qs}` : ''}`);
      setEntries(data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [clientId, projectId, memberId, taskType, dateFrom, dateTo]);

  useEffect(() => {
    void fetchEntries();
  }, [fetchEntries]);

  const totalHours = useMemo(
    () => entries.reduce((sum, e) => sum + Number(e.hours_worked), 0),
    [entries],
  );

  const clientOptions: PickerOption[] = clients.map((c) => ({ value: c.id, label: c.name }));
  const projectOptions: PickerOption[] = filteredProjects.map((p) => ({
    value: p.id,
    label: p.name,
  }));
  const memberOptions: PickerOption[] = members.map((m) => ({
    value: m.id,
    label: m.full_name,
  }));

  const selectedClientLabel = clients.find((c) => c.id === clientId)?.name ?? 'All';
  const selectedProjectLabel = projects.find((p) => p.id === projectId)?.name ?? 'All';
  const selectedMemberLabel = members.find((m) => m.id === memberId)?.full_name ?? 'All';
  const selectedTaskTypeLabel = TASK_TYPE_OPTIONS.find((t) => t.value === taskType)?.label ?? 'All';

  const renderEntry = ({ item }: { item: TimeEntry }) => {
    const dateStr = new Date(item.date.substring(0, 10) + 'T00:00:00').toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
    return (
      <View style={styles.entryCard}>
        <View style={styles.entryHeader}>
          <Text style={styles.entryDate}>{dateStr}</Text>
          <Text style={styles.entryHours}>{Number(item.hours_worked).toFixed(1)}h</Text>
        </View>
        <Text style={styles.entryMember}>{item.team_member.full_name}</Text>
        <Text style={styles.entryProject}>{item.project.name}</Text>
        <View style={styles.entryFooter}>
          <View
            style={[
              styles.taskTypeChip,
              { backgroundColor: TASK_TYPE_COLOR[item.task_type] ?? '#888' },
            ]}
          >
            <Text style={styles.taskTypeText}>
              {TASK_TYPE_LABEL[item.task_type] ?? item.task_type}
            </Text>
          </View>
          {item.notes ? (
            <Text style={styles.entryNotes} numberOfLines={1}>
              {item.notes}
            </Text>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Filters */}
      <View style={styles.filtersContainer}>
        <View style={styles.filterRow}>
          <TouchableOpacity style={styles.filterButton} onPress={() => setClientPickerOpen(true)}>
            <Ionicons name="business-outline" size={14} color="#666" />
            <Text style={styles.filterLabel} numberOfLines={1}>
              {selectedClientLabel}
            </Text>
            <Ionicons name="chevron-down" size={14} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.filterButton} onPress={() => setProjectPickerOpen(true)}>
            <Ionicons name="folder-outline" size={14} color="#666" />
            <Text style={styles.filterLabel} numberOfLines={1}>
              {selectedProjectLabel}
            </Text>
            <Ionicons name="chevron-down" size={14} color="#999" />
          </TouchableOpacity>
        </View>

        <View style={styles.filterRow}>
          <TouchableOpacity style={styles.filterButton} onPress={() => setMemberPickerOpen(true)}>
            <Ionicons name="person-outline" size={14} color="#666" />
            <Text style={styles.filterLabel} numberOfLines={1}>
              {selectedMemberLabel}
            </Text>
            <Ionicons name="chevron-down" size={14} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.filterButton} onPress={() => setTaskTypePickerOpen(true)}>
            <Ionicons name="pricetag-outline" size={14} color="#666" />
            <Text style={styles.filterLabel} numberOfLines={1}>
              {selectedTaskTypeLabel}
            </Text>
            <Ionicons name="chevron-down" size={14} color="#999" />
          </TouchableOpacity>
        </View>

        <View style={styles.dateFilterRow}>
          <View style={styles.dateField}>
            <Text style={styles.dateLabel}>From</Text>
            <TextInput
              style={styles.dateInput}
              value={dateFrom}
              onChangeText={setDateFrom}
              placeholder="YYYY-MM-DD"
            />
          </View>
          <View style={styles.dateField}>
            <Text style={styles.dateLabel}>To</Text>
            <TextInput
              style={styles.dateInput}
              value={dateTo}
              onChangeText={setDateTo}
              placeholder="YYYY-MM-DD"
            />
          </View>
        </View>
      </View>

      {/* Summary */}
      <Text style={styles.summary}>
        {entries.length} entries &middot; {totalHours.toFixed(1)} hours
      </Text>

      {loading ? (
        <ActivityIndicator
          size="large"
          color={colors.primary}
          style={{ marginVertical: spacing.xl }}
        />
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.id}
          renderItem={renderEntry}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<Text style={styles.emptyText}>No time entries found.</Text>}
        />
      )}

      {/* Picker Modals */}
      <PickerModal
        visible={clientPickerOpen}
        onClose={() => setClientPickerOpen(false)}
        title="Select Client"
        options={clientOptions}
        selected={clientId}
        onSelect={(v) => {
          setClientId(v);
          setProjectId('');
        }}
      />
      <PickerModal
        visible={projectPickerOpen}
        onClose={() => setProjectPickerOpen(false)}
        title="Select Project"
        options={projectOptions}
        selected={projectId}
        onSelect={setProjectId}
      />
      <PickerModal
        visible={memberPickerOpen}
        onClose={() => setMemberPickerOpen(false)}
        title="Select Team Member"
        options={memberOptions}
        selected={memberId}
        onSelect={setMemberId}
      />
      <PickerModal
        visible={taskTypePickerOpen}
        onClose={() => setTaskTypePickerOpen(false)}
        title="Select Task Type"
        options={TASK_TYPE_OPTIONS}
        selected={taskType}
        onSelect={setTaskType}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  filtersContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    padding: spacing.sm,
  },
  filterRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  filterButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: borderRadius.button,
    paddingHorizontal: spacing.sm,
    minHeight: 44,
    backgroundColor: '#fff',
  },
  filterLabel: {
    flex: 1,
    fontSize: typography.sizes.caption,
    color: colors.text,
  },
  dateFilterRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  dateField: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 11,
    color: '#666',
    marginBottom: 2,
  },
  dateInput: {
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: borderRadius.button,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    fontSize: typography.sizes.caption,
    color: colors.text,
    backgroundColor: '#fff',
    minHeight: 44,
  },
  summary: {
    fontSize: typography.sizes.caption,
    color: '#666',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  listContent: {
    padding: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  entryCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: borderRadius.card,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  entryDate: {
    fontSize: typography.sizes.body2,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  entryHours: {
    fontSize: typography.sizes.body2,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  entryMember: {
    fontSize: typography.sizes.body2,
    color: colors.text,
  },
  entryProject: {
    fontSize: typography.sizes.caption,
    color: '#666',
    marginBottom: 6,
  },
  entryFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  taskTypeChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: borderRadius.chip,
  },
  taskTypeText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: typography.weights.medium,
  },
  entryNotes: {
    flex: 1,
    fontSize: 11,
    color: '#999',
  },
  emptyText: {
    fontSize: typography.sizes.body2,
    color: '#999',
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
});
