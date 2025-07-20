import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Platform,
  SafeAreaView,
} from 'react-native';
import { Image } from 'expo-image';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { CommentModal } from '@/components/CommentModal';

interface FixItPreviewModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (comment: string) => void;
  beforeImageUri: string | null;
  afterImageUri: string | null;
  initialComment: string;
}

export function FixItPreviewModal({
  visible,
  onClose,
  onSave,
  beforeImageUri,
  afterImageUri,
  initialComment,
}: FixItPreviewModalProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [comment, setComment] = useState(initialComment);
  const [isLoading, setIsLoading] = useState(false);
  const [showCommentModal, setShowCommentModal] = useState(false);

  useEffect(() => {
    if (visible) {
      setComment(initialComment);
    }
  }, [visible, initialComment]);

  const handleSave = () => {
    setIsLoading(true);
    onSave(comment);
  };

  const handleOpenCommentModal = () => {
    setShowCommentModal(true);
  };

  const handleSaveComment = (newComment: string) => {
    setComment(newComment);
    setShowCommentModal(false);
  };

  if (!beforeImageUri || !afterImageUri) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerButton}>
            <IconSymbol name="xmark" size={20} color={colors.text} />
          </TouchableOpacity>
          <ThemedText style={styles.headerTitle}>Correct Meal</ThemedText>
          <View style={{ width: 40 }} />
        </View>
        
        <View style={styles.previewContainer}>
          {/* Photo Display */}
          <View style={styles.photoDisplay}>
            <View style={styles.beforeAfterContainer}>
              <View style={styles.beforeAfterImageWrapper}>
                <ThemedText style={[styles.beforeAfterLabel, { color: colors.text }]}>Before</ThemedText>
                <Image source={{ uri: beforeImageUri }} style={styles.beforeAfterImage} />
              </View>
              <View style={styles.beforeAfterImageWrapper}>
                <ThemedText style={[styles.beforeAfterLabel, { color: colors.text }]}>After</ThemedText>
                <Image source={{ uri: afterImageUri }} style={styles.beforeAfterImage} />
              </View>
            </View>
          </View>

          {/* Controls */}
          <View style={styles.controls}>
            {/* Fake Comment Input */}
            <TouchableOpacity 
              onPress={handleOpenCommentModal}
              style={[styles.fakeCommentInput, { 
                borderColor: colorScheme === 'dark' ? 'rgba(236,237,238,0.2)' : 'rgba(17,24,28,0.2)',
                backgroundColor: colorScheme === 'dark' ? 'rgba(236,237,238,0.05)' : 'rgba(17,24,28,0.03)'
              }]}
            >
              <ThemedText style={[
                styles.fakeCommentText, 
                { 
                  color: comment ? colors.text : colors.text + '60',
                  fontStyle: comment ? 'italic' : 'normal'
                }
              ]}>
                {comment || 'Add a comment...'}
              </ThemedText>
            </TouchableOpacity>

            {/* Save Button */}
            <TouchableOpacity 
              onPress={handleSave} 
              style={[styles.saveButton, { backgroundColor: colors.text }]}
              disabled={isLoading}
            >
              {isLoading ? (
                <LoadingSpinner />
              ) : (
                <ThemedText style={[styles.saveButtonText, { color: colors.background }]}>
                  Save Correction
                </ThemedText>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ThemedView>

      <CommentModal
        visible={showCommentModal}
        onClose={() => setShowCommentModal(false)}
        onSave={handleSaveComment}
        initialComment={comment}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
    container: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(0,0,0,0.1)',
    },
    headerButton: {
      padding: 4,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '600',
    },
    previewContainer: {
      flex: 1,
      justifyContent: 'space-between',
    },
    photoDisplay: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    beforeAfterContainer: {
      flexDirection: 'row',
      gap: 16,
      width: '100%',
    },
    beforeAfterImageWrapper: {
      flex: 1,
      alignItems: 'center',
    },
    beforeAfterLabel: {
      fontSize: 12,
      fontWeight: '500',
      marginBottom: 4,
      opacity: 0.7,
    },
    beforeAfterImage: {
      width: '100%',
      aspectRatio: 3 / 4,
      borderRadius: 12,
    },
    controls: {
      padding: 20,
      paddingTop: 0,
      paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    },
    fakeCommentInput: {
      borderWidth: 1,
      borderRadius: 12,
      padding: 16,
      minHeight: 100,
      marginBottom: 20,
      justifyContent: 'flex-start',
      alignItems: 'flex-start',
    },
    fakeCommentText: {
      fontSize: 16,
      lineHeight: 24,
    },
    saveButton: {
      paddingVertical: 16,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: 56,
    },
    saveButtonText: {
      fontSize: 18,
      fontWeight: '600',
    },
  }); 