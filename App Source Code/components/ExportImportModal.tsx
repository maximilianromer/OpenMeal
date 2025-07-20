import React from 'react';
import {
  Modal,
  View,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';

interface ExportImportModalProps {
  visible: boolean;
  progress: number;
  message: string;
  isError?: boolean;
}

export function ExportImportModal({ 
  visible, 
  progress, 
  message,
  isError = false 
}: ExportImportModalProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <ThemedView style={[
          styles.container,
          { backgroundColor: colors.background }
        ]}>
          <View style={styles.content}>
            {!isError && (
              <ActivityIndicator 
                size="large" 
                color={colors.tint} 
                style={styles.spinner}
              />
            )}
            
            <ThemedText style={[
              styles.message,
              isError && styles.errorMessage
            ]}>
              {message}
            </ThemedText>
            
            {!isError && progress > 0 && progress < 100 && (
              <View style={[styles.progressBar, { backgroundColor: colors.text + '20' }]}>
                <View 
                  style={[
                    styles.progressFill, 
                    { 
                      width: `${progress}%`,
                      backgroundColor: colors.tint 
                    }
                  ]} 
                />
              </View>
            )}
            
            {!isError && (
              <ThemedText style={styles.progressText}>
                {Math.round(progress)}%
              </ThemedText>
            )}
          </View>
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 320,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  content: {
    alignItems: 'center',
  },
  spinner: {
    marginBottom: 20,
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  errorMessage: {
    color: '#EF5350',
    fontWeight: '600',
  },
  progressBar: {
    height: 6,
    width: '100%',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 14,
    opacity: 0.6,
  },
}); 