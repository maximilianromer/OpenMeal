
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface DailyGoals {
  calories: number;
  protein: number;
  fats: number;
  carbs: number;
}

const DEFAULT_GOALS: DailyGoals = {
  calories: 2000,
  protein: 150,
  fats: 65,
  carbs: 250,
};

class DailyGoalsService {
  private static GOALS_KEY = 'openmeal_daily_goals';

  async getDailyGoals(): Promise<DailyGoals> {
    try {
      const goalsJson = await AsyncStorage.getItem(DailyGoalsService.GOALS_KEY);
      return goalsJson ? JSON.parse(goalsJson) : DEFAULT_GOALS;
    } catch (error) {
      console.error('Error getting daily goals:', error);
      return DEFAULT_GOALS;
    }
  }

  async saveDailyGoals(goals: DailyGoals): Promise<void> {
    try {
      await AsyncStorage.setItem(DailyGoalsService.GOALS_KEY, JSON.stringify(goals));
    } catch (error) {
      console.error('Error saving daily goals:', error);
      throw error;
    }
  }

  async updateGoal(nutrientType: keyof DailyGoals, value: number): Promise<void> {
    try {
      const currentGoals = await this.getDailyGoals();
      const updatedGoals = {
        ...currentGoals,
        [nutrientType]: value,
      };
      await this.saveDailyGoals(updatedGoals);
    } catch (error) {
      console.error('Error updating goal:', error);
      throw error;
    }
  }
}

export default new DailyGoalsService();
