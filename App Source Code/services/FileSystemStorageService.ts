
import * as FileSystem from 'expo-file-system';

export const EMPTY_ANALYSIS = {
  meal_items: [],
  total_meal_nutritional_values: {
    total_calories: 0,
    total_total_carbohydrate_g: 0,
    total_protein_g: 0,
    total_total_fat_g: 0,
  },
  meal_insights: {
    health_benefits: [],
    health_concerns: [],
  },
  overall_meal_notes: '',
  unidentified_items_description: '',
};

export interface MealAnalysis {
  id: string;
  timestamp: string;
  imageUri: string;
  afterImageUri?: string;
  analysis: any;
  comment?: string;
  isLoading?: boolean;
  hasError?: boolean;
}

interface MealIndex {
  meals: {
    id: string;
    timestamp: string;
    filename: string;
  }[];
  lastUpdated: string;
}

class FileSystemStorageService {
  private mealsDir: string;
  private imagesDir: string;
  private indexFile: string;

  constructor() {
    this.mealsDir = `${FileSystem.documentDirectory}meals/`;
    this.imagesDir = `${FileSystem.documentDirectory}meals/images/`;
    this.indexFile = `${FileSystem.documentDirectory}meals/index.json`;
  }

  async initializeStorage(): Promise<void> {
    try {
      // Create directories if they don't exist
      const mealsInfo = await FileSystem.getInfoAsync(this.mealsDir);
      if (!mealsInfo.exists) {
        await FileSystem.makeDirectoryAsync(this.mealsDir, { intermediates: true });
      }

      const imagesInfo = await FileSystem.getInfoAsync(this.imagesDir);
      if (!imagesInfo.exists) {
        await FileSystem.makeDirectoryAsync(this.imagesDir, { intermediates: true });
      }

      // Create index file if it doesn't exist
      const indexInfo = await FileSystem.getInfoAsync(this.indexFile);
      if (!indexInfo.exists) {
        const initialIndex: MealIndex = {
          meals: [],
          lastUpdated: new Date().toISOString(),
        };
        await FileSystem.writeAsStringAsync(this.indexFile, JSON.stringify(initialIndex, null, 2));
      }
    } catch (error) {
      console.error('Error initializing file system storage:', error);
      throw error;
    }
  }

  private async readIndex(): Promise<MealIndex> {
    try {
      const indexContent = await FileSystem.readAsStringAsync(this.indexFile);
      return JSON.parse(indexContent);
    } catch (error) {
      console.error('Error reading index:', error);
      // Return default index if reading fails
      return {
        meals: [],
        lastUpdated: new Date().toISOString(),
      };
    }
  }

  private async writeIndex(index: MealIndex): Promise<void> {
    try {
      index.lastUpdated = new Date().toISOString();
      await FileSystem.writeAsStringAsync(this.indexFile, JSON.stringify(index, null, 2));
    } catch (error) {
      console.error('Error writing index:', error);
      throw error;
    }
  }

  async copyImageToStorage(sourceUri: string, mealId: string, suffix: string = ''): Promise<string> {
    try {
      const timestamp = Date.now();
      const extension = sourceUri.split('.').pop() || 'jpg';
      const filename = `${mealId}${suffix ? '_' + suffix : ''}_${timestamp}.${extension}`;
      const destinationUri = `${this.imagesDir}${filename}`;
      
      await FileSystem.copyAsync({
        from: sourceUri,
        to: destinationUri,
      });
      
      return destinationUri;
    } catch (error) {
      console.error('Error copying image:', error);
      throw error;
    }
  }

