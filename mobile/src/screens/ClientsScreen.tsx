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
} from 'react-native';
import { colors, spacing, borderRadius, typography } from '@ehestudio-ops/shared';
import { api, ApiError } from '../lib/api';

interface Client {
  id: string;
  name: string;
  contact_name: string | null;
  contact_email: string | null;
}

export default function ClientsScreen() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [formName, setFormName] = useState('');
  const [formContact, setFormContact] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchClients = useCallback(async () => {
    try {
      const data = await api.get<Client[]>('/api/clients');
      setClients([...data].sort((a, b) => a.name.localeCompare(b.name)));
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchClients();
  }, [fetchClients]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchClients();
    setRefreshing(false);
  };

  const handleCreate = async () => {
    if (!formName.trim()) return;
    setSaving(true);
    try {
      await api.post('/api/clients', {
        name: formName.trim(),
        contact_name: formContact.trim() || undefined,
        contact_email: formEmail.trim() || undefined,
      });
      setModalVisible(false);
      setFormName('');
      setFormContact('');
      setFormEmail('');
      await fetchClients();
    } catch (err) {
      Alert.alert('Error', err instanceof ApiError ? err.message : 'Failed to create client.');
    } finally {
      setSaving(false);
    }
  };

  const renderClient = ({ item }: { item: Client }) => (
    <View style={styles.card}>
      <Text style={styles.clientName}>{item.name}</Text>
      {item.contact_name && <Text style={styles.clientInfo}>{item.contact_name}</Text>}
      {item.contact_email && <Text style={styles.clientInfo}>{item.contact_email}</Text>}
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
        data={clients}
        keyExtractor={(item) => item.id}
        renderItem={renderClient}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <TouchableOpacity style={styles.addButton} onPress={() => setModalVisible(true)}>
            <Text style={styles.addButtonText}>+ New Client</Text>
          </TouchableOpacity>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No clients yet. Create one to get started.</Text>
          </View>
        }
      />

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>New Client</Text>
            <TouchableOpacity onPress={handleCreate} disabled={!formName.trim() || saving}>
              <Text
                style={[styles.modalSave, (!formName.trim() || saving) && styles.modalSaveDisabled]}
              >
                {saving ? 'Saving...' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.modalForm}>
            <Text style={styles.fieldLabel}>Client Name *</Text>
            <TextInput
              style={styles.input}
              value={formName}
              onChangeText={setFormName}
              placeholder="Client name"
              placeholderTextColor="#999"
              autoFocus
            />
            <Text style={styles.fieldLabel}>Contact Name</Text>
            <TextInput
              style={styles.input}
              value={formContact}
              onChangeText={setFormContact}
              placeholder="Contact name"
              placeholderTextColor="#999"
            />
            <Text style={styles.fieldLabel}>Contact Email</Text>
            <TextInput
              style={styles.input}
              value={formEmail}
              onChangeText={setFormEmail}
              placeholder="Contact email"
              placeholderTextColor="#999"
              keyboardType="email-address"
              autoCapitalize="none"
            />
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
  clientName: {
    fontSize: typography.sizes.h4,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  clientInfo: {
    fontSize: typography.sizes.body2,
    color: '#666',
    marginTop: 2,
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
});
