import React, { useState, useEffect } from 'react';
import { ScrollView, StyleSheet, RefreshControl, Alert } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import FileSystemStorageService, { MealAnalysis } from '@/services/FileSystemStorageService';
import { MealHistoryCard } from '@/components/MealHistoryCard';
import { EmptyState } from '@/components/EmptyState';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function HistoryScreen() {
  const colorScheme = useColorScheme();
  const [meals, setMeals] = useState<MealAnalysis[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadMeals = async () => {
    try {
      const mealHistory = await FileSystemStorageService.getMealHistory();
      setMeals(mealHistory);
    } catch (error) {
      console.error('Error loading meals:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadMeals();
    setRefreshing(false);
  };

  const deleteMeal = async (mealId: string) => {
    Alert.alert(
      'Delete Meal',
      'Are you sure you want to delete this meal analysis?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await FileSystemStorageService.deleteMeal(mealId);
              await loadMeals();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete meal');
            }
          },
        },
      ]
    );
  };

  useEffect(() => {
    loadMeals();
  }, []);

  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.header}>
        <ThemedText type="title" style={styles.title}>Meal History</ThemedText>
        <ThemedText style={styles.subtitle}>
          {meals.length > 0 ? `${meals.length} meal${meals.length !== 1 ? 's' : ''} analyzed` : 'No meals yet'}
        </ThemedText>
      </ThemedView>

      {meals.length === 0 ? (
        <EmptyState />
      ) : (
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {meals.map((meal) => (
            <MealHistoryCard
              key={meal.id}
              meal={meal}
              onDelete={() => deleteMeal(meal.id)}
            />
          ))}
        </ScrollView>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.7,
  },
  scrollView: {
    flex: 1,
  },
});