import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  TextInput,
  Platform,
  StatusBar,
  ActivityIndicator,
  AppState,
  AppStateStatus,
} from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { DateTimePickerModal } from '@/components/DateTimePickerModal';
import MealRemindersService, { MealReminder } from '@/services/MealRemindersService';
import { MaterialIcons } from '@expo/vector-icons';

interface MealRemindersModalProps {
  visible: boolean;
  onClose: () => void;
}

interface AddMealModalState {
  visible: boolean;
  name: string;
}

export function MealRemindersModal({ visible, onClose }: MealRemindersModalProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [hasPermission, setHasPermission] = useState(false);
  const [reminders, setReminders] = useState<MealReminder[]>([]);
  const [selectedReminder, setSelectedReminder] = useState<MealReminder | null>(null);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [addMealModal, setAddMealModal] = useState<AddMealModalState>({ visible: false, name: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [loadingReminderId, setLoadingReminderId] = useState<string | null>(null);
  const appStateRef = useRef(AppState.currentState);
  const toggleDebounceRef = useRef<{ [key: string]: number }>({});

  // Initialize service and load data
  useEffect(() => {
    if (visible) {
      initialize();
    }
  }, [visible]);

  // Check permissions when app comes to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, []);

  const handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (
      appStateRef.current.match(/inactive|background/) &&
      nextAppState === 'active' &&
      visible
    ) {
      // App has come to the foreground, check permissions
      checkPermissions();
    }
    appStateRef.current = nextAppState;
  };

  const initialize = async () => {
    try {
      setIsLoading(true);
      await MealRemindersService.initialize();
      await checkPermissions();
      await loadReminders();
    } catch (error) {
      console.error('Error initializing meal reminders:', error);
      Alert.alert('Error', 'Failed to load meal reminders. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const checkPermissions = async () => {
    try {
      const granted = await MealRemindersService.getPermissionStatus();
      setHasPermission(granted);
    } catch (error) {
      console.error('Error checking permissions:', error);
    }
  };

  const loadReminders = async () => {
    try {
      const loaded = await MealRemindersService.getReminders();
      setReminders(loaded);
    } catch (error) {
      console.error('Error loading reminders:', error);
      Alert.alert('Error', 'Failed to load reminders. Please try again.');
    }
  };

  const handleRequestPermission = async () => {
    try {
      setIsLoading(true);
      const granted = await MealRemindersService.requestPermissions();
      setHasPermission(granted);
      if (!granted) {
        Alert.alert(
          'Permissions Required',
          'Please enable notifications in your device settings to receive meal reminders.'
        );
      } else {
        // Reload reminders to ensure they're properly scheduled
        await loadReminders();
      }
    } catch (error) {
      console.error('Error requesting permissions:', error);
      Alert.alert('Error', 'Failed to request permissions. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleReminder = useCallback(async (reminder: MealReminder) => {
    // Clear any existing debounce for this reminder
    if (toggleDebounceRef.current[reminder.id]) {
      clearTimeout(toggleDebounceRef.current[reminder.id]);
    }

    // Set loading state immediately for responsive UI
    setLoadingReminderId(reminder.id);
    const newEnabled = !reminder.enabled;
    
    // Optimistically update UI
    setReminders(prev => prev.map(r => 
      r.id === reminder.id ? { ...r, enabled: newEnabled } : r
    ));

    // Debounce the actual API call
    toggleDebounceRef.current[reminder.id] = setTimeout(async () => {
      try {
        await MealRemindersService.toggleReminder(reminder.id, newEnabled);
        await loadReminders();
      } catch (error) {
        console.error('Error toggling reminder:', error);
        // Revert on error
        setReminders(prev => prev.map(r => 
          r.id === reminder.id ? { ...r, enabled: !newEnabled } : r
        ));
        Alert.alert('Error', 'Failed to update reminder. Please try again.');
      } finally {
        setLoadingReminderId(null);
        delete toggleDebounceRef.current[reminder.id];
      }
    }, 300);
  }, []);

  const handleDeleteReminder = async (reminder: MealReminder) => {
    Alert.alert(
      'Delete Reminder',
      `Are you sure you want to delete the "${reminder.name}" reminder?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoadingReminderId(reminder.id);
              await MealRemindersService.deleteReminder(reminder.id);
              await loadReminders();
            } catch (error) {
              console.error('Error deleting reminder:', error);
              Alert.alert('Error', 'Failed to delete reminder. Please try again.');
            } finally {
              setLoadingReminderId(null);
            }
          },
        },
      ]
    );
  };

  const handleTimePress = (reminder: MealReminder) => {
    setSelectedReminder(reminder);
    setShowTimePicker(true);
  };

  const handleTimeChange = async (date: Date) => {
    if (!selectedReminder) return;

    try {
      setLoadingReminderId(selectedReminder.id);
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      const newTime = `${hours}:${minutes}`;

      await MealRemindersService.updateReminder(selectedReminder.id, { time: newTime });
      await loadReminders();
      setSelectedReminder(null);
    } catch (error) {
      console.error('Error updating time:', error);
      Alert.alert('Error', 'Failed to update reminder time. Please try again.');
    } finally {
      setLoadingReminderId(null);
    }
  };

  const handleAddMeal = async () => {
    const name = addMealModal.name.trim();
    if (!name) {
      Alert.alert('Required', 'Please enter a meal name.');
      return;
    }

    // Validate meal name length
    if (name.length > 50) {
      Alert.alert('Invalid Name', 'Meal name must be less than 50 characters.');
      return;
    }

    try {
      setIsLoading(true);
      await MealRemindersService.addReminder(name, '12:00');
      await loadReminders();
      setAddMealModal({ visible: false, name: '' });
    } catch (error) {
      console.error('Error adding reminder:', error);
      Alert.alert('Error', 'Failed to add reminder. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (time: string): string => {
    try {
      const [hours, minutes] = time.split(':').map(Number);
      if (isNaN(hours) || isNaN(minutes)) return time;
      
      const period = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
      return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
    } catch {
      return time;
    }
  };

  // Helper function to get contrasting text color for buttons
  const getButtonTextColor = () => {
    // Use background color which always contrasts with tint color
    return colors.background;
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clear all debounce timers
      Object.values(toggleDebounceRef.current).forEach(clearTimeout);
    };
  }, []);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'overFullScreen'}
      onRequestClose={onClose}
      statusBarTranslucent={Platform.OS === 'android'}
      transparent={Platform.OS === 'android'}
    >
      {Platform.OS === 'android' && (
        <View style={styles.androidOverlay} />
      )}

      <ThemedView style={[
        styles.container,
        Platform.OS === 'android' && styles.androidModalContent
      ]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.text + '20' }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <IconSymbol name="xmark" size={24} color={colors.text} />
          </TouchableOpacity>
          <ThemedText style={styles.title}>Meal Reminders</ThemedText>
          <View style={styles.headerSpacer} />
        </View>

        {isLoading && reminders.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.tint} />
          </View>
        ) : (
          <ScrollView style={styles.content}>
            {/* Permissions Section */}
            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>Permissions</ThemedText>
              <View style={[styles.permissionCard, { 
                backgroundColor: colorScheme === 'dark' ? colors.text + '08' : colors.text + '06',
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: colors.text + '15'
              }]}>
                {hasPermission ? (
                  <View style={styles.permissionContent}>
                    <MaterialIcons name="notifications-active" size={24} color="#4CAF50" />
                    <ThemedText style={[styles.permissionStatusText, { marginBottom: 0 }]}>Notifications enabled</ThemedText>
                  </View>
                ) : (
                  <>
                    <ThemedText style={styles.permissionText}>
                      Enable notifications to receive meal reminders
                    </ThemedText>
                    <TouchableOpacity
                      style={[styles.enableButton, { backgroundColor: colors.tint }]}
                      onPress={handleRequestPermission}
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <ActivityIndicator size="small" color={getButtonTextColor()} />
                      ) : (
                        <ThemedText style={[styles.enableButtonText, { color: getButtonTextColor() }]}>
                          Enable Notifications
                        </ThemedText>
                      )}
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>

            {/* Reminders Section */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <ThemedText style={styles.sectionTitle}>Reminders</ThemedText>
                <TouchableOpacity
                  onPress={() => setAddMealModal({ visible: true, name: '' })}
                  style={styles.addButton}
                  disabled={!hasPermission}
                >
                  <IconSymbol name="plus" size={20} color={hasPermission ? colors.tint : colors.text + '40'} />
                </TouchableOpacity>
              </View>

              {!hasPermission && (
                <ThemedText style={[styles.disabledText, { color: colors.text + '60' }]}>
                  Enable notifications to manage reminders
                </ThemedText>
              )}

              {reminders.map((reminder) => (
                <View
                  key={reminder.id}
                  style={[styles.reminderItem, { 
                    borderColor: colors.text + '15',
                    backgroundColor: colors.background === '#000000' ? colors.text + '08' : colors.text + '03',
                    opacity: loadingReminderId === reminder.id ? 0.7 : 1,
                  }]}
                >
                  <Switch
                    value={reminder.enabled}
                    onValueChange={() => handleToggleReminder(reminder)}
                    trackColor={{ false: colors.text + '20', true: colors.tint + '80' }}
                    thumbColor={Platform.OS === 'ios' ? '#ffffff' : reminder.enabled ? colors.tint : (colorScheme === 'dark' ? '#666666' : '#f4f3f4')}
                    disabled={!hasPermission || loadingReminderId === reminder.id}
                  />
                  
                  <ThemedText style={styles.reminderName} numberOfLines={1}>
                    {reminder.name}
                  </ThemedText>

                  <TouchableOpacity
                    onPress={() => handleTimePress(reminder)}
                    style={styles.timeButton}
                    disabled={!hasPermission || loadingReminderId === reminder.id}
                  >
                    <ThemedText style={[styles.timeText, { color: hasPermission ? colors.tint : colors.text + '40' }]}>
                      {formatTime(reminder.time)}
                    </ThemedText>
                  </TouchableOpacity>

                  {!reminder.isDefault && (
                    <TouchableOpacity
                      onPress={() => handleDeleteReminder(reminder)}
                      style={styles.deleteButton}
                      disabled={loadingReminderId === reminder.id}
                    >
                      <MaterialIcons name="clear" size={20} color={colors.text + '40'} />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          </ScrollView>
        )}

        {/* Time Picker Modal */}
        {selectedReminder && (
          <DateTimePickerModal
            visible={showTimePicker}
            onClose={() => setShowTimePicker(false)}
            onSave={handleTimeChange}
            initialDate={(() => {
              const [hours, minutes] = selectedReminder.time.split(':').map(Number);
              const date = new Date();
              date.setHours(hours, minutes, 0, 0);
              return date;
            })()}
            mode="time"
            title={`Set time for ${selectedReminder.name}`}
          />
        )}

        {/* Add Meal Modal */}
        <Modal
          visible={addMealModal.visible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setAddMealModal({ visible: false, name: '' })}
        >
          <View style={[styles.modalOverlay, { backgroundColor: colorScheme === 'dark' ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)' }]}>
            <View style={[styles.addMealModalContent, { backgroundColor: colors.background }]}>
              <ThemedText style={styles.addMealTitle}>Add Custom Meal</ThemedText>
              
              <TextInput
                style={[styles.mealNameInput, { 
                  borderColor: colors.text + '30',
                  color: colors.text,
                  backgroundColor: colorScheme === 'dark' ? colors.text + '05' : colors.background
                }]}
                placeholder="Enter meal name..."
                placeholderTextColor={colors.text + '60'}
                value={addMealModal.name}
                onChangeText={(text) => setAddMealModal({ ...addMealModal, name: text })}
                autoFocus
                maxLength={50}
              />

              <View style={styles.addMealButtons}>
                <TouchableOpacity
                  onPress={() => setAddMealModal({ visible: false, name: '' })}
                  style={styles.modalCancelButton}
                  disabled={isLoading}
                >
                  <ThemedText style={{ color: colors.text }}>Cancel</ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleAddMeal}
                  style={[styles.modalAddButton, { backgroundColor: colors.tint }]}
                  disabled={isLoading || !addMealModal.name.trim()}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color={getButtonTextColor()} />
                  ) : (
                    <ThemedText style={{ color: getButtonTextColor(), fontWeight: '600' }}>Add</ThemedText>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 20 : 0,
  },
  
  // Android-specific overlay and modal styles
  androidOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },

  androidModalContent: {
    marginTop: StatusBar.currentHeight || 44,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 16 : 16,
    paddingBottom: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  closeButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontFamily: 'TikTokSans-Bold',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'TikTokSans-Bold',
    marginBottom: 16,
  },
  addButton: {
    padding: 4,
    marginBottom: 12,
  },
  permissionCard: {
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  permissionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  permissionText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  permissionStatusText: {
    fontSize: 16,
    textAlign: 'center',
  },
  enableButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  enableButtonText: {
    fontSize: 16,
    fontFamily: 'TikTokSans-Bold',
  },
  reminderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 8,
    gap: 16,
  },
  reminderName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
  timeButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  timeText: {
    fontSize: 16,
    fontWeight: '600',
  },
  deleteButton: {
    padding: 4,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  addMealModalContent: {
    width: '100%',
    maxWidth: 300,
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  addMealTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 20,
    textAlign: 'center',
  },
  mealNameInput: {
    borderWidth: 2,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 24,
  },
  addMealButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalAddButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
}); 