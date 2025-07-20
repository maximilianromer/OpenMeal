import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import FileSystemStorageService, { MealAnalysis, EMPTY_ANALYSIS } from './FileSystemStorageService';
import DailyGoalsService, { DailyGoals } from './DailyGoalsService';
import UserProfileService, { UserProfile } from './UserProfileService';
import MealRemindersService, { MealReminder } from './MealRemindersService';
import { Platform } from 'react-native';

interface ExportData {
  version: string;
  export_date: string;
  user_profile: UserProfile | null;
  daily_goals: DailyGoals | null;
  meal_reminders: MealReminder[];
  app_preferences: {
    ai_model: string;
  };
  meals: ExportedMeal[];
}

interface ExportedMeal {
  id: string;
  timestamp: string;
  image_data?: string; // base64 encoded image
  after_image_data?: string; // base64 encoded after image
  analysis: any;
  comment?: string;
}

class ExportImportService {
  private readonly EXPORT_VERSION = '1.0.0';

  /**
   * Convert image URI to base64 data URI
   */
  private async imageToBase64(uri: string): Promise<string | undefined> {
    try {
      if (!uri || uri.trim() === '') {
        return undefined;
      }
      
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      // Determine MIME type from file extension
      const extension = uri.split('.').pop()?.toLowerCase();
      const mimeType = extension === 'png' ? 'image/png' : 'image/jpeg';
      
      return `data:${mimeType};base64,${base64}`;
    } catch (error) {
      console.error('Error converting image to base64:', error);
      return undefined;
    }
  }

  /**
   * Save base64 data URI to file
   */
  private async base64ToImage(dataUri: string, filename: string): Promise<string> {
    try {
      // Extract base64 data from data URI
      const base64Data = dataUri.split(',')[1];
      
      // Create file path
      const fileUri = `${FileSystem.documentDirectory}temp_import_${filename}`;
      
      // Write base64 data to file
      await FileSystem.writeAsStringAsync(fileUri, base64Data, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      return fileUri;
    } catch (error) {
      console.error('Error converting base64 to image:', error);
      throw error;
    }
  }

  /**
   * Export all user data to JSON file
   */
  async exportData(onProgress?: (progress: number, message: string) => void): Promise<void> {
    try {
      onProgress?.(0, 'Gathering user data...');

      // Collect all data
      const userProfile = await UserProfileService.getProfile();
      const dailyGoals = await DailyGoalsService.getDailyGoals();
      const mealReminders = await MealRemindersService.getReminders();
      const aiModel = await UserProfileService.getAIModel();
      
      onProgress?.(20, 'Loading meal history...');
      const meals = await FileSystemStorageService.getMealHistory();

      // Convert meals with base64 images
      const exportedMeals: ExportedMeal[] = [];
      const totalMeals = meals.length;
      
      for (let i = 0; i < meals.length; i++) {
        const meal = meals[i];
        onProgress?.(20 + (i / totalMeals) * 60, `Processing meal ${i + 1} of ${totalMeals}...`);
        
        const exportedMeal: ExportedMeal = {
          id: meal.id,
          timestamp: meal.timestamp,
          analysis: meal.analysis,
          comment: meal.comment,
        };

        // Convert images to base64
        if (meal.imageUri) {
          exportedMeal.image_data = await this.imageToBase64(meal.imageUri);
        }
        if (meal.afterImageUri) {
          exportedMeal.after_image_data = await this.imageToBase64(meal.afterImageUri);
        }

        exportedMeals.push(exportedMeal);
      }

      onProgress?.(80, 'Creating export file...');

      // Create export data structure
      const exportData: ExportData = {
        version: this.EXPORT_VERSION,
        export_date: new Date().toISOString(),
        user_profile: userProfile,
        daily_goals: dailyGoals,
        meal_reminders: mealReminders,
        app_preferences: {
          ai_model: aiModel,
        },
        meals: exportedMeals,
      };

      // Generate filename with date
      const date = new Date();
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      const filename = `OpenMeal_Export_${dateStr}.json`;

      // Convert to JSON
      const jsonContent = JSON.stringify(exportData, null, 2);

      onProgress?.(90, 'Saving file...');

      // Platform-specific file saving
      if (Platform.OS === 'android') {
        await this.saveFileAndroid(jsonContent, filename);
      } else {
        await this.saveFileIOS(jsonContent, filename);
      }

      onProgress?.(100, 'Export complete!');
    } catch (error) {
      console.error('Export error:', error);
      throw error;
    }
  }

  /**
   * Save file on Android using Storage Access Framework
   */
  private async saveFileAndroid(content: string, filename: string): Promise<void> {
    try {
      // Request directory permissions using Storage Access Framework
      const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
      
      if (!permissions.granted) {
        // Fallback to sharing if permissions denied
        await this.fallbackToSharing(content, filename);
        return;
      }

      // Create file in the selected directory
      const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
        permissions.directoryUri,
        filename,
        'application/json'
      );

      // Write content to file
      await FileSystem.writeAsStringAsync(fileUri, content, {
        encoding: FileSystem.EncodingType.UTF8,
      });

    } catch (error) {
      console.error('Android save error:', error);
      // Fallback to sharing if SAF fails
      await this.fallbackToSharing(content, filename);
    }
  }

