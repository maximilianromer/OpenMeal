import AsyncStorage from '@react-native-async-storage/async-storage';

export interface UserProfile {
  age: number;
  gender: 'male' | 'female';
  heightCm: number;
  weightKg: number;
  activityLevel: number; // 1-5
  goal: 'lose' | 'maintain' | 'gain';
  units: 'imperial' | 'metric';
}

class UserProfileService {
  private static PROFILE_KEY = 'openmeal_user_profile';
  private static AI_MODEL_KEY = 'openmeal_ai_model';

  async saveProfile(profile: UserProfile): Promise<void> {
    await AsyncStorage.setItem(
      UserProfileService.PROFILE_KEY,
      JSON.stringify(profile)
    );
  }

  async getProfile(): Promise<UserProfile | null> {
    const json = await AsyncStorage.getItem(UserProfileService.PROFILE_KEY);
    return json ? JSON.parse(json) : null;
  }

  async clearProfile(): Promise<void> {
    await AsyncStorage.removeItem(UserProfileService.PROFILE_KEY);
  }

  async saveAIModel(model: string): Promise<void> {
    await AsyncStorage.setItem(UserProfileService.AI_MODEL_KEY, model);
  }

  async getAIModel(): Promise<string> {
    const model = await AsyncStorage.getItem(UserProfileService.AI_MODEL_KEY);
    return model || 'gemini-2.5-flash'; // Default to Gemini 2.5 Flash
  }

  async clearAIModel(): Promise<void> {
    await AsyncStorage.removeItem(UserProfileService.AI_MODEL_KEY);
  }
}

export default new UserProfileService();
