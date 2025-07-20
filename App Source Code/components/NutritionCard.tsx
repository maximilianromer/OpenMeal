import React from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';

interface NutritionCardProps {
  data: any;
  onReset: () => void;
}

export function NutritionCard({ data, onReset }: NutritionCardProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const { meal_items, total_meal_nutritional_values } = data;

  const NutrientBadge = ({ label, value, unit }: { label: string; value: number; unit: string }) => (
    <ThemedView style={[styles.nutrientBadge, { backgroundColor: colors.tint + '15' }]}>
      <ThemedText style={[styles.nutrientValue, { color: colors.tint }]}>
        {Math.round(value)}{unit}
      </ThemedText>
      <ThemedText style={styles.nutrientLabel}>{label}</ThemedText>
    </ThemedView>
  );

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="subtitle">Nutrition Analysis</ThemedText>
        <TouchableOpacity 
          style={[styles.resetButton, { backgroundColor: colors.tint }]} 
          onPress={onReset}
        >
          <ThemedText style={[styles.resetButtonText, { color: colors.background }]}>
            New Scan
          </ThemedText>
        </TouchableOpacity>
      </View>

      <ThemedView style={[styles.totalCard, { borderColor: colors.tint + '30' }]}>
        <ThemedText style={styles.totalTitle}>Total Nutrition</ThemedText>
        <View style={styles.nutrientsGrid}>
          <NutrientBadge 
            label="Calories" 
            value={total_meal_nutritional_values.total_calories} 
            unit=" kcal" 
          />
          <NutrientBadge 
            label="Carbs" 
            value={total_meal_nutritional_values.total_total_carbohydrate_g} 
            unit="g" 
          />
          <NutrientBadge 
            label="Protein" 
            value={total_meal_nutritional_values.total_protein_g} 
            unit="g" 
          />
          <NutrientBadge 
            label="Fat" 
            value={total_meal_nutritional_values.total_total_fat_g} 
            unit="g" 
          />
        </View>
      </ThemedView>

      <ThemedText type="defaultSemiBold" style={styles.itemsTitle}>
        Food Items
      </ThemedText>

      {meal_items.map((item: any, index: number) => (
        <ThemedView key={index} style={[styles.itemCard, { borderColor: colors.text + '20' }]}>
          <View style={styles.itemHeader}>
            <ThemedText style={styles.itemName}>{item.item_name}</ThemedText>
            <ThemedText style={styles.servingSize}>{item.estimated_serving_size}</ThemedText>
          </View>

          <View style={styles.itemNutrients}>
            <View style={styles.nutrientRow}>
              <ThemedText style={styles.nutrientText}>
                {Math.round(item.calories)} kcal
              </ThemedText>
              <ThemedText style={styles.nutrientText}>
                {Math.round(item.total_carbohydrate_g)}g carbs
              </ThemedText>
            </View>
            <View style={styles.nutrientRow}>
              <ThemedText style={styles.nutrientText}>
                {Math.round(item.protein_g)}g protein
              </ThemedText>
              <ThemedText style={styles.nutrientText}>
                {Math.round(item.total_fat_g)}g fat
              </ThemedText>
            </View>
          </View>

          {item.notes && (
            <ThemedText style={styles.notes}>{item.notes}</ThemedText>
          )}
        </ThemedView>
      ))}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  resetButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  resetButtonText: {
    fontSize: 14,
    fontFamily: 'TikTokSans-SemiBold',
  },
  totalCard: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 24,
  },
  totalTitle: {
    fontSize: 18,
    fontFamily: 'TikTokSans-Bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  nutrientsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  nutrientBadge: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
  },
  nutrientValue: {
    fontSize: 20,
    fontFamily: 'TikTokSans-Bold',
  },
  nutrientLabel: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 4,
  },
  itemsTitle: {
    marginBottom: 16,
    fontSize: 16,
  },
  itemCard: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  itemName: {
    fontSize: 16,
    fontFamily: 'TikTokSans-SemiBold',
    flex: 1,
  },
  servingSize: {
    fontSize: 14,
    opacity: 0.7,
  },
  itemNutrients: {
    gap: 8,
  },
  nutrientRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  nutrientText: {
    fontSize: 14,
    opacity: 0.8,
  },
  notes: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 8,
    fontStyle: 'italic',
  },
  notesText: {
    fontSize: 14,
    opacity: 0.7,
    lineHeight: 20,
  },
});