import React from 'react';
import { View, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Image } from 'expo-image';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import FileSystemStorageService, { MealAnalysis } from '@/services/FileSystemStorageService';

interface MealHistoryCardProps {
  meal: MealAnalysis;
  onDelete: () => void;
}

export function MealHistoryCard({ meal, onDelete }: MealHistoryCardProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const showDetails = () => {
    const { total_meal_nutritional_values, meal_items } = meal.analysis;
    const itemsList = meal_items.map((item: any) => 
      `• ${item.item_name} (${item.estimated_serving_size})`
    ).join('\n');

    Alert.alert(
      'Meal Details',
      `Total: ${Math.round(total_meal_nutritional_values.total_calories)} kcal, ${Math.round(total_meal_nutritional_values.total_protein_g)}g protein\n\nItems:\n${itemsList}`,
      [{ text: 'OK' }]
    );
  };

  const totalCalories = meal.analysis.total_meal_nutritional_values?.total_calories || 0;
  const itemCount = meal.analysis.meal_items?.length || 0;

  const handleDelete = async () => {
    await FileSystemStorageService.deleteMeal(meal.id);
    onDelete();
  };

  return (
    <TouchableOpacity onPress={showDetails} activeOpacity={0.7}>
      <ThemedView style={[styles.card, { borderColor: colors.text + '20' }]}>
        <View style={styles.imageContainer}>
          {meal.imageUri ? (
            <Image source={{ uri: meal.imageUri }} style={styles.image} />
          ) : (
            <IconSymbol name="photo" size={32} color={colors.text + '60'} />
          )}
        </View>

        <View style={styles.content}>
          <View style={styles.header}>
            <ThemedText style={styles.date}>{formatDate(meal.timestamp)}</ThemedText>
            <TouchableOpacity onPress={handleDelete} style={styles.deleteButton}>
              <IconSymbol name="trash" size={18} color={colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.nutrition}>
            <View style={styles.nutritionItem}>
              <ThemedText style={[styles.nutritionValue, { color: colors.tint }]}>
                {Math.round(totalCalories)}
              </ThemedText>
              <ThemedText style={styles.nutritionLabel}>kcal</ThemedText>
            </View>
            <View style={styles.nutritionItem}>
              <ThemedText style={[styles.nutritionValue, { color: colors.tint }]}>
                {itemCount}
              </ThemedText>
              <ThemedText style={styles.nutritionLabel}>
                item{itemCount !== 1 ? 's' : ''}
              </ThemedText>
            </View>
          </View>
        </View>
      </ThemedView>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  imageContainer: {
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: 'hidden',
    marginRight: 16,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  date: {
    fontSize: 14,
    opacity: 0.7,
  },
  deleteButton: {
    padding: 4,
  },
  nutrition: {
    flexDirection: 'row',
    gap: 20,
  },
  nutritionItem: {
    alignItems: 'center',
  },
  nutritionValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  nutritionLabel: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 2,
  },
});