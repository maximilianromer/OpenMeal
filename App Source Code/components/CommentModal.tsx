import React, { useState, useRef, useEffect } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  Platform,
  InteractionManager,
  StatusBar,
} from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { IconSymbol } from '@/components/ui/IconSymbol';

interface CommentModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (comment: string) => void;
  initialComment?: string;
  showAddAfterPicture?: boolean;
  onAddAfterPicture?: () => void;
}

export function CommentModal({ 
  visible, 
  onClose, 
  onSave, 
  initialComment = '', 
  showAddAfterPicture = false,
  onAddAfterPicture 
}: CommentModalProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [comment, setComment] = useState(initialComment);
  const textInputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      setComment(initialComment);
      // Focus the text input when modal opens
      // Use InteractionManager to wait for all interactions to complete
      InteractionManager.runAfterInteractions(() => {
        // Additional platform-specific delay for Android
        const delay = Platform.OS === 'android' ? 100 : 0;
        setTimeout(() => {
          textInputRef.current?.focus();
        }, delay);
      });
    }
  }, [visible, initialComment]);

  const handleSave = () => {
    onSave(comment);
    onClose();
  };

  const handleCancel = () => {
    setComment(initialComment); // Reset to initial value
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'fullScreen' : 'overFullScreen'}
      onRequestClose={handleCancel}
      statusBarTranslucent={Platform.OS === 'android'}
      transparent={Platform.OS === 'android'}
    >
      {Platform.OS === 'android' && (
        <View style={styles.androidOverlay} />
      )}

      <SafeAreaView style={[
        styles.container, 
        { backgroundColor: colors.background },
        Platform.OS === 'android' && styles.androidModalContent
      ]}>
        <ThemedView style={[styles.content, { backgroundColor: colors.background }]}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleCancel} style={styles.closeButton}>
              <IconSymbol name="xmark" size={24} color={colors.text} />
            </TouchableOpacity>
            
            <TouchableOpacity onPress={handleSave} style={[styles.saveButton, { backgroundColor: colors.text }]}>
              <ThemedText style={[styles.saveText, { color: colors.background }]}>
                Save
              </ThemedText>
            </TouchableOpacity>
          </View>

          {/* Add After Picture Button */}
          {showAddAfterPicture && onAddAfterPicture && (
            <TouchableOpacity 
              onPress={onAddAfterPicture} 
              style={styles.addAfterPictureButton}
            >
              <ThemedText style={[styles.addAfterPictureText, { color: colors.text }]}>
                Add After Picture
              </ThemedText>
            </TouchableOpacity>
          )}

          {/* Text Input */}
          <TextInput
            ref={textInputRef}
            style={[
              styles.textInput,
              {
                color: colors.text,
                backgroundColor: colors.background,
              }
            ]}
            placeholder="Add a comment..."
            placeholderTextColor={colors.text + '60'}
            value={comment}
            onChangeText={setComment}
            multiline
            textAlignVertical="top"
          />
        </ThemedView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  
  // Android-specific overlay and modal styles
  androidOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },

  androidModalContent: {
    marginTop: StatusBar.currentHeight || 44,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },

  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingBottom: 20,
  },
  closeButton: {
    padding: 8,
  },
  saveButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  saveText: {
    fontSize: 18,
    fontFamily: 'TikTokSans-Bold',
  },
  textInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: '500',
    lineHeight: 26,
    padding: 0,
    textAlignVertical: 'top',
  },
  addAfterPictureButton: {
    alignSelf: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  addAfterPictureText: {
    fontSize: 16,
    fontWeight: '500',
  },
});
