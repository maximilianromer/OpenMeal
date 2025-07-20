import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useState, useEffect } from 'react';
import 'react-native-reanimated';
import * as Notifications from 'expo-notifications';
import { DeviceEventEmitter, AppState } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import NetInfo from '@react-native-community/netinfo';

import { useColorScheme } from '@/hooks/useColorScheme';
import { OnboardingScreen } from '@/components/OnboardingScreen';
import OnboardingService from '@/services/OnboardingService';
import MealRemindersService from '@/services/MealRemindersService';
import { resumePending } from '@/services/AnalysisProcessor';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    'TikTokSans-Light': require('../assets/fonts/TikTokSans-Light.ttf'),
    'TikTokSans-Regular': require('../assets/fonts/TikTokSans-Regular.ttf'),
    'TikTokSans-Medium': require('../assets/fonts/TikTokSans-Medium.ttf'),
    'TikTokSans-SemiBold': require('../assets/fonts/TikTokSans-SemiBold.ttf'),
    'TikTokSans-Bold': require('../assets/fonts/TikTokSans-Bold.ttf'),
    'TikTokSans-ExtraBold': require('../assets/fonts/TikTokSans-ExtraBold.ttf'),
    'TikTokSans-Black': require('../assets/fonts/TikTokSans-Black.ttf'),
  });
  const [isOnboardingComplete, setIsOnboardingComplete] = useState<boolean | null>(null);

  useEffect(() => {
    checkOnboardingStatus();
    const cleanupNotifications = setupNotifications();
    const cleanupAnalysisResumption = setupAnalysisResumption();
    
    // Handle app state changes
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'background') {
        // App is going to background - cleanup resources if needed
        console.log('App going to background');
      } else if (nextAppState === 'active') {
        // App is becoming active - reinitialize if needed
        console.log('App becoming active');
        // Resume any pending meal analyses when app becomes active
        if (isOnboardingComplete) {
          resumePending();
        }
      }
    };

    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      // Cleanup notifications when component unmounts
      if (cleanupNotifications) {
        cleanupNotifications.then(cleanup => cleanup && cleanup());
      }
      if (cleanupAnalysisResumption) {
        cleanupAnalysisResumption.then(cleanup => cleanup && cleanup());
      }
      appStateSubscription.remove();
      // Cleanup the service when app unmounts
      MealRemindersService.cleanup();
    };
  }, [isOnboardingComplete]);

  const setupAnalysisResumption = async () => {
    try {
      // Only set up analysis resumption if onboarding is complete
      if (!isOnboardingComplete) {
        return null;
      }

      // Run initial resume check
      await resumePending();

      // Set up network state monitoring
      const unsubscribe = NetInfo.addEventListener(state => {
        if (state.isConnected && state.isInternetReachable) {
          console.log('Network connectivity restored, resuming pending analyses');
          resumePending();
        }
      });

      return () => {
        unsubscribe();
      };
    } catch (error) {
      console.error('Error setting up analysis resumption:', error);
      return null;
    }
  };

  const setupNotifications = async () => {
    try {
      // Initialize meal reminders service
      await MealRemindersService.initialize();

      // Handle notification responses (when user taps on notification)
      const subscription = Notifications.addNotificationResponseReceivedListener(response => {
        const data = response.notification.request.content.data;
        if (data?.action === 'open_add_meal') {
          // Emit event to open AddMealModal
          DeviceEventEmitter.emit('openAddMealModal');
        }
      });

      return () => {
        subscription.remove();
      };
    } catch (error) {
      console.error('Error setting up notifications:', error);
      return null;
    }
  };

  const checkOnboardingStatus = async () => {
    try {
      const isComplete = await OnboardingService.isOnboardingComplete();
      setIsOnboardingComplete(isComplete);
    } catch (error) {
      console.error('Error checking onboarding status:', error);
      setIsOnboardingComplete(false);
    }
  };

  const handleOnboardingComplete = () => {
    setIsOnboardingComplete(true);
  };

  if (!loaded || isOnboardingComplete === null) {
    // Async font loading only occurs in development.
    return null;
  }

  if (!isOnboardingComplete) {
    return (
      <SafeAreaProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <OnboardingScreen onComplete={handleOnboardingComplete} />
          <StatusBar style="auto" />
        </ThemeProvider>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="+not-found" />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
