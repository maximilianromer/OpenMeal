import ExportImportService from '../services/ExportImportService';
import FileSystemStorageService, { MealAnalysis, EMPTY_ANALYSIS } from '../services/FileSystemStorageService';
import DailyGoalsService from '../services/DailyGoalsService';
import UserProfileService from '../services/UserProfileService';
import MealRemindersService from '../services/MealRemindersService';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

// Mock dependencies
jest.mock('expo-file-system');
jest.mock('expo-sharing');
jest.mock('../services/FileSystemStorageService');
jest.mock('../services/DailyGoalsService');
jest.mock('../services/UserProfileService');
jest.mock('../services/MealRemindersService');

describe('ExportImportService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('exportData', () => {
    it('should gather all user data and create export file on Android using SAF', async () => {
      // Mock Platform.OS to be Android
      Object.defineProperty(Platform, 'OS', {
        value: 'android',
        writable: true,
      });

      // Mock data
      const mockProfile = {
        age: 25,
        gender: 'male' as const,
        heightCm: 180,
        weightKg: 75,
        activityLevel: 3,
        goal: 'maintain' as const,
        units: 'metric' as const,
      };

      const mockGoals = {
        calories: 2500,
        protein: 150,
        fats: 80,
        carbs: 300,
      };

      const mockReminders = [
        { id: '1', time: '08:00', label: 'Breakfast', enabled: true },
        { id: '2', time: '12:00', label: 'Lunch', enabled: true },
      ];

      const mockMeals: MealAnalysis[] = [
        {
          id: 'meal1',
          timestamp: '2024-01-01T12:00:00Z',
          imageUri: 'file://meal1.jpg',
          analysis: { meal_items: [] },
          comment: 'Test meal',
        },
      ];

      // Setup mocks
      UserProfileService.getProfile = jest.fn().mockResolvedValue(mockProfile);
      UserProfileService.getAIModel = jest.fn().mockResolvedValue('gemini-2.5-flash');
      DailyGoalsService.getDailyGoals = jest.fn().mockResolvedValue(mockGoals);
      MealRemindersService.getReminders = jest.fn().mockResolvedValue(mockReminders);
      FileSystemStorageService.getMealHistory = jest.fn().mockResolvedValue(mockMeals);
      
      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue('base64ImageData');
      (FileSystem.writeAsStringAsync as jest.Mock).mockResolvedValue(undefined);
      (FileSystem.deleteAsync as jest.Mock).mockResolvedValue(undefined);
      
      // Mock Storage Access Framework
      (FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync as jest.Mock).mockResolvedValue({
        granted: true,
        directoryUri: 'content://com.android.externalstorage.documents/tree/primary%3ADownload',
      });
      (FileSystem.StorageAccessFramework.createFileAsync as jest.Mock).mockResolvedValue(
        'content://com.android.externalstorage.documents/document/primary%3ADownload%2FOpenMeal_Export_2024-01-01.json'
      );

      const progressCallback = jest.fn();

      // Execute
      await ExportImportService.exportData(progressCallback);

      // Verify
      expect(UserProfileService.getProfile).toHaveBeenCalled();
      expect(DailyGoalsService.getDailyGoals).toHaveBeenCalled();
      expect(MealRemindersService.getReminders).toHaveBeenCalled();
      expect(FileSystemStorageService.getMealHistory).toHaveBeenCalled();
      
      // Verify SAF was used
      expect(FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync).toHaveBeenCalled();
      expect(FileSystem.StorageAccessFramework.createFileAsync).toHaveBeenCalled();
      
      // Verify file was written
      expect(FileSystem.writeAsStringAsync).toHaveBeenCalled();
      const writtenContent = JSON.parse((FileSystem.writeAsStringAsync as jest.Mock).mock.calls[0][1]);
      
      expect(writtenContent).toMatchObject({
        version: '1.0.0',
        user_profile: mockProfile,
        daily_goals: mockGoals,
        meal_reminders: mockReminders,
        app_preferences: { ai_model: 'gemini-2.5-flash' },
      });

      // Verify image was encoded
      expect(writtenContent.meals[0].image_data).toMatch(/^data:image\/jpeg;base64,/);

      // Verify progress callbacks
      expect(progressCallback).toHaveBeenCalledWith(0, 'Gathering user data...');
      expect(progressCallback).toHaveBeenCalledWith(100, 'Export complete!');

      // Verify sharing was NOT used (since SAF was successful)
      expect(Sharing.shareAsync).not.toHaveBeenCalled();
    });

    it('should fallback to sharing on Android when SAF permissions are denied', async () => {
      // Mock Platform.OS to be Android
      Object.defineProperty(Platform, 'OS', {
        value: 'android',
        writable: true,
      });

      // Mock basic services
      UserProfileService.getProfile = jest.fn().mockResolvedValue(null);
      UserProfileService.getAIModel = jest.fn().mockResolvedValue('gemini-2.5-flash');
      DailyGoalsService.getDailyGoals = jest.fn().mockResolvedValue(null);
      MealRemindersService.getReminders = jest.fn().mockResolvedValue([]);
      FileSystemStorageService.getMealHistory = jest.fn().mockResolvedValue([]);

      (FileSystem.writeAsStringAsync as jest.Mock).mockResolvedValue(undefined);
      (FileSystem.deleteAsync as jest.Mock).mockResolvedValue(undefined);
      
      // Mock SAF permissions denied
      (FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync as jest.Mock).mockResolvedValue({
        granted: false,
      });
      
      // Mock sharing
      (Sharing.isAvailableAsync as jest.Mock).mockResolvedValue(true);
      (Sharing.shareAsync as jest.Mock).mockResolvedValue(undefined);

      // Execute
      await ExportImportService.exportData();

      // Verify SAF was attempted
      expect(FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync).toHaveBeenCalled();
      
      // Verify fallback to sharing
      expect(Sharing.shareAsync).toHaveBeenCalled();
    });

    it('should use sharing on iOS', async () => {
      // Mock Platform.OS to be iOS
      Object.defineProperty(Platform, 'OS', {
        value: 'ios',
        writable: true,
      });

      // Mock basic services
      UserProfileService.getProfile = jest.fn().mockResolvedValue(null);
      UserProfileService.getAIModel = jest.fn().mockResolvedValue('gemini-2.5-flash');
      DailyGoalsService.getDailyGoals = jest.fn().mockResolvedValue(null);
      MealRemindersService.getReminders = jest.fn().mockResolvedValue([]);
      FileSystemStorageService.getMealHistory = jest.fn().mockResolvedValue([]);

      (FileSystem.writeAsStringAsync as jest.Mock).mockResolvedValue(undefined);
      (FileSystem.deleteAsync as jest.Mock).mockResolvedValue(undefined);
      (Sharing.isAvailableAsync as jest.Mock).mockResolvedValue(true);
      (Sharing.shareAsync as jest.Mock).mockResolvedValue(undefined);

      // Execute
      await ExportImportService.exportData();

      // Verify SAF was NOT used
      expect(FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync).not.toHaveBeenCalled();
      
      // Verify sharing was used
      expect(Sharing.shareAsync).toHaveBeenCalled();
    });

    it('should handle Android SAF errors gracefully', async () => {
      // Mock Platform.OS to be Android
      Object.defineProperty(Platform, 'OS', {
        value: 'android',
        writable: true,
      });

      // Mock basic services
      UserProfileService.getProfile = jest.fn().mockResolvedValue(null);
      UserProfileService.getAIModel = jest.fn().mockResolvedValue('gemini-2.5-flash');
      DailyGoalsService.getDailyGoals = jest.fn().mockResolvedValue(null);
      MealRemindersService.getReminders = jest.fn().mockResolvedValue([]);
      FileSystemStorageService.getMealHistory = jest.fn().mockResolvedValue([]);

      (FileSystem.writeAsStringAsync as jest.Mock).mockResolvedValue(undefined);
      (FileSystem.deleteAsync as jest.Mock).mockResolvedValue(undefined);
      
      // Mock SAF error
      (FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync as jest.Mock).mockRejectedValue(
        new Error('SAF not available')
      );
      
      // Mock sharing fallback
      (Sharing.isAvailableAsync as jest.Mock).mockResolvedValue(true);
      (Sharing.shareAsync as jest.Mock).mockResolvedValue(undefined);

      // Execute
      await ExportImportService.exportData();

      // Verify fallback to sharing
      expect(Sharing.shareAsync).toHaveBeenCalled();
    });

    it('should handle export errors gracefully', async () => {
      // Setup error
      FileSystemStorageService.getMealHistory = jest.fn().mockRejectedValue(new Error('Storage error'));

      // Execute and expect error
      await expect(ExportImportService.exportData()).rejects.toThrow('Storage error');
    });
  });

  describe('importData', () => {
    const validExportData = {
      version: '1.0.0',
      export_date: '2024-01-01T00:00:00Z',
      user_profile: {
        age: 25,
        gender: 'male' as const,
        heightCm: 180,
        weightKg: 75,
        activityLevel: 3,
        goal: 'maintain' as const,
        units: 'metric' as const,
      },
      daily_goals: {
        calories: 2500,
        protein: 150,
        fats: 80,
        carbs: 300,
      },
      meal_reminders: [
        { id: '1', time: '08:00', label: 'Breakfast', enabled: true },
      ],
      app_preferences: {
        ai_model: 'gemini-2.5-flash',
      },
      meals: [
        {
          id: 'meal1',
          timestamp: '2024-01-01T12:00:00Z',
          image_data: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
          analysis: { meal_items: [] },
          comment: 'Test meal',
        },
      ],
    };

    it('should import valid data successfully', async () => {
      // Setup mocks
      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(JSON.stringify(validExportData));
      (FileSystem.writeAsStringAsync as jest.Mock).mockResolvedValue(undefined);
      (FileSystem.deleteAsync as jest.Mock).mockResolvedValue(undefined);
      
      UserProfileService.saveProfile = jest.fn().mockResolvedValue(undefined);
      UserProfileService.saveAIModel = jest.fn().mockResolvedValue(undefined);
      DailyGoalsService.saveDailyGoals = jest.fn().mockResolvedValue(undefined);
      MealRemindersService.saveReminders = jest.fn().mockResolvedValue(undefined);
      FileSystemStorageService.copyImageToStorage = jest.fn().mockResolvedValue('file://imported.jpg');
      FileSystemStorageService.saveMealAnalysis = jest.fn().mockResolvedValue(undefined);

      const progressCallback = jest.fn();

      // Execute
      await ExportImportService.importData('file://export.json', progressCallback);

      // Verify
      expect(FileSystem.readAsStringAsync).toHaveBeenCalledWith('file://export.json');
      expect(UserProfileService.saveProfile).toHaveBeenCalledWith(validExportData.user_profile);
      expect(DailyGoalsService.saveDailyGoals).toHaveBeenCalledWith(validExportData.daily_goals);
      expect(MealRemindersService.saveReminders).toHaveBeenCalledWith(validExportData.meal_reminders);
      expect(UserProfileService.saveAIModel).toHaveBeenCalledWith('gemini-2.5-flash');
      
      // Verify meal import
      expect(FileSystem.writeAsStringAsync).toHaveBeenCalled(); // For base64 to image conversion
      expect(FileSystemStorageService.copyImageToStorage).toHaveBeenCalled();
      expect(FileSystemStorageService.saveMealAnalysis).toHaveBeenCalled();

      // Verify progress callbacks
      expect(progressCallback).toHaveBeenCalledWith(0, 'Reading import file...');
      expect(progressCallback).toHaveBeenCalledWith(100, 'Import complete!');
    });

    it('should reject invalid schema', async () => {
      const invalidData = {
        // Missing required fields
        meals: [],
      };

      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(JSON.stringify(invalidData));

      await expect(ExportImportService.importData('file://invalid.json')).rejects.toThrow('Missing or invalid version field');
    });

    it('should handle missing meal data gracefully', async () => {
      const dataWithoutMeals = {
        ...validExportData,
        meals: [
          {
            id: 'meal1',
            timestamp: '2024-01-01T12:00:00Z',
            // No image data
            analysis: EMPTY_ANALYSIS,
          },
        ],
      };

      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(JSON.stringify(dataWithoutMeals));
      FileSystemStorageService.saveMealAnalysis = jest.fn().mockResolvedValue(undefined);

      await ExportImportService.importData('file://export.json');

      // Should still save meal without image
      expect(FileSystemStorageService.saveMealAnalysis).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'meal1',
          imageUri: '',
        })
      );
    });

    it('should handle JSON parsing errors', async () => {
      (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue('invalid json');

      await expect(ExportImportService.importData('file://bad.json')).rejects.toThrow();
    });
  });

  describe('base64 conversion', () => {
    it('should handle image conversion errors gracefully during export', async () => {
      // Mock data with image that fails to convert
      const mockMeals: MealAnalysis[] = [
        {
          id: 'meal1',
          timestamp: '2024-01-01T12:00:00Z',
          imageUri: 'file://nonexistent.jpg',
          analysis: { meal_items: [] },
        },
      ];

      UserProfileService.getProfile = jest.fn().mockResolvedValue(null);
      UserProfileService.getAIModel = jest.fn().mockResolvedValue('gemini-2.5-flash');
      DailyGoalsService.getDailyGoals = jest.fn().mockResolvedValue(null);
      MealRemindersService.getReminders = jest.fn().mockResolvedValue([]);
      FileSystemStorageService.getMealHistory = jest.fn().mockResolvedValue(mockMeals);
      
      (FileSystem.readAsStringAsync as jest.Mock).mockRejectedValue(new Error('File not found'));
      (FileSystem.writeAsStringAsync as jest.Mock).mockResolvedValue(undefined);
      (Sharing.isAvailableAsync as jest.Mock).mockResolvedValue(true);
      (Sharing.shareAsync as jest.Mock).mockResolvedValue(undefined);

      await ExportImportService.exportData();

      // Should still write the file
      expect(FileSystem.writeAsStringAsync).toHaveBeenCalled();
      const writtenContent = JSON.parse((FileSystem.writeAsStringAsync as jest.Mock).mock.calls[0][1]);
      
      // Image data should be undefined
      expect(writtenContent.meals[0].image_data).toBeUndefined();
    });
  });
}); 