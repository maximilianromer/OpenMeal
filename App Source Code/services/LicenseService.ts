import { Alert, Platform } from 'react-native';

export async function openLicenses() {
  try {
    // Dynamically require the module to avoid top-level initialization crash
    const { ReactNativeLegal } = require('react-native-legal');

    if (ReactNativeLegal) {
      ReactNativeLegal.launchLicenseListScreen('Open Source Licenses');
    } else {
      throw new Error('Module not found');
    }
  } catch (error) {
    console.warn('ReactNativeLegal module not available:', error);
    Alert.alert(
      'Licenses',
      'Open Source Licenses viewer is not available in this build.'
    );
  }
}