  async saveMealAnalysis(meal: MealAnalysis): Promise<void> {
    try {
      await this.initializeStorage();

      // Validate required fields
      if (!meal.id || !meal.timestamp || !meal.imageUri || !meal.analysis) {
        throw new Error('Missing required meal data');
      }

      // Copy image to storage if it's not already there
      let storageImageUri = meal.imageUri;
      if (!meal.imageUri.startsWith(this.imagesDir)) {
        storageImageUri = await this.copyImageToStorage(meal.imageUri, meal.id);
      }

      // Copy after image to storage if there is one and it's not already there
      let storageAfterImageUri = meal.afterImageUri;
      if (storageAfterImageUri && !storageAfterImageUri.startsWith(this.imagesDir)) {
        storageAfterImageUri = await this.copyImageToStorage(storageAfterImageUri, meal.id, 'after');
      }

      // Create meal object with storage image URI
      const mealToSave = {
        ...meal,
        imageUri: storageImageUri,
        afterImageUri: storageAfterImageUri,
      };

      // Save meal data to individual file
      const mealFilename = `meal_${meal.id}.json`;
      const mealFile = `${this.mealsDir}${mealFilename}`;
      await FileSystem.writeAsStringAsync(mealFile, JSON.stringify(mealToSave, null, 2));

      // Update index
      const index = await this.readIndex();
      
      // Remove existing entry if it exists
      index.meals = index.meals.filter(m => m.id !== meal.id);
      
      // Add new entry
      index.meals.unshift({
        id: meal.id,
        timestamp: meal.timestamp,
        filename: mealFilename,
      });

      // Keep only the last 50 meals
      if (index.meals.length > 50) {
        const mealsToRemove = index.meals.slice(50);
        
        // Delete old meal files and images
        for (const oldMeal of mealsToRemove) {
          try {
            await FileSystem.deleteAsync(`${this.mealsDir}${oldMeal.filename}`, { idempotent: true });
            // Note: We're not deleting images here to avoid accidentally deleting shared images
            // In a production app, you might want to implement reference counting
          } catch (e) {
            console.warn('Error deleting old meal file:', e);
          }
        }
        
        index.meals = index.meals.slice(0, 50);
      }

      await this.writeIndex(index);
    } catch (error) {
      console.error('Error saving meal analysis:', error);
      throw error;
    }
  }

  async savePendingMeal(pendingMeal: any): Promise<void> {
    try {
      await this.initializeStorage();

      // Validate required fields
      if (!pendingMeal.id || !pendingMeal.timestamp) {
        throw new Error('Missing required pending meal data');
      }

      // Copy image to storage if there is one
      let storageImageUri = '';
      if (pendingMeal.imageUri && pendingMeal.imageUri.trim()) {
        storageImageUri = await this.copyImageToStorage(pendingMeal.imageUri, pendingMeal.id);
      }

      // Copy after image to storage if there is one
      let storageAfterImageUri = undefined;
      if (pendingMeal.afterImageUri && pendingMeal.afterImageUri.trim()) {
        storageAfterImageUri = await this.copyImageToStorage(pendingMeal.afterImageUri, pendingMeal.id, 'after');
      }

      const mealToSave = {
        id: pendingMeal.id,
        timestamp: pendingMeal.timestamp,
        imageUri: storageImageUri,
        afterImageUri: storageAfterImageUri,
        analysis: null,
        comment: pendingMeal.comment || '',
        isLoading: true,
        hasError: false,
      };

      // Save meal data to individual file
      const mealFilename = `meal_${pendingMeal.id}.json`;
      const mealFile = `${this.mealsDir}${mealFilename}`;
      await FileSystem.writeAsStringAsync(mealFile, JSON.stringify(mealToSave, null, 2));

      // Update index
      const index = await this.readIndex();
      
      // Remove existing entry if it exists
      index.meals = index.meals.filter(m => m.id !== pendingMeal.id);
      
      // Add new entry
      index.meals.unshift({
        id: pendingMeal.id,
        timestamp: pendingMeal.timestamp,
        filename: mealFilename,
      });

      await this.writeIndex(index);
    } catch (error) {
      console.error('Error saving pending meal:', error);
      throw error;
    }
  }

