import React, { useState, useRef, useEffect } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Dimensions,
  DeviceEventEmitter,
  Platform,
  StatusBar,
} from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import GeminiService from '@/services/GeminiService';
import FileSystemStorageService, { EMPTY_ANALYSIS } from '@/services/FileSystemStorageService';
import * as FileSystem from 'expo-file-system';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { CommentModal } from '@/components/CommentModal';
import { BeforeAfterModal } from '@/components/BeforeAfterModal';
import { setBackgroundColorAsync } from 'expo-system-ui';
import { setStatusBarStyle } from 'expo-status-bar';
import { writeMealToHealthConnect } from '@/services/HealthConnectService';
import * as Notifications from 'expo-notifications';
import { processMeal } from '@/services/AnalysisProcessor';

interface AddMealModalProps {
  visible: boolean;
  onClose: () => void;
  onMealAdded: () => void;
}

type Stage = 'camera' | 'preview';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Custom hook to manage system UI for modal
const useModalSystemUI = (visible: boolean, colorScheme: 'light' | 'dark') => {
  useEffect(() => {
    if (Platform.OS === 'android' && visible) {
      // Set background color to prevent white flash
      setBackgroundColorAsync(colorScheme === 'dark' ? '#000000' : '#ffffff');
      setStatusBarStyle(colorScheme === 'dark' ? 'light' : 'dark', true);
    }

    return () => {
      if (Platform.OS === 'android' && visible) {
        // Reset to default when modal closes
        setBackgroundColorAsync(colorScheme === 'dark' ? '#121212' : '#ffffff');
      }
    };
  }, [visible, colorScheme]);
};

