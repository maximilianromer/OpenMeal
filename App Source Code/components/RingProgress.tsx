
import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { ThemedText } from '@/components/ThemedText';

interface RingProgressProps {
  value: number;
  goal: number;
  size: number;
  strokeWidth: number;
  color: string;
  label: string;
  unit: string;
}

export function RingProgress({ 
  value, 
  goal, 
  size, 
  strokeWidth, 
  color, 
  label, 
  unit 
}: RingProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(value / goal, 1);
  const strokeDashoffset = circumference - (progress * circumference);

  return (
    <View style={styles.container}>
      <ThemedText style={styles.label}>{label}</ThemedText>
      <View style={[styles.ringContainer, { width: size, height: size }]}>
        <Svg width={size} height={size} style={styles.svg}>
          {/* Background circle */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#E5E5E5"
            strokeWidth={strokeWidth}
            fill="none"
          />
          {/* Progress circle */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </Svg>
        <View style={styles.textContainer}>
          <ThemedText style={[styles.value, { color }]}>
            {Math.round(value)}
            {unit === 'kcal' ? '' : unit}
          </ThemedText>
          <ThemedText style={styles.goalText}>
            /{Math.round(goal)}{unit === 'kcal' ? '' : unit}
          </ThemedText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  label: {
    fontSize: 12,
    opacity: 0.7,
    marginBottom: 8,
  },
  ringContainer: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  svg: {
    position: 'absolute',
  },
  textContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    fontSize: 16,
    fontFamily: 'TikTokSans-Bold',
  },
  goalText: {
    fontSize: 12,
    opacity: 0.6,
  },
});
