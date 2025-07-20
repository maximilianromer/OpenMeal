import React from 'react';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import { StyleSheet, View } from 'react-native';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function BlurTabBarBackground() {
  const colorScheme = useColorScheme();
  
  return (
    <>
      <BlurView
        // System chrome material automatically adapts to the system's theme
        // and matches the native tab bar appearance on iOS.
        tint={colorScheme === 'dark' ? 'dark' : 'light'}
        intensity={80}
        style={StyleSheet.absoluteFill}
      />
      <View 
        style={[
          StyleSheet.absoluteFill,
          {
            borderTopWidth: 0.5,
            borderTopColor: colorScheme === 'dark' ? '#2C2C2E40' : '#E5E5EA40',
          }
        ]} 
      />
    </>
  );
}

export function useBottomTabOverflow() {
  return useBottomTabBarHeight();
}