  /**
   * Save file on iOS using sharing
   */
  private async saveFileIOS(content: string, filename: string): Promise<void> {
    await this.fallbackToSharing(content, filename);
  }

  /**
   * Fallback to sharing method (original implementation)
   */
  private async fallbackToSharing(content: string, filename: string): Promise<void> {
    // Save to temporary file
    const tempFileUri = `${FileSystem.documentDirectory}${filename}`;
    await FileSystem.writeAsStringAsync(tempFileUri, content);

    // Share the file
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(tempFileUri, {
        UTI: 'public.json',
        mimeType: 'application/json',
      });
    } else {
      throw new Error('Sharing is not available on this device');
    }

    // Clean up temp file
    await FileSystem.deleteAsync(tempFileUri, { idempotent: true });
  }

  /**
   * Validate export data schema
   */
  private validateExportData(data: any): data is ExportData {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid data format');
    }

    if (!data.version || typeof data.version !== 'string') {
      throw new Error('Missing or invalid version field');
    }

    if (!data.export_date || typeof data.export_date !== 'string') {
      throw new Error('Missing or invalid export_date field');
    }

    if (!Array.isArray(data.meals)) {
      throw new Error('Missing or invalid meals array');
    }

    // Validate each meal
    for (const meal of data.meals) {
      if (!meal.id || !meal.timestamp) {
        throw new Error('Invalid meal data: missing required fields');
      }
    }

    return true;
  }

  /**
   * Import data from JSON file
   */
  async importData(fileUri: string, onProgress?: (progress: number, message: string) => void): Promise<void> {
    try {
      onProgress?.(0, 'Reading import file...');

      // Read and parse JSON file
      const jsonContent = await FileSystem.readAsStringAsync(fileUri);
      const data = JSON.parse(jsonContent);

      onProgress?.(10, 'Validating data...');

      // Validate schema
      if (!this.validateExportData(data)) {
        throw new Error('Invalid export file format');
      }

      // Import user profile
      if (data.user_profile) {
        onProgress?.(20, 'Importing user profile...');
        await UserProfileService.saveProfile(data.user_profile);
      }

      // Import daily goals
      if (data.daily_goals) {
        onProgress?.(30, 'Importing daily goals...');
        await DailyGoalsService.saveDailyGoals(data.daily_goals);
      }

      // Import meal reminders
      if (data.meal_reminders && data.meal_reminders.length > 0) {
        onProgress?.(40, 'Importing meal reminders...');
        await MealRemindersService.saveReminders(data.meal_reminders);
      }

      // Import app preferences
      if (data.app_preferences?.ai_model) {
        onProgress?.(45, 'Importing preferences...');
        await UserProfileService.saveAIModel(data.app_preferences.ai_model);
      }

      // Import meals
      const totalMeals = data.meals.length;
      for (let i = 0; i < data.meals.length; i++) {
        const exportedMeal = data.meals[i];
        onProgress?.(45 + (i / totalMeals) * 50, `Importing meal ${i + 1} of ${totalMeals}...`);

        // Convert base64 images back to files
        let imageUri = '';
        let afterImageUri: string | undefined;

        if (exportedMeal.image_data) {
          const tempImageUri = await this.base64ToImage(
            exportedMeal.image_data,
            `${exportedMeal.id}_main.jpg`
          );
          imageUri = await FileSystemStorageService.copyImageToStorage(tempImageUri, exportedMeal.id);
          await FileSystem.deleteAsync(tempImageUri, { idempotent: true });
        }

        if (exportedMeal.after_image_data) {
          const tempAfterImageUri = await this.base64ToImage(
            exportedMeal.after_image_data,
            `${exportedMeal.id}_after.jpg`
          );
          afterImageUri = await FileSystemStorageService.copyImageToStorage(tempAfterImageUri, exportedMeal.id, 'after');
          await FileSystem.deleteAsync(tempAfterImageUri, { idempotent: true });
        }

        // Create meal analysis object
        const meal: MealAnalysis = {
          id: exportedMeal.id,
          timestamp: exportedMeal.timestamp,
          imageUri: imageUri,
          afterImageUri: afterImageUri,
          analysis: exportedMeal.analysis || EMPTY_ANALYSIS,
          comment: exportedMeal.comment,
          isLoading: false,
          hasError: false,
        };

        // Save meal
        await FileSystemStorageService.saveMealAnalysis(meal);
      }

      onProgress?.(100, 'Import complete!');
    } catch (error) {
      console.error('Import error:', error);
      throw error;
    }
  }
}

export default new ExportImportService(); 