export function AddMealModal({ visible, onClose, onMealAdded }: AddMealModalProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  // Use the system UI hook
  useModalSystemUI(visible, colorScheme ?? 'light');

  // Stage management
  const [stage, setStage] = useState<Stage>('camera');
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [afterPhoto, setAfterPhoto] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [showBeforeAfterModal, setShowBeforeAfterModal] = useState(false);
  const [skipFlow, setSkipFlow] = useState(false);

  // Camera setup
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [cameraType] = useState<CameraType>('back');
  const cameraRef = useRef<CameraView>(null);

  // Request camera permissions when modal opens
  useEffect(() => {
    if (visible && !cameraPermission?.granted) {
      requestCameraPermission();
    }
  }, [visible, cameraPermission]);

  

  const takePicture = async () => {
    if (!cameraRef.current) return;

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 1.0,
        base64: false,
      });

      if (photo) {
        setCapturedPhoto(photo.uri);
        setStage('preview');
      }
    } catch (error) {
      console.error('Error taking picture:', error);
      Alert.alert('Error', 'Failed to take picture. Please try again.');
    }
  };

  const pickFromGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant photo library permissions to use this feature.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: false,
        quality: 1.0,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        setCapturedPhoto(result.assets[0].uri);
        setStage('preview');
      }
    } catch (error) {
      console.error('Gallery picker error:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };


  const retakePhoto = () => {
    setCapturedPhoto(null);
    setAfterPhoto(null);
    setComment('');
    setStage('camera');
  };

  const handleBeforeAfter = () => {
    setShowBeforeAfterModal(true);
  };

  const handleAfterPhotoTaken = (photoUri: string) => {
    setAfterPhoto(photoUri);
  };

  const handleOpenCommentModal = () => {
    setShowCommentModal(true);
  };

  const handleSkip = () => {
    setSkipFlow(true);
    setShowCommentModal(true);
  };

  const handleSaveComment = (newComment: string) => {
    setShowCommentModal(false);
    if (skipFlow) {
      saveMealWithoutPhoto(newComment);
    } else {
      setComment(newComment);
    }
  };

  const saveMealWithoutPhoto = async (commentText: string) => {
    setIsLoading(true);
    try {
      const mealId = Date.now().toString();

      // Create a pending meal entry with loading state
      const pendingMeal = {
        id: mealId,
        timestamp: new Date().toISOString(),
        imageUri: '',
        analysis: null, // null indicates loading state
        comment: commentText,
        isLoading: true,
        hasError: false
      };

      // Save pending meal immediately
      await FileSystemStorageService.savePendingMeal(pendingMeal);

      // Emit event for immediate UI update
      DeviceEventEmitter.emit('mealAdded', pendingMeal);

      // Close modal and reset state immediately
      resetModal();
      onClose();

      // Notify parent that meal was added
      onMealAdded();

      // Process analysis using the new service
      processMeal(pendingMeal);

      // Dismiss all notifications
      await Notifications.dismissAllNotificationsAsync();

    } catch (error) {
      Alert.alert('Error', 'Failed to save meal. Please try again.');
      console.error('Save comment meal error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveMeal = async () => {
    if (!capturedPhoto) {
      Alert.alert('No photo', 'Please take a photo of your meal.');
      return;
    }

    setIsLoading(true);

    try {
      const mealId = Date.now().toString();

      // Create a pending meal entry with loading state
      const pendingMeal = {
        id: mealId,
        timestamp: new Date().toISOString(),
        imageUri: capturedPhoto,
        afterImageUri: afterPhoto || undefined,
        analysis: null, // null indicates loading state
        comment: comment,
        isLoading: true
      };

      // Save pending meal immediately
      await FileSystemStorageService.savePendingMeal(pendingMeal);

      // Emit event for immediate UI update
      DeviceEventEmitter.emit('mealAdded', pendingMeal);

      // Close modal and reset state immediately
      resetModal();
      onClose();

      // Notify parent that meal was added
      onMealAdded();

      // Process analysis using the new service
      processMeal(pendingMeal);

      // Dismiss all notifications
      await Notifications.dismissAllNotificationsAsync();

    } catch (error) {
      Alert.alert('Error', 'Failed to save meal. Please try again.');
      console.error('Save error:', error);
      setIsLoading(false);
    }
  };

  const resetModal = () => {
    setStage('camera');
    setCapturedPhoto(null);
    setAfterPhoto(null);
    setComment('');
    setShowCommentModal(false);
    setShowBeforeAfterModal(false);
    setSkipFlow(false);
    setIsLoading(false);
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  // Don't render anything if we don't have camera permissions
  if (!cameraPermission?.granted) {
    return (
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={handleClose}
      >
        <ThemedView style={styles.permissionContainer}>
          <IconSymbol name="camera.fill" size={64} color={colors.text} />
          <ThemedText style={styles.permissionTitle}>Camera Access Required</ThemedText>
          <ThemedText style={styles.permissionText}>
            Please grant camera permissions to take photos of your meals.
          </ThemedText>
          <TouchableOpacity 
            style={[styles.permissionButton, { backgroundColor: colors.tint }]}
            onPress={requestCameraPermission}
          >
            <ThemedText style={[styles.permissionButtonText, { color: colors.background }]}>
              Grant Permission
            </ThemedText>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.permissionCancelButton}
            onPress={handleClose}
          >
            <ThemedText style={[styles.permissionCancelText, { color: colors.text }]}>
              Cancel
            </ThemedText>
          </TouchableOpacity>
        </ThemedView>
      </Modal>
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'overFullScreen'}
      onRequestClose={handleClose}
      statusBarTranslucent={Platform.OS === 'android'}
      transparent={Platform.OS === 'android'}
    >
      {Platform.OS === 'android' && (
        <View style={styles.androidOverlay} />
      )}

      <ThemedView style={[
        styles.container, 
        { backgroundColor: colors.background },
        Platform.OS === 'android' && styles.androidModalContent
      ]}>

        {/* Header */}
        <View style={[styles.header, { 
          backgroundColor: colors.background
        }]}>
          <TouchableOpacity onPress={handleClose} style={styles.backButton}>
            <IconSymbol name="xmark" size={24} color={colors.text} />
          </TouchableOpacity>
          <ThemedText style={[styles.headerTitle, { color: colors.text }]}>
            {stage === 'camera' ? 'Add Meal' : 'Add Meal'}
          </ThemedText>
          <View style={styles.headerSpacer} />
        </View>

        {/* Stage 1: Camera View */}
        {stage === 'camera' && (
          <View style={styles.cameraContainer}>
            <View style={styles.cameraViewfinderContainer}>
              <View style={styles.cameraViewfinder}>
                <CameraView
                  key={cameraPermission?.granted ? 'camera-granted' : 'camera-denied'}
                  ref={cameraRef}
                  style={styles.camera}
                  facing={cameraType}
                  autofocus="on"
                />
              </View>
            </View>

            {/* Camera Controls */}
            <View style={[styles.cameraControls, { 
              backgroundColor: colorScheme === 'dark' ? 'rgba(21,23,24,0.95)' : 'rgba(255,255,255,0.95)'
            }]}>
              <TouchableOpacity onPress={pickFromGallery} style={styles.galleryButton}>
                <IconSymbol name="photo" size={28} color={colors.text} />
              </TouchableOpacity>

              <TouchableOpacity onPress={takePicture} style={[styles.shutterButton, { 
                backgroundColor: colors.tint,
                borderColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.1)'
              }]}>
                <View style={[styles.shutterInner, { backgroundColor: colors.tint }]} />
              </TouchableOpacity>

              <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
                <ThemedText style={{ color: colors.text }}>Skip</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Stage 2: Photo Preview */}
        {stage === 'preview' && capturedPhoto && (
          <View style={styles.previewContainer}>
            {/* Photo Display */}
            <View style={styles.photoContainer}>
              {afterPhoto ? (
                <View style={styles.beforeAfterContainer}>
                  <View style={styles.beforeAfterImageWrapper}>
                    <ThemedText style={[styles.beforeAfterLabel, { color: colors.text }]}>Before</ThemedText>
                    <Image source={{ uri: capturedPhoto }} style={styles.beforeAfterImage} />
                  </View>
                  <View style={styles.beforeAfterImageWrapper}>
                    <ThemedText style={[styles.beforeAfterLabel, { color: colors.text }]}>After</ThemedText>
                    <Image source={{ uri: afterPhoto }} style={styles.beforeAfterImage} />
                  </View>
                </View>
              ) : (
                <Image source={{ uri: capturedPhoto }} style={styles.capturedPhoto} />
              )}
            </View>

            {/* Controls */}
            <View style={styles.previewControls}>
              <View style={styles.actionButtonsContainer}>
                <TouchableOpacity onPress={retakePhoto} style={styles.actionButton}>
                  <ThemedText style={[styles.actionButtonText, { color: colors.text }]}>Retake</ThemedText>
                </TouchableOpacity>
                
                <ThemedText style={[styles.actionButtonSeparator, { color: colors.text + '40' }]}>•</ThemedText>
                
                <TouchableOpacity onPress={handleBeforeAfter} style={styles.actionButton}>
                  <ThemedText style={[styles.actionButtonText, { color: colors.text }]}>Before & After</ThemedText>
                </TouchableOpacity>
              </View>

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

              <TouchableOpacity 
                onPress={saveMeal} 
                style={[styles.saveButton, { backgroundColor: colors.text }]}
                disabled={isLoading}
              >
                {isLoading ? (
                  <LoadingSpinner />
                ) : (
                  <ThemedText style={[styles.saveButtonText, { color: colors.background }]}>
                    Save
                  </ThemedText>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Comment Modal */}
        <CommentModal
          visible={showCommentModal}
          onClose={() => setShowCommentModal(false)}
          onSave={handleSaveComment}
          initialComment={comment}
        />

        {/* Before & After Modal */}
        <BeforeAfterModal
          visible={showBeforeAfterModal}
          onClose={() => setShowBeforeAfterModal(false)}
          onPhotoTaken={handleAfterPhotoTaken}
        />
      </ThemedView>
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

  // Permission styles
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  permissionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 16,
    textAlign: 'center',
  },
  permissionText: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.7,
    marginBottom: 40,
    lineHeight: 24,
  },
  permissionButton: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginBottom: 16,
  },
  permissionButtonText: {
    fontSize: 16,
    fontFamily: 'TikTokSans-Bold',
  },
  permissionCancelButton: {
    paddingVertical: 12,
  },
  permissionCancelText: {
    fontSize: 16,
  },

  // Header styles
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'android' ? 16 : 16,
    paddingHorizontal: 20,
    paddingBottom: 16,
    zIndex: 10,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontFamily: 'TikTokSans-Bold',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },

  // Camera styles
  cameraContainer: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 0,
  },
  cameraViewfinderContainer: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    width: '100%',
    paddingTop: 0,
    paddingBottom: 120,
  },
  cameraViewfinder: {
    width: screenWidth - 40,
    height: Math.min((screenWidth - 40) * 4 / 3, screenHeight * 0.6),
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  camera: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  cameraControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 30,
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 40 : 20,
    left: 0,
    right: 0,
  },
  galleryButton: {
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 30,
  },
  shutterButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  shutterInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  skipButton: {
    width: 70,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 30,
  },

  // Preview styles
  previewContainer: {
    flex: 1,
    paddingTop: 0,
  },
  photoContainer: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 0,
  },
  capturedPhoto: {
    width: screenWidth - 40,
    height: (screenWidth - 40) * 4 / 3,
    borderRadius: 16,
  },
  previewControls: {
    padding: 20,
    paddingBottom: 40,
  },
  retakeButton: {
    alignSelf: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  retakeText: {
    fontSize: 16,
    fontWeight: '500',
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  actionButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  actionButtonSeparator: {
    fontSize: 16,
    marginHorizontal: 8,
  },
  beforeAfterContainer: {
    flexDirection: 'row',
    gap: 8,
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
    fontFamily: 'TikTokSans-Bold',
  },
});