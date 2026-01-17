import { Alert } from 'react-native';
import type { MealAnalysis } from './FileSystemStorageService';

// No-op implementation for iOS/Web

export async function hasWritePermission(): Promise<boolean> {
  return false;
}

export async function requestHealthConnectPermission(): Promise<boolean> {
  Alert.alert('Not supported', 'Health Connect is only available on Android devices.');
  return false;
}

export async function writeMealToHealthConnect(meal: MealAnalysis): Promise<void> {
  // No-op
  return;
}

export async function syncMealsToHealthConnect(): Promise<void> {
  Alert.alert('Not supported', 'Health Connect is only available on Android devices.');
}