  async saveCommentMeal(commentMeal: { id: string; timestamp: string; comment: string }): Promise<void> {
    try {
      await this.initializeStorage();

      const mealFilename = `meal_${commentMeal.id}.json`;
      const mealFile = `${this.mealsDir}${mealFilename}`;

      const mealToSave = {
        id: commentMeal.id,
        timestamp: commentMeal.timestamp,
        imageUri: '',
        analysis: EMPTY_ANALYSIS,
        comment: commentMeal.comment || '',
        isLoading: false,
        hasError: false,
      };

      await FileSystem.writeAsStringAsync(mealFile, JSON.stringify(mealToSave, null, 2));

      const index = await this.readIndex();
      index.meals = index.meals.filter(m => m.id !== commentMeal.id);
      index.meals.unshift({
        id: commentMeal.id,
        timestamp: commentMeal.timestamp,
        filename: mealFilename,
      });

      await this.writeIndex(index);
    } catch (error) {
      console.error('Error saving comment meal:', error);
      throw error;
    }
  }

  async updateMealAnalysis(mealId: string, meal: MealAnalysis): Promise<void> {
    try {
      await this.initializeStorage();

      const mealFilename = `meal_${mealId}.json`;
      const mealFile = `${this.mealsDir}${mealFilename}`;

      // Read existing meal data
      const existingMealContent = await FileSystem.readAsStringAsync(mealFile);
      const existingMeal = JSON.parse(existingMealContent);

      // Update with new analysis
      const updatedMeal = {
        ...existingMeal,
        ...meal,
        isLoading: false,
        hasError: false,
      };

      // Persist the updated meal first
      await FileSystem.writeAsStringAsync(mealFile, JSON.stringify(updatedMeal, null, 2));

      // NEW: keep the index entry in sync with any timestamp change
      const index = await this.readIndex();
      const entryIndex = index.meals.findIndex(m => m.id === mealId);

      if (entryIndex !== -1) {
        // Update the timestamp on the existing entry
        index.meals[entryIndex].timestamp = updatedMeal.timestamp;
      } else {
        // Edge-case: meal missing from index – add it back
        index.meals.unshift({
          id: mealId,
          timestamp: updatedMeal.timestamp,
          filename: mealFilename,
        });
      }

      // Re-sort so the most recent meals stay on top (descending by timestamp)
      index.meals.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      await this.writeIndex(index);
    } catch (error) {
      console.error('Error updating meal analysis:', error);
      throw error;
    }
  }

  async updateMealAnalysisError(mealId: string): Promise<void> {
    try {
      await this.initializeStorage();

      const mealFilename = `meal_${mealId}.json`;
      const mealFile = `${this.mealsDir}${mealFilename}`;

      // Read existing meal data
      const existingMealContent = await FileSystem.readAsStringAsync(mealFile);
      const existingMeal = JSON.parse(existingMealContent);

      // Update error state
      const updatedMeal = {
        ...existingMeal,
        isLoading: false,
        hasError: true,
      };

      await FileSystem.writeAsStringAsync(mealFile, JSON.stringify(updatedMeal, null, 2));
    } catch (error) {
      console.error('Error updating meal analysis error:', error);
      throw error;
    }
  }

  async getMealHistory(): Promise<MealAnalysis[]> {
    try {
      await this.initializeStorage();

      const index = await this.readIndex();
      const meals: MealAnalysis[] = [];

      for (const mealRef of index.meals) {
        try {
          const mealFile = `${this.mealsDir}${mealRef.filename}`;
          const mealContent = await FileSystem.readAsStringAsync(mealFile);
          const meal = JSON.parse(mealContent);
          meals.push(meal);
        } catch (error) {
          console.warn(`Error reading meal file ${mealRef.filename}:`, error);
          // Skip corrupted files but continue processing others
        }
      }

      return meals;
    } catch (error) {
      console.error('Error getting meal history:', error);
      return [];
    }
  }

