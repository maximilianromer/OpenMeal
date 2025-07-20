import { View, StyleSheet } from 'react-native';
import { useColorScheme } from '@/hooks/useColorScheme';

// This is a shim for web and Android where the tab bar is generally opaque.
export default function TabBarBackground() {
  const colorScheme = useColorScheme();
  
  return (
    <View 
      style={[
        StyleSheet.absoluteFill,
        {
          backgroundColor: colorScheme === 'dark' ? '#1C1C1C' : '#FFFFFF',
          borderTopWidth: 0.5,
          borderTopColor: colorScheme === 'dark' ? '#2C2C2E' : '#E5E5EA',
        }
      ]} 
    />
  );
}

export function useBottomTabOverflow() {
  return 0;
}
