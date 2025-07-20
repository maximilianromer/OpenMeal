import React, { useState, useRef, useEffect } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Dimensions,
  Platform,
} from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';

interface BeforeAfterModalProps {
  visible: boolean;
  onClose: () => void;
  onPhotoTaken: (photoUri: string) => void;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export function BeforeAfterModal({ visible, onClose, onPhotoTaken }: BeforeAfterModalProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

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
        quality: 0.8,
        base64: false,
      });

      if (photo) {
        onPhotoTaken(photo.uri);
        onClose();
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
        onPhotoTaken(result.assets[0].uri);
        onClose();
      }
    } catch (error) {
      console.error('Gallery picker error:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  // Don't render anything if we don't have camera permissions
  if (!cameraPermission?.granted) {
    return (
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={onClose}
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
            onPress={onClose}
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
      onRequestClose={onClose}
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
          <TouchableOpacity onPress={onClose} style={styles.backButton}>
            <IconSymbol name="xmark" size={24} color={colors.text} />
          </TouchableOpacity>
          <ThemedText style={[styles.headerTitle, { color: colors.text }]}>
            Add After Picture
          </ThemedText>
          <View style={styles.headerSpacer} />
        </View>

        {/* Camera View */}
        <View style={styles.cameraContainer}>
          <View style={styles.cameraViewfinderContainer}>
            <View style={styles.cameraViewfinder}>
              <CameraView
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

            <View style={styles.placeholderButton} />
          </View>
        </View>

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
    marginTop: 44,
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
    fontWeight: '600',
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
    fontWeight: '600',
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
  placeholderButton: {
    width: 60,
    height: 60,
  },
}); 