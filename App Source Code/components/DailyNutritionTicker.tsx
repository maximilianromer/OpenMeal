
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, DeviceEventEmitter } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { RingProgress } from '@/components/RingProgress';
import DailyGoalsService, { DailyGoals } from '@/services/DailyGoalsService';

interface NutritionTickerProps {
  nutrition: {
    calories: number;
    protein: number;
    fats: number;
    carbs: number;
  };
}

export function DailyNutritionTicker({ nutrition }: NutritionTickerProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [goals, setGoals] = useState<DailyGoals>({
    calories: 2000,
    protein: 150,
    fats: 65,
    carbs: 250,
  });

  // Provide default values if nutrition is undefined
  const safeNutrition = nutrition || {
    calories: 0,
    protein: 0,
    fats: 0,
    carbs: 0,
  };

  useEffect(() => {
    loadGoals();

    // Listen for goal updates
    const goalsUpdatedListener = DeviceEventEmitter.addListener(
      'dailyGoalsUpdated',
      () => {
        loadGoals(); // Reload goals from storage
      }
    );

    return () => {
      goalsUpdatedListener.remove();
    };
  }, []);

  const loadGoals = async () => {
    try {
      const dailyGoals = await DailyGoalsService.getDailyGoals();
      setGoals(dailyGoals);
    } catch (error) {
      console.error('Error loading goals:', error);
    }
  };

  return (
    <ThemedView style={[
      styles.container, 
      { 
        borderColor: colors.text + '20',
        backgroundColor: colors.cardBackground 
      }
    ]}>
      <View style={styles.ringsRow}>
        <RingProgress
          value={safeNutrition.calories}
          goal={goals.calories}
          size={70}
          strokeWidth={4}
          color="#FFA726"
          label="Calories"
          unit="kcal"
        />
        <RingProgress
          value={safeNutrition.protein}
          goal={goals.protein}
          size={70}
          strokeWidth={4}
          color="#EF5350"
          label="Protein"
          unit="g"
        />
        <RingProgress
          value={safeNutrition.fats}
          goal={goals.fats}
          size={70}
          strokeWidth={4}
          color="#26A69A"
          label="Fats"
          unit="g"
        />
        <RingProgress
          value={safeNutrition.carbs}
          goal={goals.carbs}
          size={70}
          strokeWidth={4}
          color="#FFEE58"
          label="Carbs"
          unit="g"
        />
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  ringsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
});
