import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, DeviceEventEmitter } from 'react-native';
import { Image } from 'expo-image';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import FileSystemStorageService, { MealAnalysis } from '@/services/FileSystemStorageService';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { MealDetailModal } from '@/components/MealDetailModal';
import { retryMeal } from '@/services/AnalysisProcessor';

interface MealTimelineCardProps {
  meal: MealAnalysis;
  onDelete: () => void;
}

const getRandomLoadingText = () => {
  const loadingTexts = [
    'Looking close…',
    'Taste testing…',
    'Consulting the chef…',
    'Stealing the recipe…',
    'Trying not to salivate…',
    'Checking Mom\'s cookbook collection…',
    'Reminding AI to not salivate…',
    'Give me a sec…',
    'Not judging…',
    'Processing pixels into portions...',
    'Converting colors to calories...',
    'Crunching the nutritional numbers...',
    'Confirming this isn\'t cake in disguise…',
    'Diving fork-first into my dataset…'
  ];
  
  return loadingTexts[Math.floor(Math.random() * loadingTexts.length)];
};

export function MealTimelineCard({ meal, onDelete }: MealTimelineCardProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [loadingText] = useState(() => getRandomLoadingText());

  const handleDeleteMeal = async () => {
    try {
      await FileSystemStorageService.deleteMeal(meal.id);
      DeviceEventEmitter.emit('mealDeleted', meal.id);
      onDelete();
    } catch (error) {
      console.error('Error deleting meal:', error);
    }
  };

  const handleRetryMeal = async () => {
    try {
      await retryMeal(meal.id);
    } catch (error) {
      console.error('Error retrying meal:', error);
      Alert.alert('Retry Failed', 'Unable to retry meal analysis. Please try again later.');
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const showDetails = () => {
    if (meal.isLoading || meal.analysis?.isAnalyzing) {
      Alert.alert(
        'Meal Analysis',
        'This meal is still being analyzed. Please wait for the analysis to complete.',
        [
          { 
            text: 'Delete', 
            style: 'destructive',
            onPress: handleDeleteMeal
          },
          {
            text: 'Close',
            style: 'cancel'
          }
        ]
      );
      return;
    }

    if (meal.hasError) {
      Alert.alert(
        'Meal Analysis', 
        'Failed to analyze this meal. Would you like to retry or delete it?', 
        [
          { 
            text: 'Retry', 
            onPress: handleRetryMeal
          },
          { 
            text: 'Delete', 
            style: 'destructive',
            onPress: handleDeleteMeal
          },
          {
            text: 'Cancel',
            style: 'cancel'
          }
        ]
      );
      return;
    }

    setShowDetailModal(true);
  };

  

  const totalCalories = meal.analysis?.total_meal_nutritional_values?.total_calories || 0;
  const totalProtein = meal.analysis?.total_meal_nutritional_values?.total_protein_g || 0;
  const totalFats = meal.analysis?.total_meal_nutritional_values?.total_total_fat_g || 0;
  const totalCarbs = meal.analysis?.total_meal_nutritional_values?.total_total_carbohydrate_g || 0;
  const mainItem = meal.analysis?.meal_items?.[0];
  const itemCount = meal.analysis?.meal_items?.length || 0;
  const isLoading = meal.isLoading || meal.analysis?.isAnalyzing;
  const hasError = meal.hasError;
  const mealTitle = meal.analysis?.title || mainItem?.item_name || 'Unknown Item';

  return (
    <>
      <TouchableOpacity onPress={showDetails} activeOpacity={0.7}>
        <ThemedView style={[
          styles.card, 
          { 
            backgroundColor: colors.cardContentBackground,
            borderColor: colors.text + '10'
          }
        ]}>
          <View style={styles.content}>
            <View style={styles.header}>
              <ThemedText style={styles.itemName}>
                {isLoading ? "Analyzing Meal..." : mealTitle}
              </ThemedText>
              <ThemedText style={[styles.time, { color: colors.text + 'A0' }]}>
                {formatTime(meal.timestamp)}
              </ThemedText>
            </View>

            <View style={styles.nutrition}>
              {isLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color={colors.tint} />
                  <ThemedText style={[styles.loadingText, { color: colors.tint }]}>
                    {loadingText}
                  </ThemedText>
                </View>
              ) : hasError ? (
                <View style={styles.errorContainer}>
                  <IconSymbol name="xmark" size={16} color={colors.text} />
                  <ThemedText style={styles.errorText}>
                    Analysis failed
                  </ThemedText>
                  <TouchableOpacity onPress={handleRetryMeal} style={styles.retryButton}>
                    <ThemedText style={[styles.retryText, { color: colors.tint }]}>
                      Retry
                    </ThemedText>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <ThemedText style={[styles.nutritionText, { color: colors.text + 'CC' }]}>
                    {Math.round(totalCalories)} calories
                  </ThemedText>
                  <ThemedText style={[styles.nutritionText, { color: colors.text + 'CC' }]}>
                    {Math.round(totalProtein)}g protein
                  </ThemedText>
                  <ThemedText style={[styles.nutritionText, { color: colors.text + 'CC' }]}>
                    {Math.round(totalFats)}g fats
                  </ThemedText>
                  <ThemedText style={[styles.nutritionText, { color: colors.text + 'CC' }]}>
                    {Math.round(totalCarbs)}g carbs
                  </ThemedText>
                </>
              )}
            </View>
          </View>

          <View style={styles.imageContainer}>
            {meal.imageUri ? (
              meal.afterImageUri ? (
                <View style={styles.beforeAfterImages}>
                  <Image source={{ uri: meal.imageUri }} style={styles.halfImage} />
                  <View style={[styles.imageSeparator, { backgroundColor: colors.text + '20' }]} />
                  <Image source={{ uri: meal.afterImageUri }} style={styles.halfImage} />
                </View>
              ) : (
                <Image source={{ uri: meal.imageUri }} style={styles.image} />
              )
            ) : null}
          </View>
        </ThemedView>
      </TouchableOpacity>

      <MealDetailModal
        visible={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        meal={meal}
        onDelete={onDelete}
      />
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    padding: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginHorizontal: 8,
    marginBottom: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 1,
  },
  content: {
    flex: 1,
    marginRight: 12,
  },
  header: {
    marginBottom: 8,
  },
  
  itemName: {
    fontSize: 15,
    fontFamily: 'TikTokSans-SemiBold',
    marginBottom: 2,
    letterSpacing: 0.2,
  },
  time: {
    fontSize: 11,
    fontWeight: '500',
  },
  nutrition: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  nutritionText: {
    fontSize: 11,
    fontWeight: '500',
  },
  imageContainer: {
    width: 64,
    height: 64,
    borderRadius: 10,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loadingText: {
    marginLeft: 6,
    fontSize: 12,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  errorText: {
    marginLeft: 4,
    color: 'red',
    fontSize: 12,
  },
  retryButton: {
    marginLeft: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  retryText: {
    fontSize: 11,
    fontWeight: '500',
  },
  beforeAfterImages: {
    flexDirection: 'row',
    width: '100%',
    height: '100%',
    alignItems: 'center',
  },
  halfImage: {
    flex: 1,
    height: '100%',
  },
  imageSeparator: {
    width: 1,
    height: '100%',
  },
});