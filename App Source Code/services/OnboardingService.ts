
import * as SecureStore from 'expo-secure-store';
import UserProfileService from './UserProfileService';

class OnboardingService {
  static async isOnboardingComplete(): Promise<boolean> {
    try {
      const apiKey = await SecureStore.getItemAsync('GEMINI_API_KEY');
      return !!apiKey;
    } catch (error) {
      console.error('Error checking onboarding status:', error);
      return false;
    }
  }

  static async saveApiKey(apiKey: string): Promise<void> {
    try {
      await SecureStore.setItemAsync('GEMINI_API_KEY', apiKey);
    } catch (error) {
      console.error('Error saving API key:', error);
      throw error;
    }
  }

  static async clearOnboarding(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync('GEMINI_API_KEY');
      await UserProfileService.clearProfile();
    } catch (error) {
      console.error('Error clearing onboarding:', error);
      throw error;
    }
  }
}

export default OnboardingService;
