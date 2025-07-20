import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  TextInput,
  DeviceEventEmitter,
  BackHandler,
  Platform,
  StatusBar,
} from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import DailyGoalsService, { DailyGoals } from '@/services/DailyGoalsService';
import { OnboardingScreen } from './OnboardingScreen';

interface DailyGoalsScreenProps {
  onClose: () => void;
}

interface EditableGoalProps {
  label: string;
  value: number;
  unit: string;
  color: string;
  onEdit: (newValue: number) => void;
}

const EditableGoal = ({ 
  label, 
  value, 
  unit, 
  color, 
  onEdit 
}: EditableGoalProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value.toString());
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const handleEdit = () => {
    setIsEditing(true);
    setEditValue(value.toString());
  };

  const handleSave = () => {
    const newValue = parseFloat(editValue);
    if (!isNaN(newValue) && newValue > 0) {
      onEdit(newValue);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditValue(value.toString());
  };

  // Save changes on component unmount if still editing
  useEffect(() => {
    return () => {
      if (isEditing) {
        const newValue = parseFloat(editValue);
        if (!isNaN(newValue) && newValue > 0) {
          onEdit(newValue);
        }
      }
    };
  }, [isEditing, editValue, onEdit]);

  if (isEditing) {
    return (
      <View style={[styles.goalCard, { backgroundColor: color }]}>
        <View style={styles.goalContent}>
          <View style={styles.goalHeader}>
            <ThemedText style={[styles.goalLabel, { color: '#000' }]}>
              {label}
            </ThemedText>
            <TouchableOpacity onPress={handleSave} style={styles.saveButton}>
              <IconSymbol name="checkmark" size={18} color="#000" />
            </TouchableOpacity>
          </View>
          <View style={styles.editContainer}>
            <TextInput
              style={[styles.goalEditInput, { color: '#000' }]}
              value={editValue}
              onChangeText={setEditValue}
              keyboardType="numeric"
              autoFocus
              onSubmitEditing={handleSave}
              onEndEditing={handleSave}
            />
            <ThemedText style={[styles.unitText, { color: '#000' }]}>
              {unit}
            </ThemedText>
          </View>
        </View>
      </View>
    );
  }

  return (
    <TouchableOpacity onPress={handleEdit} style={[styles.goalCard, { backgroundColor: color }]}>
      <View style={styles.goalContent}>
        <View style={styles.goalHeader}>
          <ThemedText style={[styles.goalLabel, { color: '#000' }]}>
            {label}
          </ThemedText>
          <View style={styles.editIcon}>
            <IconSymbol name="edit" size={16} color="#000" />
          </View>
        </View>
        <View style={styles.valueContainer}>
          <ThemedText style={[styles.goalValue, { color: '#000' }]}>
            {Math.round(value)}
          </ThemedText>
          <ThemedText style={[styles.unitText, { color: '#000' }]}>
            {unit}
          </ThemedText>
        </View>
      </View>
    </TouchableOpacity>
  );
};

export function DailyGoalsScreen({ onClose }: DailyGoalsScreenProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [goals, setGoals] = useState<DailyGoals>({
    calories: 2000,
    protein: 150,
    fats: 65,
    carbs: 250,
  });
  const [isRecalculating, setIsRecalculating] = useState(false);

  useEffect(() => {
    loadGoals();

    // Handle Android back button/gesture
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true; // Prevent default behavior
    });

    return () => {
      backHandler.remove();
    };
  }, [onClose]);

  const loadGoals = async () => {
    try {
      const dailyGoals = await DailyGoalsService.getDailyGoals();
      setGoals(dailyGoals);
    } catch (error) {
      Alert.alert('Error', 'Failed to load daily goals');
    }
  };

  const updateGoal = async (nutrientType: keyof DailyGoals, newValue: number) => {
    try {
      await DailyGoalsService.updateGoal(nutrientType, newValue);
      setGoals(prev => ({
        ...prev,
        [nutrientType]: newValue,
      }));
      DeviceEventEmitter.emit('dailyGoalsUpdated'); // Emit event after updating goals
    } catch (error) {
      Alert.alert('Error', 'Failed to update goal');
    }
  };

  if (isRecalculating) {
    return (
      <OnboardingScreen 
        mode="recalculation"
        onComplete={() => {
          setIsRecalculating(false);
          loadGoals();
        }}
        onCancel={() => setIsRecalculating(false)}
      />
    );
  }

  return (
    <Modal
      visible={true}
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'overFullScreen'}
      onRequestClose={onClose}
      statusBarTranslucent={Platform.OS === 'android'}
      transparent={Platform.OS === 'android'}
    >
      {Platform.OS === 'android' && (
        <View style={styles.androidOverlay} />
      )}

      <ThemedView style={[
        styles.container,
        Platform.OS === 'android' && styles.androidModalContent
      ]}>
        <View style={[styles.header, { borderBottomColor: colors.text + '20' }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <IconSymbol name="xmark" size={24} color={colors.text} />
          </TouchableOpacity>
          <ThemedText style={styles.headerTitle}>Daily Goals</ThemedText>
          <View style={styles.placeholder} />
        </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <ThemedText style={styles.description}>
            Set your daily nutrition targets to track your progress throughout the day.
          </ThemedText>

          <View style={styles.goalsContainer}>
            <EditableGoal
              label="Calories"
              value={goals.calories}
              unit="kcal"
              color="#FFA726"
              onEdit={(newValue) => updateGoal('calories', newValue)}
            />

            <EditableGoal
              label="Protein"
              value={goals.protein}
              unit="g"
              color="#EF5350"
              onEdit={(newValue) => updateGoal('protein', newValue)}
            />

            <EditableGoal
              label="Fats"
              value={goals.fats}
              unit="g"
              color="#26A69A"
              onEdit={(newValue) => updateGoal('fats', newValue)}
            />

            <EditableGoal
              label="Carbs"
              value={goals.carbs}
              unit="g"
              color="#FFEE58"
              onEdit={(newValue) => updateGoal('carbs', newValue)}
            />
          </View>
          
          <TouchableOpacity 
            style={styles.recalculateButton} 
            onPress={() => setIsRecalculating(true)}
          >
            <ThemedText style={[styles.recalculateButtonText, { color: colors.text }]}>Recalculate</ThemedText>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 20 : 0,
  },
  
  // Android-specific overlay and modal styles
  androidOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },

  androidModalContent: {
    marginTop: StatusBar.currentHeight || 44,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 16 : 16,
    paddingBottom: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'TikTokSans-Bold',
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    opacity: 0.7,
    marginBottom: 32,
    textAlign: 'center',
  },
  goalsContainer: {
    gap: 16,
  },
  goalCard: {
    padding: 20,
    borderRadius: 16,
    minHeight: 100,
  },
  goalContent: {
    flex: 1,
    justifyContent: 'space-between',
  },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  goalLabel: {
    fontSize: 18,
    fontFamily: 'TikTokSans-Bold',
  },
  editIcon: {
    padding: 4,
  },
  saveButton: {
    padding: 4,
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  goalValue: {
    fontSize: 32,
    fontWeight: '700',
  },
  unitText: {
    fontSize: 16,
    fontWeight: '500',
    opacity: 0.8,
  },
  editContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  goalEditInput: {
    fontSize: 32,
    fontWeight: '700',
    borderBottomWidth: 2,
    borderBottomColor: '#000',
    minWidth: 80,
    textAlign: 'left',
  },
  recalculateButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 24,
  },
  recalculateButtonText: {
    fontSize: 14,
    fontWeight: '500',
    opacity: 0.7,
  },
});