  async deleteMeal(mealId: string): Promise<void> {
    try {
      await this.initializeStorage();

      // Update index first
      const index = await this.readIndex();
      const mealToDelete = index.meals.find(m => m.id === mealId);
      
      if (mealToDelete) {
        // Remove from index
        index.meals = index.meals.filter(m => m.id !== mealId);
        await this.writeIndex(index);

        // Delete meal file
        const mealFile = `${this.mealsDir}${mealToDelete.filename}`;
        await FileSystem.deleteAsync(mealFile, { idempotent: true });

        // Note: Not deleting images to avoid accidentally deleting shared images
        // In a production app, you might want to implement reference counting
      }
    } catch (error) {
      console.error('Error deleting meal:', error);
      throw error;
    }
  }

  async clearHistory(): Promise<void> {
    try {
      await this.initializeStorage();

      // Delete all meal files
      const index = await this.readIndex();
      for (const mealRef of index.meals) {
        try {
          const mealFile = `${this.mealsDir}${mealRef.filename}`;
          await FileSystem.deleteAsync(mealFile, { idempotent: true });
        } catch (e) {
          console.warn('Error deleting meal file:', e);
        }
      }

      // Reset index
      const emptyIndex: MealIndex = {
        meals: [],
        lastUpdated: new Date().toISOString(),
      };
      await this.writeIndex(emptyIndex);

      // Note: Not clearing images directory to avoid accidentally deleting shared images
    } catch (error) {
      console.error('Error clearing history:', error);
      throw error;
    }
  }

  async clearHistoryByTimeRange(timeRange: 'hour' | 'day' | 'month' | 'year' | 'all'): Promise<void> {
    try {
      await this.initializeStorage();

      if (timeRange === 'all') {
        return this.clearHistory();
      }

      const now = new Date();
      let cutoffDate: Date;

      switch (timeRange) {
        case 'hour':
          cutoffDate = new Date(now.getTime() - 60 * 60 * 1000);
          break;
        case 'day':
          cutoffDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case 'month':
          cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case 'year':
          cutoffDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
        default:
          throw new Error('Invalid time range');
      }

      const index = await this.readIndex();
      const mealsToDelete: typeof index.meals = [];
      const mealsToKeep: typeof index.meals = [];

      // Categorize meals based on cutoff date
      for (const mealRef of index.meals) {
        const mealDate = new Date(mealRef.timestamp);
        if (mealDate >= cutoffDate) {
          mealsToDelete.push(mealRef);
        } else {
          mealsToKeep.push(mealRef);
        }
      }

      // Delete meal files for meals in the time range
      for (const mealRef of mealsToDelete) {
        try {
          const mealFile = `${this.mealsDir}${mealRef.filename}`;
          await FileSystem.deleteAsync(mealFile, { idempotent: true });
        } catch (e) {
          console.warn('Error deleting meal file:', e);
        }
      }

      // Update index with remaining meals
      const updatedIndex: MealIndex = {
        meals: mealsToKeep,
        lastUpdated: new Date().toISOString(),
      };
      await this.writeIndex(updatedIndex);

      // Note: Not clearing images directory to avoid accidentally deleting shared images
    } catch (error) {
      console.error('Error clearing history by time range:', error);
      throw error;
    }
  }

  async getMealById(mealId: string): Promise<MealAnalysis | null> {
    try {
      await this.initializeStorage();

      const mealFilename = `meal_${mealId}.json`;
      const mealFile = `${this.mealsDir}${mealFilename}`;

      const mealContent = await FileSystem.readAsStringAsync(mealFile);
      return JSON.parse(mealContent);
    } catch (error) {
      console.error('Error getting meal by ID:', error);
      return null;
    }
  }

  async getMealCount(): Promise<number> {
    try {
      await this.initializeStorage();

      const index = await this.readIndex();
      return index.meals.length;
    } catch (error) {
      console.error('Error getting meal count:', error);
      return 0;
    }
  }
}

export default new FileSystemStorageService();
