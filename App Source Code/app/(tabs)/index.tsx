import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, DeviceEventEmitter, LogBox } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import FileSystemStorageService, { MealAnalysis } from '@/services/FileSystemStorageService';
import { MealTimelineCard } from '@/components/MealTimelineCard';
import { DailyNutritionTicker } from '@/components/DailyNutritionTicker';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { AppHeader } from '@/components/AppHeader';

// Suppress expo-notifications warnings since we're only using local notifications
LogBox.ignoreLogs([
  'expo-notifications',
  'Push notifications (remote notifications) functionality provided by expo-notifications was removed from Expo Go',
  'expo-notifications functionality is not fully supported in Expo Go'
]);

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [meals, setMeals] = useState<MealAnalysis[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [greeting, setGreeting] = useState('');
  const [dailyNutrition, setDailyNutrition] = useState({
    calories: 0,
    protein: 0,
    fats: 0,
    carbs: 0
  });
  const scrollViewRef = useRef<ScrollView>(null);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
    },
    scrollContainer: {
      flex: 1,
    },
    content: {
      paddingHorizontal: 16,
      paddingBottom: 80,
    },
    timeline: {
      marginTop: 20,
    },
    dateGroup: {
      marginBottom: 20,
    },
    dateHeader: {
      paddingVertical: 8,
      paddingHorizontal: 4,
      marginBottom: 8,
    },
    dateHeaderText: {
      fontSize: 14,
      fontFamily: 'TikTokSans-SemiBold',
      opacity: 0.6,
      textTransform: 'uppercase',
    },
    emptyState: {
      paddingVertical: 40,
      alignItems: 'center',
    },
    emptyText: {
      fontSize: 16,
      opacity: 0.6,
      textAlign: 'center',
    },
    greetingContainer: {
      paddingHorizontal: 20,
      paddingVertical: 10,
    },
    greetingText: {
      fontSize: 20,
      fontFamily: 'TikTokSans-Bold',
      textAlign: 'left',
    },
    dayCard: {
      backgroundColor: colors.cardBackground,
      borderRadius: 16,
      marginBottom: 20,
      overflow: 'hidden',
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 3,
    },
    dayCardHeader: {
      paddingTop: 16,
      paddingBottom: 6,
      paddingHorizontal: 20,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.text + '08',
    },
    dayCardHeaderText: {
      fontSize: 14,
      fontFamily: 'TikTokSans-SemiBold',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      opacity: 0.7,
    },
    dayCardContent: {
      paddingTop: 8,
      paddingBottom: 0,
    },
    emptyDayContent: {
      alignItems: 'center',
      paddingVertical: 32,
      paddingHorizontal: 20,
    },
    emptyDayText: {
      fontSize: 13,
      fontStyle: 'italic',
      letterSpacing: 0.3,
    },
  });

  const getTimeBasedGreeting = () => {
    const currentHour = new Date().getHours();
    
    const greetings = {
      morning: [
        "Good morning! 🌅",
        "Rise and shine! 🌅",
        "Have a great day! 🌅",
        "Morning! 🌅",
        "G'day! 🌅",
        "Slept well? 🌅"
      ],
      afternoon: [
        "Good afternoon! ☀️",
        "Hello there! ☀️",
        "Hi! ☀️",
        "Howdy! ☀️",
        "Afternoon's Greetings! ☀️",
        "Today is the day! ☀️"
      ],
      evening: [
        "Good evening! 🌆",
        "Nice to see you! 🌆",
        "Hi there! 🌆",
        "Enjoy your evening! 🌆",
        "Fun plans tonight? 🌆"
      ],
      lateNight: [
        "Good night! 🌙",
        "Working late? 🌙",
        "It's late. Time to rest! 🌙",
        "Up early? 🌙",
        "You should be sleeping! 🌙"
      ]
    };

    let selectedGreetings;
    
    if (currentHour >= 5 && currentHour < 12) {
      selectedGreetings = greetings.morning;
    } else if (currentHour >= 12 && currentHour < 17) {
      selectedGreetings = greetings.afternoon;
    } else if (currentHour >= 17 && currentHour < 24) {
      selectedGreetings = greetings.evening;
    } else {
      selectedGreetings = greetings.lateNight;
    }

    const randomIndex = Math.floor(Math.random() * selectedGreetings.length);
    return selectedGreetings[randomIndex];
  };

  const loadMeals = async () => {
    try {
      const mealHistory = await FileSystemStorageService.getMealHistory();
      setMeals(mealHistory);
      calculateDailyNutrition(mealHistory);
    } catch (error) {
      console.error('Error loading meals:', error);
    }
  };

  const addMealToState = (meal: MealAnalysis) => {
    setMeals(prevMeals => {
      // Check if meal already exists to avoid duplicates
      const existingIndex = prevMeals.findIndex(m => m.id === meal.id);
      if (existingIndex >= 0) {
        // Update existing meal
        const updatedMeals = [...prevMeals];
        updatedMeals[existingIndex] = meal;
        calculateDailyNutrition(updatedMeals);
        return updatedMeals;
      } else {
        // Add new meal
        const newMeals = [meal, ...prevMeals];
        calculateDailyNutrition(newMeals);
        return newMeals;
      }
    });
  };

  const updateMealInState = (updatedMeal: MealAnalysis) => {
    setMeals(prevMeals => {
      const updatedMeals = prevMeals.map(meal => 
        meal.id === updatedMeal.id ? updatedMeal : meal
      );
      calculateDailyNutrition(updatedMeals);
      return updatedMeals;
    });
  };

  const calculateDailyNutrition = (mealHistory: MealAnalysis[]) => {
    const today = new Date().toDateString();
    const todaysMeals = mealHistory.filter(meal => 
      new Date(meal.timestamp).toDateString() === today && 
      meal.analysis && !meal.isLoading && !meal.hasError
    );

    const totals = todaysMeals.reduce((acc, meal) => {
      const nutrition = meal.analysis.total_meal_nutritional_values;
      return {
        calories: acc.calories + (nutrition.total_calories || 0),
        protein: acc.protein + (nutrition.total_protein_g || 0),
        fats: acc.fats + (nutrition.total_total_fat_g || 0),
        carbs: acc.carbs + (nutrition.total_total_carbohydrate_g || 0)
      };
    }, { calories: 0, protein: 0, fats: 0, carbs: 0 });

    setDailyNutrition(totals);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadMeals();
    setRefreshing(false);
  };

  const groupMealsByDate = (meals: MealAnalysis[]) => {
    const grouped = meals.reduce((acc, meal) => {
      const date = new Date(meal.timestamp).toDateString();
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(meal);
      return acc;
    }, {} as Record<string, MealAnalysis[]>);

    // Sort meals within each date group by timestamp (most recent first)
    Object.values(grouped).forEach(dateMeals => {
      dateMeals.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    });

    return Object.entries(grouped).sort((a, b) => 
      new Date(b[0]).getTime() - new Date(a[0]).getTime()
    );
  };

  const formatDateHeader = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return `Today - ${date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`;
    } else if (date.toDateString() === yesterday.toDateString()) {
      return `Yesterday - ${date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`;
    } else {
      return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    }
  };

  useFocusEffect(
    useCallback(() => {
      const initializeApp = async () => {
        try {
          await FileSystemStorageService.initializeStorage();
          await loadMeals();
        } catch (error) {
          console.error('Error initializing app:', error);
        }
      };
      initializeApp();
    }, [])
  );

  useEffect(() => {
    loadMeals();
    setGreeting(getTimeBasedGreeting());

    // Set up event listeners for real-time updates
    const mealAddedListener = DeviceEventEmitter.addListener('mealAdded', addMealToState);
    const mealUpdatedListener = DeviceEventEmitter.addListener('mealUpdated', updateMealInState);
    const mealDeletedListener = DeviceEventEmitter.addListener('mealDeleted', loadMeals);
    const scrollToTopListener = DeviceEventEmitter.addListener('scrollToTop', () => {
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    });

    return () => {
      mealAddedListener.remove();
      mealUpdatedListener.remove();
      mealDeletedListener.remove();
      scrollToTopListener.remove();
    };
  }, []);

  const onMealAdded = () => {
    // No need to manually refresh - event system handles this
  };

  const groupedMeals = groupMealsByDate(meals);

  // Check if today has any meals
  const today = new Date().toDateString();
  const hasTodayMeals = meals.some(meal => 
    new Date(meal.timestamp).toDateString() === today
  );

  return (
    <ThemedView style={styles.container}>
      <AppHeader title="OpenMeal" />
      
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {greeting && (
          <View style={styles.greetingContainer}>
            <ThemedText style={[styles.greetingText, { color: colors.text }]}>
              {greeting}
            </ThemedText>
          </View>
        )}

        <View style={styles.content}>
          <DailyNutritionTicker nutrition={dailyNutrition} />

          <View style={styles.timeline}>
            {/* Show today's card even if empty */}
            {!hasTodayMeals && (
              <View style={[styles.dayCard, { backgroundColor: colors.cardBackground }]}>
                <View style={styles.dayCardHeader}>
                  <ThemedText style={styles.dayCardHeaderText}>
                    {formatDateHeader(today)}
                  </ThemedText>
                </View>
                <View style={styles.emptyDayContent}>
                  <ThemedText style={[styles.emptyDayText, { color: colors.text + '50' }]}>
                    Log your first meal of the day!
                  </ThemedText>
                </View>
              </View>
            )}

            {groupedMeals.length === 0 && !hasTodayMeals ? (
              <ThemedView style={styles.emptyState}>
                <ThemedText style={styles.emptyText}>
                  Welcome! Start tracking your nutrition journey.
                </ThemedText>
              </ThemedView>
            ) : (
              groupedMeals.map(([dateString, dateMeals]) => (
                <View key={dateString} style={[styles.dayCard, { backgroundColor: colors.cardBackground }]}>
                  <View style={styles.dayCardHeader}>
                    <ThemedText style={styles.dayCardHeaderText}>
                      {formatDateHeader(dateString)}
                    </ThemedText>
                  </View>
                  <View style={styles.dayCardContent}>
                    {dateMeals.map((meal) => (
                      <MealTimelineCard key={meal.id} meal={meal} onDelete={loadMeals} />
                    ))}
                  </View>
                </View>
              ))
            )}
          </View>
        </View>
      </ScrollView>
    </ThemedView>
  );
}