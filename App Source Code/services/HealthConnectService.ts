import { Platform, Alert } from 'react-native';
import FileSystemStorageService from './FileSystemStorageService';
import * as SecureStore from 'expo-secure-store';
import type { MealAnalysis } from './FileSystemStorageService';

// Import Health Connect types and functions
let healthConnect: any = null;
let HealthConnectModule: any = null;

try {
  // This will only work in a proper Android build with the native module installed
  if (Platform.OS === 'android') {
    HealthConnectModule = require('react-native-health-connect');
    healthConnect = HealthConnectModule.default || HealthConnectModule;
  }
} catch (error) {
  console.log('Health Connect module not available - this is expected in development/Expo Go');
}

// CONSTANT KEY TO PERSIST PERMISSION STATE
const HC_PERMISSION_KEY = 'HC_WRITE_PERMISSION_GRANTED';

// Key used to persist the last clientRecordVersion for each meal
const HC_VERSION_MAP_KEY = 'HC_MEAL_VERSION_MAP';

type VersionMap = Record<string, number>;

async function readVersionMap(): Promise<VersionMap> {
  try {
    const raw = await SecureStore.getItemAsync(HC_VERSION_MAP_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function writeVersionMap(map: VersionMap) {
  try {
    await SecureStore.setItemAsync(HC_VERSION_MAP_KEY, JSON.stringify(map));
  } catch (e) {
    console.warn('[HealthConnect] Failed to persist version map', e);
  }
}

/**
 * Returns the next monotonically-increasing clientRecordVersion for a given meal id.
 */
async function getNextVersion(mealId: string): Promise<{ version: number; map: VersionMap }>
{
  const map = await readVersionMap();
  const next = (map[mealId] ?? 0) + 1;
  return { version: next, map };
}

// Helper to persist permission flag securely
async function setPermissionGranted(granted: boolean) {
  try {
    if (granted) {
      await SecureStore.setItemAsync(HC_PERMISSION_KEY, 'true');
    } else {
      await SecureStore.deleteItemAsync(HC_PERMISSION_KEY);
    }
  } catch (e) {
    console.warn('[HealthConnect] Failed to persist permission state', e);
  }
}

// Helper to read persisted flag
async function getPersistedPermission(): Promise<boolean> {
  try {
    const value = await SecureStore.getItemAsync(HC_PERMISSION_KEY);
    return value === 'true';
  } catch {
    return false;
  }
}

/**
 * Initializes the native Health Connect client (Android-only).
 */
async function ensureInitialized(): Promise<boolean> {
  if (Platform.OS !== 'android' || !healthConnect) return false;
  try {
    const initialized = await healthConnect.initialize();
    return !!initialized;
  } catch (err) {
    console.warn('[HealthConnect] initialize() failed', err);
    return false;
  }
}

/**
 * Checks whether WRITE permission for Nutrition records is already granted.
 */
export async function hasWritePermission(): Promise<boolean> {
  if (Platform.OS !== 'android' || !healthConnect) return false;

  // Ensure the client is initialized before checking permissions
  await ensureInitialized();

  // Try native check first
  try {
    const grantedList = await healthConnect.getGrantedPermissions?.();
    if (Array.isArray(grantedList)) {
      const granted = grantedList.some(
        (p: any) => p.recordType === 'Nutrition' && p.accessType === 'write'
      );
      // Persist the *current* permission state so that revocations are reflected
      await setPermissionGranted(granted);
      return granted;
    }
  } catch (e) {
    console.warn('[HealthConnect] getGrantedPermissions() failed, falling back to persisted flag', e);
  }

  // Fallback to persisted flag (may be stale if user revoked in settings)
  return getPersistedPermission();
}

/**
 * Requests WRITE permission from the user. Should be triggered from Settings.
 * On success, all existing meals will be synced once.
 */
export async function requestHealthConnectPermission() {
  if (Platform.OS !== 'android') {
    Alert.alert('Not supported', 'Health Connect is only available on Android devices.');
    return false;
  }

  if (!healthConnect) {
    Alert.alert(
      'Health Connect not available',
      'Please ensure you have installed the Health Connect library and rebuilt the app.'
    );
    return false;
  }

  const initOK = await ensureInitialized();
  if (!initOK) {
    Alert.alert('Initialization failed', 'Failed to initialize Health Connect.');
    return false;
  }

  try {
    const permissions = await healthConnect.requestPermission([
      { accessType: 'write', recordType: 'Nutrition' },
    ]);

    const granted = Array.isArray(permissions) && permissions.some(
      (p: any) => p.recordType === 'Nutrition' && p.accessType === 'write'
    );

    if (granted) {
      await setPermissionGranted(true);
      // After permission granted, perform a one-time full sync of existing meals
      try {
        await syncMealsToHealthConnect();
      } catch (e) {
        console.warn('[HealthConnect] Initial full sync failed', e);
      }
      return true;
    } else {
      Alert.alert('Permission not granted', 'Nutrition write permission was declined.');
      await setPermissionGranted(false);
      return false;
    }
  } catch (err: any) {
    console.error('Health Connect permission request error:', err);
    Alert.alert('Permission error', err?.message ?? 'Unknown error requesting permission.');
    return false;
  }
}

/**
 * Converts a MealAnalysis object to a single Nutrition record compatible with Health Connect.
 */
function convertMealToNutritionRecord(meal: MealAnalysis) {
  if (!meal?.analysis?.total_meal_nutritional_values) return null;
  const totals = meal.analysis.total_meal_nutritional_values;
  const mealDate = new Date(meal.timestamp);
  const endDate = new Date(mealDate.getTime() + 60 * 1000);

  return async (version: number) => ({
    recordType: 'Nutrition',
    metadata: {
      clientRecordId: meal.id,
      clientRecordVersion: version,
    },
    startTime: mealDate.toISOString(),
    endTime: endDate.toISOString(),
    name: meal.analysis?.title ?? 'Meal',
    mealType: 0, // UNKNOWN
    energy: { value: totals.total_calories || 0, unit: 'kilocalories' },
    protein: { value: totals.total_protein_g || 0, unit: 'grams' },
    totalCarbohydrate: { value: totals.total_total_carbohydrate_g || 0, unit: 'grams' },
    totalFat: { value: totals.total_total_fat_g || 0, unit: 'grams' },
  });
}

/**
 * Writes (or updates) a single meal to Health Connect if permission is granted.
 * This is called automatically when a meal is added or edited.
 */
export async function writeMealToHealthConnect(meal: MealAnalysis) {
  if (Platform.OS !== 'android' || !(await hasWritePermission()) || !healthConnect) {
    return;
  }

  const { version, map } = await getNextVersion(meal.id);
  const recordBuilder = convertMealToNutritionRecord(meal);
  if (!recordBuilder) return;
  const record = await recordBuilder(version);

  const initOK = await ensureInitialized();
  if (!initOK) return;

  try {
    const { insertRecords, writeRecords } = healthConnect ?? {};

    if (typeof insertRecords === 'function') {
      // Best: insertRecords will upsert when clientRecordId matches
      await insertRecords([record]);
    } else if (typeof writeRecords === 'function') {
      // writeRecords provides similar upsert semantics with clientRecordId in newer SDKs
      await writeRecords('Nutrition', [record]);
    } else {
      console.warn('[HealthConnect] No insert/write method found; cannot sync meal');
      return;
    }

    // Persist the successful version
    map[meal.id] = version;
    await writeVersionMap(map);
  } catch (err) {
    console.warn('[HealthConnect] Failed to write meal', err);
  }
}

export async function syncMealsToHealthConnect() {
  if (Platform.OS !== 'android') {
    Alert.alert('Not supported', 'Health Connect is only available on Android devices.');
    return;
  }

  if (!healthConnect) {
    Alert.alert(
      'Health Connect not available',
      'Please ensure you have installed the Health Connect library and rebuilt the app.'
    );
    return;
  }

  try {
    // 1. Initialize client
    console.log('Initializing Health Connect...');
    const initialized = await healthConnect.initialize();
    console.log('Health Connect initialized:', initialized);
    
    if (!initialized) {
      Alert.alert('Failed to initialize', 'Failed to initialize Health Connect client');
      return;
    }

    // 2. Request permissions
    console.log('Requesting permissions...');
    const permissions = await healthConnect.requestPermission([
      { accessType: 'write', recordType: 'Nutrition' },
    ]);
    
    console.log('Permissions response:', permissions);

    // Check if permissions were granted
    const hasWritePermission = permissions && permissions.length > 0 && 
      permissions.some((p: any) => 
        p.recordType === 'Nutrition' && 
        p.accessType === 'write'
      );

    if (!hasWritePermission) {
      Alert.alert(
        'Permission required',
        'Write permission to Nutrition data in Health Connect was not granted.'
      );
      return;
    }

    // 3. Retrieve meal history from local storage
    const meals = await FileSystemStorageService.getMealHistory();
    if (!meals.length) {
      Alert.alert('No meals found', 'There is no logged meal data to sync.');
      return;
    }

    // 4. Map meals to Nutrition records expected by Health Connect
    // Based on the Android Health Connect documentation and the library's expected format
    const nutritionRecords = meals
      .filter((m) => m.analysis && m.analysis.total_meal_nutritional_values)
      .map((meal) => {
        const totals = meal.analysis.total_meal_nutritional_values;
        const mealDate = new Date(meal.timestamp);
        // Add 1 minute for the meal duration as endTime must be after startTime
        const endDate = new Date(mealDate.getTime() + 60 * 1000);
        
        // Create a nutrition record following the expected format
        // The library expects energy values in specific units
        return {
          recordType: 'Nutrition',
          startTime: mealDate.toISOString(),
          endTime: endDate.toISOString(),
          name: meal.analysis?.title ?? 'Meal',
          mealType: 0, // UNKNOWN
          // Energy value in kilocalories
          energy: {
            value: totals.total_calories || 0,
            unit: 'kilocalories',
          },
          // Macronutrients in grams
          protein: {
            value: totals.total_protein_g || 0,
            unit: 'grams',
          },
          totalCarbohydrate: {
            value: totals.total_total_carbohydrate_g || 0,
            unit: 'grams',
          },
          totalFat: {
            value: totals.total_total_fat_g || 0,
            unit: 'grams',
          },
        };
      });

    if (!nutritionRecords.length) {
      Alert.alert('Nothing to sync', 'No meals contained nutritional information to write.');
      return;
    }

    // 5. Write records to Health Connect
    console.log('Writing nutrition records:', nutritionRecords.length);
    console.log('First record example:', JSON.stringify(nutritionRecords[0], null, 2));
    
    let successCount = 0;
    let failedCount = 0;
    
    try {
      // Use the appropriate method to write records
      const {
        writeRecords,
        insertRecords,
      } = healthConnect ?? {};

      try {
        if (typeof writeRecords === 'function') {
          // Newer versions of the SDK expose writeRecords(recordType, records[])
          console.log('Using writeRecords(recordType, records) signature');
          await writeRecords('Nutrition', nutritionRecords);
          successCount = nutritionRecords.length;
        } else if (typeof insertRecords === 'function') {
          // Older versions expose insertRecords(records[])
          console.log('Using legacy insertRecords(records) signature');
          await insertRecords(nutritionRecords);
          successCount = nutritionRecords.length;
        } else {
          throw new Error('No suitable write method (writeRecords / insertRecords) found on the Health Connect client');
        }
      } catch (writeErr: any) {
        console.error('Failed to write nutrition records:', writeErr);
        failedCount = nutritionRecords.length;
      }

      // Provide user feedback
      if (successCount > 0) {
        Alert.alert(
          'Sync complete',
          `Successfully synced ${successCount} meal${successCount !== 1 ? 's' : ''} to Health Connect.${failedCount > 0 ? ` ${failedCount} meals failed to sync.` : ''}`
        );
      } else {
        Alert.alert('Sync failed', 'No meals were successfully synced to Health Connect.');
      }
    } catch (writeError: any) {
      console.error('Failed to write records to Health Connect:', writeError);
      Alert.alert(
        'Sync failed', 
        `An error occurred while syncing with Health Connect: ${writeError.message || 'Unknown error'}`
      );
    }
  } catch (error: any) {
    console.error('Health Connect sync error:', error);
    Alert.alert(
      'Sync failed', 
      `Failed to sync with Health Connect: ${error.message || 'Unknown error'}`
    );
  }
} 