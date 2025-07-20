import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface MealReminder {
  id: string;
  name: string;
  time: string; // HH:MM format
  enabled: boolean;
  isDefault: boolean;
}

const REMINDERS_KEY = '@OpenMeal/mealReminders';
const NOTIFICATION_CHANNEL_ID = 'meal-reminders';
const PERMISSION_TIMESTAMP_KEY = '@OpenMeal/notificationPermissionTimestamp';

// Default meal reminders
const DEFAULT_REMINDERS: MealReminder[] = [
  { id: 'breakfast', name: 'Breakfast', time: '07:00', enabled: true, isDefault: true },
  { id: 'lunch', name: 'Lunch', time: '12:00', enabled: true, isDefault: true },
  { id: 'dinner', name: 'Dinner', time: '18:00', enabled: true, isDefault: true },
];

class MealRemindersService {
  private initialized = false;
  private cleanupIntervalId: number | null = null;
  private notificationListener: Notifications.Subscription | null = null;
  private scheduledNotifications = new Set<string>();

  async initialize() {
    if (this.initialized) return;

    // Configure notification handler
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
        severity: 'high' as const,
      }),
    });

    // Create notification channel for Android
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL_ID, {
        name: 'Meal Reminders',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
        sound: 'default',
      });
    }

    // Set up notification received handler to clear old notifications
    this.notificationListener = Notifications.addNotificationReceivedListener(async (notification) => {
      // Clear all previous meal reminder notifications when a new one arrives
      const allNotifications = await Notifications.getPresentedNotificationsAsync();
      for (const oldNotification of allNotifications) {
        if (oldNotification.request.identifier !== notification.request.identifier &&
            oldNotification.request.content.data?.reminderId) {
          await Notifications.dismissNotificationAsync(oldNotification.request.identifier);
        }
      }
    });

    // Schedule automatic notification expiration cleanup
    this.scheduleNotificationCleanup();
    
    // Load scheduled notifications from storage and reschedule if needed
    await this.loadAndRescheduleNotifications();

    this.initialized = true;
  }

  private async scheduleNotificationCleanup() {
    // Clear any existing interval
    if (this.cleanupIntervalId !== null) {
      clearInterval(this.cleanupIntervalId);
    }

    // Check every hour for expired notifications
    this.cleanupIntervalId = setInterval(async () => {
      try {
        const notifications = await Notifications.getPresentedNotificationsAsync();
        const now = Date.now();
        
        for (const notification of notifications) {
          const notificationTime = notification.request.content.data?.timestamp;
          if (notificationTime && typeof notificationTime === 'number' && (now - notificationTime) > 4 * 60 * 60 * 1000) { // 4 hours
            await Notifications.dismissNotificationAsync(notification.request.identifier);
          }
        }
      } catch (error) {
        console.error('Error during notification cleanup:', error);
      }
    }, 60 * 60 * 1000) as unknown as number; // Check every hour
  }

  // Clean up resources
  async cleanup() {
    if (this.cleanupIntervalId !== null) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
    }
    
    if (this.notificationListener) {
      this.notificationListener.remove();
      this.notificationListener = null;
    }
    
    this.initialized = false;
  }

  private async loadAndRescheduleNotifications() {
    try {
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      this.scheduledNotifications = new Set(scheduled.map(n => n.identifier));

      // Check for reminders that need rescheduling
      const reminders = await this.getReminders();
      const now = Date.now();

      for (const reminder of reminders) {
        if (reminder.enabled && !this.scheduledNotifications.has(reminder.id)) {
          // This reminder was likely a one-time notification that has fired.
          // Reschedule it for its next occurrence.
          console.log(`Rescheduling reminder for ${reminder.name}`);
          await this.scheduleNotification(reminder, false);
        }
      }
    } catch (error) {
      console.error('Error during notification load and reschedule:', error);
    }
  }

  private async loadScheduledNotifications() {
    try {
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      this.scheduledNotifications = new Set(scheduled.map(n => n.identifier));
    } catch (error) {
      console.error('Error loading scheduled notifications:', error);
    }
  }

  private async saveScheduledNotifications() {
    try {
      // This method is actually just reloading - the scheduled notifications are managed by the OS
      // We just need to sync our local state with what's actually scheduled
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      this.scheduledNotifications = new Set(scheduled.map(n => n.identifier));
    } catch (error) {
      console.error('Error syncing scheduled notifications:', error);
    }
  }

  async getPermissionStatus(): Promise<boolean> {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted';
  }

  async requestPermissions(): Promise<boolean> {
    try {
      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      });
      
      if (status === 'granted') {
        // Store the timestamp when permission was granted
        await AsyncStorage.setItem(PERMISSION_TIMESTAMP_KEY, Date.now().toString());
        
        // Cancel any existing notifications to prevent duplicates
        await this.cancelAllNotifications();
        
        // Schedule all enabled reminders but NOT immediately
        const reminders = await this.getReminders();
        for (const reminder of reminders) {
          if (reminder.enabled) {
            await this.scheduleNotification(reminder, true); // Pass skipToday flag
          }
        }
      }
      
      return status === 'granted';
    } catch (error) {
      console.error('Error requesting permissions:', error);
      return false;
    }
  }

  async getReminders(): Promise<MealReminder[]> {
    try {
      const stored = await AsyncStorage.getItem(REMINDERS_KEY);
      if (!stored) {
        // Initialize with default reminders
        await this.saveReminders(DEFAULT_REMINDERS);
        return DEFAULT_REMINDERS;
      }
      return JSON.parse(stored);
    } catch (error) {
      console.error('Error loading reminders:', error);
      return DEFAULT_REMINDERS;
    }
  }

  async saveReminders(reminders: MealReminder[]): Promise<void> {
    try {
      await AsyncStorage.setItem(REMINDERS_KEY, JSON.stringify(reminders));
    } catch (error) {
      console.error('Error saving reminders:', error);
      throw error;
    }
  }

  async addReminder(name: string, time: string): Promise<MealReminder> {
    try {
      // Validate inputs
      if (!name || name.trim().length === 0) {
        throw new Error('Reminder name cannot be empty');
      }
      
      if (!time || !time.match(/^(\d{1,2}):(\d{2})$/)) {
        throw new Error('Invalid time format. Expected HH:MM');
      }
      
      const [hours, minutes] = time.split(':').map(Number);
      if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        throw new Error('Invalid time values');
      }
      
      const reminders = await this.getReminders();
      
      // Check for duplicate names
      if (reminders.some(r => r.name.toLowerCase() === name.trim().toLowerCase())) {
        throw new Error('A reminder with this name already exists');
      }
      
      const newReminder: MealReminder = {
        id: `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: name.trim(),
        time,
        enabled: true,
        isDefault: false,
      };
      
      reminders.push(newReminder);
      await this.saveReminders(reminders);
      
      // Schedule notification if permissions are granted
      const hasPermission = await this.getPermissionStatus();
      if (hasPermission && newReminder.enabled) {
        await this.scheduleNotification(newReminder);
      }
      
      return newReminder;
    } catch (error) {
      console.error('Error adding reminder:', error);
      throw error;
    }
  }

  async updateReminder(id: string, updates: Partial<MealReminder>): Promise<void> {
    try {
      const reminders = await this.getReminders();
      const index = reminders.findIndex(r => r.id === id);
      
      if (index === -1) {
        throw new Error(`Reminder with id ${id} not found`);
      }
      
      // Validate time format if being updated
      if (updates.time) {
        if (!updates.time.match(/^(\d{1,2}):(\d{2})$/)) {
          throw new Error('Invalid time format. Expected HH:MM');
        }
        
        const [hours, minutes] = updates.time.split(':').map(Number);
        if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
          throw new Error('Invalid time values');
        }
      }
      
      // Validate name if being updated
      if (updates.name !== undefined) {
        if (!updates.name || updates.name.trim().length === 0) {
          throw new Error('Reminder name cannot be empty');
        }
        
        // Check for duplicate names (excluding current reminder)
        const trimmedName = updates.name.trim().toLowerCase();
        if (reminders.some(r => r.id !== id && r.name.toLowerCase() === trimmedName)) {
          throw new Error('A reminder with this name already exists');
        }
        
        updates.name = updates.name.trim();
      }
      
      const oldReminder = reminders[index];
      reminders[index] = { ...oldReminder, ...updates };
      await this.saveReminders(reminders);
      
      // Cancel old notification
      await this.cancelNotification(id);
      
      // Schedule new notification if enabled and has permission
      const hasPermission = await this.getPermissionStatus();
      if (hasPermission && reminders[index].enabled) {
        await this.scheduleNotification(reminders[index]);
      }
    } catch (error) {
      console.error(`Error updating reminder ${id}:`, error);
      throw error;
    }
  }

  async deleteReminder(id: string): Promise<void> {
    const reminders = await this.getReminders();
    const filtered = reminders.filter(r => r.id !== id);
    await this.saveReminders(filtered);
    await this.cancelNotification(id);
  }

  async toggleReminder(id: string, enabled: boolean): Promise<void> {
    try {
      const reminders = await this.getReminders();
      const reminder = reminders.find(r => r.id === id);
      
      if (!reminder) {
        console.warn(`Reminder with id ${id} not found`);
        return;
      }
      
      // Prevent duplicate operations
      if (reminder.enabled === enabled) return;
      
      // Update the reminder state
      const updatedReminders = reminders.map(r => 
        r.id === id ? { ...r, enabled } : r
      );
      await this.saveReminders(updatedReminders);
      
      // Handle notification scheduling/canceling
      if (enabled) {
        const hasPermission = await this.getPermissionStatus();
        if (hasPermission) {
          // When enabling, check if we just got permissions
          const permissionTimestamp = await AsyncStorage.getItem(PERMISSION_TIMESTAMP_KEY);
          const isRecentPermission = !!permissionTimestamp && 
            (Date.now() - parseInt(permissionTimestamp)) < 60000; // Within last minute
          
          await this.scheduleNotification({ ...reminder, enabled }, isRecentPermission);
        }
      } else {
        // Cancel the notification when disabling
        await this.cancelNotification(id);
      }
    } catch (error) {
      console.error(`Error toggling reminder ${id}:`, error);
      throw error;
    }
  }

  private async scheduleNotification(reminder: MealReminder, skipToday: boolean = false): Promise<void> {
    try {
      // Prevent duplicate scheduling
      if (this.scheduledNotifications.has(reminder.id)) {
        await this.cancelNotification(reminder.id);
      }

      // Validate time format
      const timeMatch = reminder.time.match(/^(\d{1,2}):(\d{2})$/);
      if (!timeMatch) {
        console.error(`Invalid time format for reminder ${reminder.id}: ${reminder.time}`);
        return;
      }

      const hours = parseInt(timeMatch[1]);
      const minutes = parseInt(timeMatch[2]);
      
      if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        console.error(`Invalid time values for reminder ${reminder.id}: ${reminder.time}`);
        return;
      }
      
      // Calculate next occurrence
      const now = new Date();
      const scheduledTime = new Date();
      scheduledTime.setHours(hours, minutes, 0, 0);
      
      // If skipToday is true (first permission grant), always schedule for tomorrow
      if (skipToday) {
        scheduledTime.setDate(scheduledTime.getDate() + 1);
      } else {
        // If the time has already passed today OR is within next 5 minutes, schedule for tomorrow
        const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);
        if (scheduledTime <= fiveMinutesFromNow) {
          scheduledTime.setDate(scheduledTime.getDate() + 1);
        }
      }
      
      // We will schedule a single one-time notification.
      // The app will reschedule it upon next launch if it has fired.
      console.log(`Scheduling notification for ${reminder.name} at ${scheduledTime.toLocaleString()}`);

      await Notifications.scheduleNotificationAsync({
        content: {
          title: `Time for ${reminder.name}! 🍽️`,
          body: 'Tap to log your meal and track your nutrition',
          data: { 
            reminderId: reminder.id,
            mealName: reminder.name,
            action: 'open_add_meal',
            timestamp: Date.now(), // Add timestamp for expiration
          },
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.HIGH,
          categoryIdentifier: 'meal_reminder',
          // Explicitly specify the notification icon for Android
          ...(Platform.OS === 'android' && {
            android: {
              smallIcon: 'ic_notification',
            }
          }),
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: scheduledTime,
        },
        identifier: reminder.id,
      });

      // Track scheduled notification
      this.scheduledNotifications.add(reminder.id);
      await this.saveScheduledNotifications();
    } catch (error) {
      console.error(`Error scheduling notification for ${reminder.name}:`, error);
      throw error; // Re-throw to handle in UI
    }
  }

  private async cancelNotification(reminderId: string): Promise<void> {
    try {
      await Notifications.cancelScheduledNotificationAsync(reminderId);
      this.scheduledNotifications.delete(reminderId);
      await this.saveScheduledNotifications();
    } catch (error) {
      console.error(`Error canceling notification ${reminderId}:`, error);
    }
  }

  async cancelAllNotifications(): Promise<void> {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      this.scheduledNotifications.clear();
      // Also dismiss any presented notifications
      await Notifications.dismissAllNotificationsAsync();
    } catch (error) {
      console.error('Error canceling all notifications:', error);
    }
  }

  // Debug method to get notification status
  async getNotificationStatus(): Promise<{
    permissionStatus: boolean;
    scheduledCount: number;
    presentedCount: number;
    trackedNotifications: string[];
  }> {
    try {
      const permissionStatus = await this.getPermissionStatus();
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      const presented = await Notifications.getPresentedNotificationsAsync();
      
      return {
        permissionStatus,
        scheduledCount: scheduled.length,
        presentedCount: presented.length,
        trackedNotifications: Array.from(this.scheduledNotifications),
      };
    } catch (error) {
      console.error('Error getting notification status:', error);
      return {
        permissionStatus: false,
        scheduledCount: 0,
        presentedCount: 0,
        trackedNotifications: [],
      };
    }
  }
}

export default new MealRemindersService(); 