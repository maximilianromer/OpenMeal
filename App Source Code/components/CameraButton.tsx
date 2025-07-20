import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';

interface CameraButtonProps {
  onPress: () => void;
  type: 'camera' | 'gallery';
}

export function CameraButton({ onPress, type }: CameraButtonProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const iconName = type === 'camera' ? 'camera.fill' : 'photo.fill';
  const label = type === 'camera' ? 'Take Photo' : 'Choose from Gallery';

  return (
    <TouchableOpacity 
      style={[styles.button, { borderColor: colors.tint }]} 
      onPress={onPress}
      activeOpacity={0.7}
    >
      <ThemedView style={[styles.buttonContent, { backgroundColor: colors.tint }]}>
        <IconSymbol name={iconName} size={32} color={colors.background} />
        <ThemedText style={[styles.buttonText, { color: colors.background }]}>
          {label}
        </ThemedText>
      </ThemedView>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 16,
    borderWidth: 2,
    overflow: 'hidden',
  },
  buttonContent: {
    paddingVertical: 20,
    paddingHorizontal: 24,
    alignItems: 'center',
    minWidth: 140,
  },
  buttonText: {
    marginTop: 8,
    fontSize: 14,
    fontFamily: 'TikTokSans-Bold',
  },
});
