
import React from 'react';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';

export default function AddScreen() {
  // This screen will be hidden and functionality moved to modal
  return (
    <ThemedView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ThemedText>Add functionality moved to modal</ThemedText>
    </ThemedView>
  );
}
