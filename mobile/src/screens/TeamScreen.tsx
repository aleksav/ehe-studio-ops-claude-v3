import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { colors, spacing, borderRadius, typography } from '@ehestudio-ops/shared';
import { api, ApiError } from '../lib/api';

interface TeamMember {
  id: string;
  full_name: string;
  email: string;
  preferred_task_type: string | null;
  is_active: boolean;
}

const TASK_TYPE_LABELS: Record<string, string> = {
  ARCHITECTURE_ENGINEERING_DIRECTION: 'Arch & Eng',
  DESIGN_DELIVERY_RESEARCH: 'Design & Research',
  DEVELOPMENT_TESTING: 'Dev & Testing',
  BUSINESS_SUPPORT: 'Business Support',
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function validatePassword(password: string): string {
  if (password.length < 8) return 'Password must be at least 8 characters';
  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
    return 'Must contain uppercase, lowercase, and a number';
  }
  return '';
}

export default function TeamScreen() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Password modal state
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [passwordMember, setPasswordMember] = useState<TeamMember | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);

  const fetchMembers = useCallback(async () => {
    try {
      const data = await api.get<TeamMember[]>('/api/team-members');
      setMembers(data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchMembers();
  }, [fetchMembers]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchMembers();
    setRefreshing(false);
  };

  const handleOpenPasswordModal = (member: TeamMember) => {
    setPasswordMember(member);
    setNewPassword('');
    setPasswordError('');
    setPasswordModalVisible(true);
  };

  const handleClosePasswordModal = () => {
    if (passwordSubmitting) return;
    setPasswordModalVisible(false);
    setPasswordMember(null);
  };

  const handlePasswordSubmit = async () => {
    const error = validatePassword(newPassword);
    if (error) {
      setPasswordError(error);
      return;
    }
    if (!passwordMember || passwordSubmitting) return;

    setPasswordSubmitting(true);
    try {
      await api.put(`/api/team-members/${passwordMember.id}/password`, {
        new_password: newPassword,
      });
      Alert.alert('Success', `Password updated for "${passwordMember.full_name}".`);
      setPasswordModalVisible(false);
      setPasswordMember(null);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
      Alert.alert('Error', message);
    } finally {
      setPasswordSubmitting(false);
    }
  };

  const renderMember = ({ item }: { item: TeamMember }) => (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.avatar}>
          <Text style={styles.initials}>{getInitials(item.full_name)}</Text>
        </View>
        <View style={styles.info}>
          <Text style={styles.name}>{item.full_name}</Text>
          <Text style={styles.email} numberOfLines={1}>
            {item.email}
          </Text>
        </View>
      </View>
      <View style={styles.chipsRow}>
        <View
          style={[
            styles.chip,
            {
              backgroundColor: item.is_active ? '#E8F5E9' : '#F5F5F5',
            },
          ]}
        >
          <Text style={[styles.chipText, { color: item.is_active ? '#4CAF50' : '#999' }]}>
            {item.is_active ? 'Active' : 'Inactive'}
          </Text>
        </View>
        {item.preferred_task_type && (
          <View style={styles.chipOutline}>
            <Text style={styles.chipOutlineText}>
              {TASK_TYPE_LABELS[item.preferred_task_type] ?? item.preferred_task_type}
            </Text>
          </View>
        )}
      </View>
      <TouchableOpacity style={styles.passwordButton} onPress={() => handleOpenPasswordModal(item)}>
        <Text style={styles.passwordButtonText}>Change Password</Text>
      </TouchableOpacity>
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
    <View style={{ flex: 1 }}>
      <FlatList
        data={members}
        keyExtractor={(item) => item.id}
        renderItem={renderMember}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No team members found.</Text>
          </View>
        }
      />

      {/* Change Password Modal */}
      <Modal
        visible={passwordModalVisible}
        transparent
        animationType="slide"
        onRequestClose={handleClosePasswordModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              Change Password{passwordMember ? ` — ${passwordMember.full_name}` : ''}
            </Text>
            <TextInput
              style={[styles.modalInput, passwordError ? styles.modalInputError : undefined]}
              placeholder="New password"
              secureTextEntry
              value={newPassword}
              onChangeText={(text) => {
                setNewPassword(text);
                if (passwordError) setPasswordError(validatePassword(text));
              }}
              autoFocus
            />
            {passwordError ? (
              <Text style={styles.errorText}>{passwordError}</Text>
            ) : (
              <Text style={styles.hintText}>
                Min 8 characters with uppercase, lowercase, and a number
              </Text>
            )}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={handleClosePasswordModal}
                disabled={passwordSubmitting}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalSubmitButton,
                  (!newPassword || passwordSubmitting) && styles.modalSubmitDisabled,
                ]}
                onPress={handlePasswordSubmit}
                disabled={!newPassword || passwordSubmitting}
              >
                {passwordSubmitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalSubmitText}>Update Password</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
  },
  list: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
    backgroundColor: '#FAFAFA',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: borderRadius.card,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  initials: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: typography.sizes.body1,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  email: {
    fontSize: typography.sizes.body2,
    color: '#666',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.chip,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  chipOutline: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.chip,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  chipOutlineText: {
    fontSize: 11,
    color: '#666',
  },
  emptyContainer: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: typography.sizes.body2,
    color: '#999',
  },
  passwordButton: {
    marginTop: spacing.sm,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    alignSelf: 'flex-start',
    borderRadius: borderRadius.chip,
    backgroundColor: '#F0F0F0',
  },
  passwordButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: borderRadius.card,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: typography.sizes.body1,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: typography.sizes.body1,
    color: colors.text,
  },
  modalInputError: {
    borderColor: '#D32F2F',
  },
  errorText: {
    fontSize: 12,
    color: '#D32F2F',
    marginTop: 4,
  },
  hintText: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  modalCancelButton: {
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
  },
  modalCancelText: {
    fontSize: typography.sizes.body1,
    color: '#666',
    fontWeight: '600',
  },
  modalSubmitButton: {
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
    borderRadius: 8,
    backgroundColor: colors.primary,
  },
  modalSubmitDisabled: {
    opacity: 0.5,
  },
  modalSubmitText: {
    fontSize: typography.sizes.body1,
    color: '#fff',
    fontWeight: '600',
  },
});
