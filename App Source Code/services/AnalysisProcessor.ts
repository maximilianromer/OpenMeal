import * as FileSystem from 'expo-file-system';
import { Platform, DeviceEventEmitter } from 'react-native';
import GeminiService from './GeminiService';
import FileSystemStorageService, { MealAnalysis } from './FileSystemStorageService';
import { writeMealToHealthConnect } from './HealthConnectService';

// 24 hours in milliseconds
const MEAL_TIMEOUT_MS = 24 * 60 * 60 * 1000;

export async function processMeal(meal: MealAnalysis): Promise<void> {
  try {
    // Check if meal is too old (24+ hours) and mark as error
    const mealTime = new Date(meal.timestamp).getTime();
    const now = Date.now();
    if (now - mealTime > MEAL_TIMEOUT_MS) {
      console.log(`Meal ${meal.id} is older than 24 hours, marking as error`);
      await FileSystemStorageService.updateMealAnalysisError(meal.id);
      
      const errorMeal = {
        ...meal,
        isLoading: false,
        hasError: true
      };
      DeviceEventEmitter.emit('mealUpdated', errorMeal);
      return;
    }

    // Set meal to loading state if it's in error state (for retry)
    if (meal.hasError) {
      const retryMeal = {
        ...meal,
        isLoading: true,
        hasError: false
      };
      await FileSystemStorageService.updateMealAnalysis(meal.id, retryMeal);
      DeviceEventEmitter.emit('mealUpdated', retryMeal);
    }

    let analysis;

    // Handle text-only meals
    if (!meal.imageUri || meal.imageUri.trim() === '') {
      if (!meal.comment || meal.comment.trim() === '') {
        throw new Error('No image or comment provided for meal analysis');
      }
      
      analysis = await GeminiService.analyzeFoodFromText(meal.comment);
    } else {
      // Handle image-based meals
      if (meal.afterImageUri) {
        // Before/after analysis
        const base64Before = await FileSystem.readAsStringAsync(meal.imageUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const base64After = await FileSystem.readAsStringAsync(meal.afterImageUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        
        analysis = await GeminiService.analyzeFoodBeforeAfter(base64Before, base64After, meal.comment);
      } else {
        // Single image analysis
        const base64 = await FileSystem.readAsStringAsync(meal.imageUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        
        analysis = await GeminiService.analyzeFood(base64, meal.comment);
      }
    }

    // Update meal with successful analysis
    const completedMeal = {
      ...meal,
      analysis,
      isLoading: false,
      hasError: false
    };

    await FileSystemStorageService.updateMealAnalysis(meal.id, completedMeal);

    // Automatically write to Health Connect if permission granted (Android only)
    if (Platform.OS === 'android') {
      try {
        await writeMealToHealthConnect(completedMeal);
      } catch (error) {
        console.error('Error writing to Health Connect:', error);
        // Don't fail the entire process if Health Connect write fails
      }
    }

    // Emit event for real-time UI update
    DeviceEventEmitter.emit('mealUpdated', completedMeal);

  } catch (error) {
    console.error('Analysis processing error:', error);
    
    // Update meal to show error state
    try {
      await FileSystemStorageService.updateMealAnalysisError(meal.id);

      const errorMeal = {
        ...meal,
        isLoading: false,
        hasError: true
      };
      DeviceEventEmitter.emit('mealUpdated', errorMeal);
    } catch (updateError) {
      console.error('Error updating meal analysis error state:', updateError);
    }
  }
}

export async function resumePending(): Promise<void> {
  try {
    console.log('Resuming pending meal analyses...');
    const meals = await FileSystemStorageService.getMealHistory();
    const toRetry = meals.filter(m => m.isLoading || m.hasError);
    
    console.log(`Found ${toRetry.length} meals to retry`);
    
    // Process meals one by one to avoid overwhelming the API
    for (const meal of toRetry) {
      try {
        await processMeal(meal);
        // Small delay between requests to be respectful to the API
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Failed to process meal ${meal.id}:`, error);
        // Continue processing other meals even if one fails
      }
    }
  } catch (error) {
    console.error('Error resuming pending analyses:', error);
  }
}

export async function retryMeal(mealId: string): Promise<void> {
  try {
    const meal = await FileSystemStorageService.getMealById(mealId);
    if (!meal) {
      throw new Error(`Meal ${mealId} not found`);
    }
    
    await processMeal(meal);
  } catch (error) {
    console.error(`Error retrying meal ${mealId}:`, error);
    throw error;
  }
} 