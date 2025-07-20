import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Dimensions, DeviceEventEmitter, TouchableWithoutFeedback } from 'react-native';
import Svg, { Line, Path, Circle, Text as SvgText } from 'react-native-svg';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import FileSystemStorageService, { MealAnalysis } from '@/services/FileSystemStorageService';
import DailyGoalsService from '@/services/DailyGoalsService';

export type Nutrient = 'calories' | 'protein' | 'fats' | 'carbs';

interface NutrientData {
  date: string;
  value: number;
  dayLabel: string;
}

interface NutritionHistoryChartProps {
    nutrient: Nutrient;
}

const nutrientDetails = {
    calories: { title: 'Calories', unit: 'kcal', goalKey: 'calories' as const, dataKey: 'total_calories' as const },
    protein: { title: 'Protein', unit: 'g', goalKey: 'protein' as const, dataKey: 'total_protein_g' as const },
    fats: { title: 'Fats', unit: 'g', goalKey: 'fats' as const, dataKey: 'total_total_fat_g' as const },
    carbs: { title: 'Carbs', unit: 'g', goalKey: 'carbs' as const, dataKey: 'total_total_carbohydrate_g' as const },
};

export const NutritionHistoryChart = React.memo(({ nutrient }: NutritionHistoryChartProps) => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [chartData, setChartData] = useState<NutrientData[]>([]);
  const [goalValue, setGoalValue] = useState(0);
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null);

  const { title, unit, goalKey, dataKey } = nutrientDetails[nutrient];

  const screenWidth = Dimensions.get('window').width;
  const chartWidth = screenWidth - 60; // 30px padding on each side
  const chartHeight = 200;
  const chartPaddingTop = 40;
  const chartPaddingBottom = 40;
  const chartPaddingLeft = 10;
  const chartPaddingRight = 10;
  const plotWidth = chartWidth - chartPaddingLeft - chartPaddingRight;
  const plotHeight = chartHeight - chartPaddingTop - chartPaddingBottom;

  const loadData = React.useCallback(async () => {
    try {
      const [goals, meals] = await Promise.all([
        DailyGoalsService.getDailyGoals(),
        FileSystemStorageService.getMealHistory()
      ]);
      
      setGoalValue(goals[goalKey]);

      const last7Days: NutrientData[] = [];
      const today = new Date();
      today.setHours(23, 59, 59, 999);

      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        
        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);

        const totalValue = meals
          .filter((meal: MealAnalysis) => {
            const mealDate = new Date(meal.timestamp);
            return mealDate >= date && mealDate < nextDate;
          })
          .reduce((sum, meal) => {
            return sum + (meal.analysis?.total_meal_nutritional_values?.[dataKey] || 0);
          }, 0);

        const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        last7Days.push({
          date: date.toISOString(),
          value: Math.round(totalValue),
          dayLabel: dayLabels[date.getDay()],
        });
      }

      setChartData(last7Days);
    } catch (error) {
      console.error(`Error loading ${nutrient} data:`, error);
    }
  }, [nutrient, goalKey, dataKey]);

  useEffect(() => {
    loadData();

    const listeners = [
      DeviceEventEmitter.addListener('mealAdded', loadData),
      DeviceEventEmitter.addListener('mealUpdated', loadData),
      DeviceEventEmitter.addListener('mealDeleted', loadData),
      DeviceEventEmitter.addListener('dailyGoalsUpdated', loadData),
    ];

    return () => {
      listeners.forEach(listener => listener.remove());
    };
  }, [loadData]);

  const averageValue = chartData.length > 0
    ? Math.round(chartData.reduce((acc, curr) => acc + curr.value, 0) / chartData.length)
    : 0;

  const maxValue = Math.max(...chartData.map(d => d.value), goalValue * 1.2, 1);
  const minValue = 0;
  const valueRange = maxValue - minValue;

  const points = chartData.map((data, index) => {
    const x = chartPaddingLeft + (index / (chartData.length - 1)) * plotWidth;
    const y = chartPaddingTop + plotHeight - ((data.value - minValue) / valueRange) * plotHeight;
    return { x, y, data };
  });

  const linePath = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');

  const goalY = chartPaddingTop + plotHeight - ((goalValue - minValue) / valueRange) * plotHeight;

  const handleChartPress = (event: any) => {
    const { locationX, locationY } = event.nativeEvent;
    
    let nearestIndex = 0;
    let minDistance = Infinity;
    
    points.forEach((point, index) => {
      const distance = Math.sqrt(
        Math.pow(locationX - point.x, 2) + Math.pow(locationY - point.y, 2)
      );
      if (distance < minDistance) {
        minDistance = distance;
        nearestIndex = index;
      }
    });
    
    if (minDistance < 40) {
      setSelectedPoint(selectedPoint === nearestIndex ? null : nearestIndex);
    } else {
      setSelectedPoint(null);
    }
  };

  const getSelectedPointTextPosition = (pointIndex: number): { x: number; textAnchor: 'start' | 'middle' | 'end' } => {
    if (pointIndex === null || !points[pointIndex]) return { x: 0, textAnchor: 'middle' as const };
    
    const point = points[pointIndex];
    let x = point.x;
    let textAnchor: 'start' | 'middle' | 'end' = 'middle';
    
    if (point.x < chartPaddingLeft + 25) {
      textAnchor = 'start';
      x = point.x + 5;
    }
    else if (point.x > chartWidth - chartPaddingRight - 25) {
      textAnchor = 'end';
      x = point.x - 5;
    }
    
    return { x, textAnchor };
  };

  const chartColor = {
    calories: '#FFA726',
    protein: '#EF5350',
    fats: '#26A69A',
    carbs: '#FFEE58',
  }[nutrient];

  return (
    <ThemedView style={[styles.container, { backgroundColor: colors.background, borderColor: colors.text + '20' }]}>
      <View style={styles.header}>
        <ThemedText style={styles.title}>{title}: Week</ThemedText>
        <ThemedText style={styles.subtitle}>Last 7 days average: {averageValue} {unit}</ThemedText>
      </View>

      <View style={styles.chartContainer}>
        <View style={styles.svgContainer}>
          <Svg width={chartWidth} height={chartHeight}>
            <Line
              x1={chartPaddingLeft}
              y1={goalY}
              x2={chartWidth - chartPaddingRight}
              y2={goalY}
              stroke={colors.tint}
              strokeWidth="2"
              strokeDasharray="5,5"
              opacity={0.6}
            />
            
            <SvgText
              x={chartWidth - chartPaddingRight - 80}
              y={goalY - 5}
              fill={colors.tint}
              fontSize="12"
              textAnchor="start"
            >
              Goal: {goalValue}{nutrient !== 'calories' ? 'g' : ''}
            </SvgText>

            <Path
              d={linePath}
              stroke={chartColor}
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {points.map((point, index) => (
              <Circle
                key={index}
                cx={point.x}
                cy={point.y}
                r={selectedPoint === index ? 8 : 5}
                fill={chartColor}
                stroke={colors.background}
                strokeWidth="2"
              />
            ))}

            {points.map((point, index) => (
              <SvgText
                key={`label-${index}`}
                x={point.x}
                y={chartHeight - 15}
                fill={colors.text}
                fontSize="12"
                textAnchor="middle"
                opacity={0.7}
              >
                {point.data.dayLabel}
              </SvgText>
            ))}

            {selectedPoint !== null && (() => {
              const textPos = getSelectedPointTextPosition(selectedPoint);
              return (
                <>
                  <SvgText
                    x={textPos.x}
                    y={points[selectedPoint].y - 15}
                    fill={colors.text}
                    fontSize="14"
                    textAnchor={textPos.textAnchor as 'start' | 'middle' | 'end'}
                    fontWeight="bold"
                  >
                    {points[selectedPoint].data.value}
                  </SvgText>
                  <SvgText
                    x={textPos.x}
                    y={points[selectedPoint].y - 30}
                    fill={colors.text}
                    fontSize="12"
                    textAnchor={textPos.textAnchor as 'start' | 'middle' | 'end'}
                    opacity={0.7}
                  >
                    {unit}
                  </SvgText>
                </>
              );
            })()}
          </Svg>
          
          <TouchableWithoutFeedback onPress={handleChartPress}>
            <View style={[styles.touchOverlay, { width: chartWidth, height: chartHeight }]} />
          </TouchableWithoutFeedback>
        </View>
      </View>
    </ThemedView>
  );
});

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    marginBottom: 16,
    width: Dimensions.get('window').width - 40,
    alignSelf: 'center',
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontFamily: 'TikTokSans-Bold',
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.6,
    marginTop: 2,
  },
  chartContainer: {
    alignItems: 'center',
  },
  svgContainer: {
    position: 'relative',
  },
  touchOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: 'transparent',
  },
}); 