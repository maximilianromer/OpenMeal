import React, { useState, useRef } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  TextInput,
  DeviceEventEmitter,
  Platform,
  TouchableWithoutFeedback,
  InteractionManager,
} from 'react-native';
import { Image } from 'expo-image';
import * as MediaLibrary from 'expo-media-library';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import FileSystemStorageService, { MealAnalysis } from '@/services/FileSystemStorageService';
import { DateTimePickerModal } from '@/components/DateTimePickerModal';
import { CommentModal } from '@/components/CommentModal';
import { BeforeAfterModal } from '@/components/BeforeAfterModal';
import { FixItPreviewModal } from '@/components/FixItPreviewModal';
import GeminiService from '@/services/GeminiService';
import * as FileSystem from 'expo-file-system';
import { writeMealToHealthConnect } from '@/services/HealthConnectService';

interface MealDetailModalProps {
  visible: boolean;
  onClose: () => void;
  meal: MealAnalysis | null;
  onDelete: () => void;
}

interface EditableNutrientProps {
  label: string;
  value: number;
  unit: string;
  color: string;
  colors: any;
  onEdit: (newValue: number) => void;
}

const EditableNutrient = ({ 
    label, 
    value, 
    unit, 
    color, 
    colors,
    onEdit 
  }: EditableNutrientProps) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(value.toString());

    const handleEdit = () => {
      setIsEditing(true);
      setEditValue(value.toString());
    };

    const handleSave = () => {
      const newValue = parseFloat(editValue);
      if (!isNaN(newValue)) {
        onEdit(newValue);
      }
      setIsEditing(false);
    };

    const handleCancel = () => {
      setIsEditing(false);
      setEditValue(value.toString());
    };

    // Save changes on component unmount if still editing
    React.useEffect(() => {
      return () => {
        if (isEditing) {
          const newValue = parseFloat(editValue);
          if (!isNaN(newValue) && newValue >= 0) {
            onEdit(newValue);
          }
        }
      };
    }, [isEditing, editValue, onEdit]);

    if (isEditing) {
      return (
        <View style={[styles.nutrientCard, { backgroundColor: color }]}>
          <View style={styles.nutrientHorizontalLayout}>
            <View style={[styles.nutrientCircle, { borderColor: '#000', backgroundColor: 'rgba(255,255,255,0.2)' }]}>
              <TextInput
                style={[styles.nutrientEditInput, { color: '#000' }]}
                value={editValue}
                onChangeText={setEditValue}
                keyboardType="numeric"
                autoFocus
                onSubmitEditing={handleSave}
                onEndEditing={handleSave}
              />
            </View>
            <View style={styles.labelWithEdit}>
              <ThemedText style={[styles.nutrientLabel, { color: '#000' }]}>
                {label}
              </ThemedText>
              <TouchableOpacity onPress={handleSave} style={styles.editIcon}>
                <IconSymbol name="checkmark" size={16} color="#000" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      );
    }

    const displayValue = unit === 'g' ? `${Math.round(value)}${unit}` : Math.round(value).toString();

    return (
      <TouchableOpacity onPress={handleEdit} style={[styles.nutrientCard, { backgroundColor: color }]}>
        <View style={styles.nutrientHorizontalLayout}>
          <View style={[styles.nutrientCircle, { borderColor: '#000', backgroundColor: 'rgba(255,255,255,0.2)' }]}>
            <ThemedText style={[styles.nutrientValue, { color: '#000' }]}>
              {displayValue}
            </ThemedText>
          </View>
          <View style={styles.labelWithEdit}>
            <ThemedText style={[styles.nutrientLabel, { color: '#000' }]}>
              {label}
            </ThemedText>
            <View style={styles.editIcon}>
              <IconSymbol name="edit" size={16} color="#000" />
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

export function MealDetailModal({ visible, onClose, meal, onDelete }: MealDetailModalProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState('');
  const [localTitle, setLocalTitle] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showFixItModal, setShowFixItModal] = useState(false);
  const [showBeforeAfterModal, setShowBeforeAfterModal] = useState(false);
  const [showFixItPreview, setShowFixItPreview] = useState(false);
  const [tempAfterPhoto, setTempAfterPhoto] = useState<string | null>(null);
  const [fixItComment, setFixItComment] = useState('');
  const [showSaveButton, setShowSaveButton] = useState<'before' | 'after' | null>(null);
  const [savingImage, setSavingImage] = useState(false);
  const [scrollViewKey, setScrollViewKey] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);

  // Initialize local title and date when meal changes
  React.useEffect(() => {
    if (meal?.analysis?.title) {
      setLocalTitle(meal.analysis.title);
    } else if (meal?.analysis?.meal_items?.[0]?.item_name) {
      setLocalTitle(meal.analysis.meal_items[0].item_name);
    }
    if (meal?.timestamp) {
      setSelectedDate(new Date(meal.timestamp));
    }
  }, [meal?.analysis?.title, meal?.analysis?.meal_items?.[0]?.item_name, meal?.timestamp]);



  // Save title changes when modal is closing
  React.useEffect(() => {
    return () => {
      if (isEditingTitle && editTitleValue.trim() && editTitleValue.trim() !== localTitle) {
        updateMealTitle(editTitleValue.trim());
      }
    };
  }, [isEditingTitle, editTitleValue, localTitle]);

  if (!meal || !meal.analysis) {
    return null;
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Meal',
      'Are you sure you want to delete this meal?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await FileSystemStorageService.deleteMeal(meal.id);
              DeviceEventEmitter.emit('mealDeleted');
              onDelete();
              onClose();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete meal');
            }
          },
        },
      ]
    );
  };

  const updateNutrientValue = async (nutrientType: string, newValue: number) => {
    try {
      const updatedAnalysis = { ...meal.analysis };

      switch (nutrientType) {
        case 'calories':
          updatedAnalysis.total_meal_nutritional_values.total_calories = newValue;
          break;
        case 'protein':
          updatedAnalysis.total_meal_nutritional_values.total_protein_g = newValue;
          break;
        case 'fats':
          updatedAnalysis.total_meal_nutritional_values.total_total_fat_g = newValue;
          break;
        case 'carbs':
          updatedAnalysis.total_meal_nutritional_values.total_total_carbohydrate_g = newValue;
          break;
      }

      const updatedMeal = {
        ...meal,
        analysis: updatedAnalysis,
      };

      await FileSystemStorageService.updateMealAnalysis(meal.id, updatedMeal);
      DeviceEventEmitter.emit('mealUpdated', updatedMeal);
      if (Platform.OS === 'android') {
        writeMealToHealthConnect(updatedMeal);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update nutrition value');
    }
  };

  const updateMealTitle = async (newTitle: string) => {
    try {
      const updatedAnalysis = { ...meal.analysis };
      updatedAnalysis.title = newTitle;

      const updatedMeal = {
        ...meal,
        analysis: updatedAnalysis,
      };

      await FileSystemStorageService.updateMealAnalysis(meal.id, updatedMeal);
      setLocalTitle(newTitle); // Update local state immediately
      DeviceEventEmitter.emit('mealUpdated', updatedMeal);
      if (Platform.OS === 'android') {
        writeMealToHealthConnect(updatedMeal);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update meal title');
    }
  };

  const updateMealTimestamp = async (newDate: Date) => {
    try {
      const updatedMeal = {
        ...meal,
        timestamp: newDate.toISOString(),
      };

      await FileSystemStorageService.updateMealAnalysis(meal.id, updatedMeal);
      setSelectedDate(newDate); // Update local state immediately
      DeviceEventEmitter.emit('mealUpdated', updatedMeal);
      if (Platform.OS === 'android') {
        writeMealToHealthConnect(updatedMeal);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update meal timestamp');
    }
  };

  const handleEditTitle = () => {
    setIsEditingTitle(true);
    setEditTitleValue(localTitle || 'Unknown Meal');
  };

  const handleSaveTitle = async () => {
    if (editTitleValue.trim()) {
      await updateMealTitle(editTitleValue.trim());
    }
    setIsEditingTitle(false);
  };

  const handleCancelTitle = () => {
    setIsEditingTitle(false);
    setEditTitleValue(localTitle || 'Unknown Meal');
  };

  const handleDateSave = async (newDate: Date) => {
    // Combine the new date with the current time
    const currentDateTime = selectedDate;
    const updatedDateTime = new Date(
      newDate.getFullYear(),
      newDate.getMonth(),
      newDate.getDate(),
      currentDateTime.getHours(),
      currentDateTime.getMinutes(),
      currentDateTime.getSeconds()
    );
    await updateMealTimestamp(updatedDateTime);
  };

  const handleTimeSave = async (newTime: Date) => {
    // Combine the current date with the new time
    const currentDateTime = selectedDate;
    const updatedDateTime = new Date(
      currentDateTime.getFullYear(),
      currentDateTime.getMonth(),
      currentDateTime.getDate(),
      newTime.getHours(),
      newTime.getMinutes(),
      newTime.getSeconds()
    );
    await updateMealTimestamp(updatedDateTime);
  };

  const handleFixIt = () => {
    setFixItComment(meal.comment || '');
    setTempAfterPhoto(null);
    setShowFixItModal(true);
  };

  const handleAddAfterPicture = () => {
    setShowFixItModal(false);
    setShowBeforeAfterModal(true);
  };

  const handleAfterPhotoTaken = (photoUri: string) => {
    setTempAfterPhoto(photoUri);
    setShowBeforeAfterModal(false);
    setShowFixItPreview(true);
  };

  const handleSaveImage = async (imageUri: string | undefined, imageType: 'before' | 'after') => {
    if (!imageUri) return;

    setSavingImage(true);
    try {
      // Request permissions
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant permission to save images to your gallery.');
        setSavingImage(false);
        return;
      }

      // Save the image to the gallery
      const asset = await MediaLibrary.createAssetAsync(imageUri);
      await MediaLibrary.createAlbumAsync('OpenMeal', asset, false);
      
      Alert.alert('Success', 'Image saved to gallery!');
      setShowSaveButton(null);
    } catch (error) {
      console.error('Error saving image:', error);
      Alert.alert('Error', 'Failed to save image to gallery.');
    } finally {
      setSavingImage(false);
    }
  };

  const handleLongPress = (imageType: 'before' | 'after') => {
    setShowSaveButton(imageType);
  };

  const handlePressOut = () => {
    // Don't hide the save button immediately on press out
    // Let the user have time to tap the save button
  };

  const handleSaveFix = async (comment: string) => {
    // This function can now be called from two places:
    // 1. The original CommentModal (if no after picture is added)
    // 2. The new FixItPreviewModal (after an after picture is added)
    
    // Ensure we have something to fix
    if (!comment.trim() && !tempAfterPhoto && !meal.afterImageUri) {
      Alert.alert('Error', 'Please provide a comment describing the correction or add an after picture.');
      return;
    }

    // Close any open modals
    setShowFixItModal(false);
    setShowFixItPreview(false);
    
    // Close the main detail modal immediately for a better UX
    onClose(); 

    try {
      // Update the meal to show "analyzing" status
      const analyzingMeal = {
        ...meal,
        analysis: {
          ...meal.analysis,
          title: 'Analyzing meal...',
          isAnalyzing: true
        }
      };
      
      await FileSystemStorageService.updateMealAnalysis(meal.id, analyzingMeal);
      DeviceEventEmitter.emit('mealUpdated', analyzingMeal);

      let base64Image: string | undefined = undefined;
      let base64AfterImage: string | undefined = undefined;
      
      if (meal.imageUri) {
        const fileInfo = await FileSystem.getInfoAsync(meal.imageUri);
        if (fileInfo.exists) {
          base64Image = await FileSystem.readAsStringAsync(meal.imageUri, {
            encoding: FileSystem.EncodingType.Base64,
          });
        }
      }

      // Use temp after photo if provided, otherwise use existing after photo
      const afterPhotoUri = tempAfterPhoto || meal.afterImageUri;
      if (afterPhotoUri) {
        const fileInfo = await FileSystem.getInfoAsync(afterPhotoUri);
        if (fileInfo.exists) {
          base64AfterImage = await FileSystem.readAsStringAsync(afterPhotoUri, {
            encoding: FileSystem.EncodingType.Base64,
          });
        }
      }

      let newAnalysis;
      let updatedAfterImageUri = meal.afterImageUri;

      if (base64AfterImage && base64Image) {
        // Use before/after analysis
        newAnalysis = await GeminiService.analyzeFoodBeforeAfter(
          base64Image,
          base64AfterImage,
          comment
        );
        
        // If we used a temp after photo, we need to save it
        if (tempAfterPhoto && tempAfterPhoto !== meal.afterImageUri) {
          updatedAfterImageUri = await FileSystemStorageService.copyImageToStorage(tempAfterPhoto, meal.id, 'after');
        }
      } else {
        // Use regular fix analysis
        newAnalysis = await GeminiService.fixMealAnalysis(
          meal.analysis,
          comment,
          base64Image
        );
      }

      const updatedMeal = {
        ...meal,
        afterImageUri: updatedAfterImageUri,
        comment: comment || meal.comment,
        analysis: {
          ...newAnalysis,
          isAnalyzing: false
        },
      };

      await FileSystemStorageService.updateMealAnalysis(meal.id, updatedMeal);
      DeviceEventEmitter.emit('mealUpdated', updatedMeal);
      if (Platform.OS === 'android') {
        writeMealToHealthConnect(updatedMeal);
      }
      
      // Clear temp state
      setTempAfterPhoto(null);
      setFixItComment('');
    } catch (error: any) {
      // If there's an error, restore the original meal
      await FileSystemStorageService.updateMealAnalysis(meal.id, meal);
      DeviceEventEmitter.emit('mealUpdated', meal);
      Alert.alert('Error Correcting Meal', error.message || 'An unknown error occurred.');
      
      // Clear temp state
      setTempAfterPhoto(null);
      setFixItComment('');
    }
  };

  const handleRelogMeal = async () => {
    try {
      // Create a new meal with the current timestamp
      const now = new Date();
      const newMealId = `meal_${now.getTime()}`;
      
      // Copy the original meal's image to a new location for the new meal
      let newImageUri: string = '';
      let newAfterImageUri: string | undefined = undefined;
      
      if (meal.imageUri) {
        newImageUri = await FileSystemStorageService.copyImageToStorage(meal.imageUri, newMealId, 'before');
      }
      
      if (meal.afterImageUri) {
        newAfterImageUri = await FileSystemStorageService.copyImageToStorage(meal.afterImageUri, newMealId, 'after');
      }
      
      const newMeal: MealAnalysis = {
        id: newMealId,
        timestamp: now.toISOString(),
        imageUri: newImageUri,
        afterImageUri: newAfterImageUri,
        comment: meal.comment,
        analysis: { ...meal.analysis },
        isLoading: false,
        hasError: false,
      };

      // Save the new meal using appropriate method based on whether it has an image
      if (!newImageUri || newImageUri.trim() === '') {
        // For text-only meals: use pending meal pattern then update with analysis
        const pendingMeal = {
          id: newMealId,
          timestamp: now.toISOString(),
          imageUri: '',
          comment: meal.comment,
          isLoading: false,
          hasError: false,
        };
        
        await FileSystemStorageService.savePendingMeal(pendingMeal);
        await FileSystemStorageService.updateMealAnalysis(newMealId, newMeal);
      } else {
        // For meals with images: use standard save method
        await FileSystemStorageService.saveMealAnalysis(newMeal);
      }
      
      // Write to health connect if on Android
      if (Platform.OS === 'android') {
        writeMealToHealthConnect(newMeal);
      }

      // Emit events to update the UI
      DeviceEventEmitter.emit('mealAdded', newMeal);
      DeviceEventEmitter.emit('scrollToTop');
      
      // Show success message
      Alert.alert('Success', 'Meal has been relogged successfully!');
      
      // Close the modal
      onClose();
      
    } catch (error: any) {
      Alert.alert('Error', 'Failed to relog meal. Please try again.');
      console.error('Error relogging meal:', error);
    }
  };

  const { total_meal_nutritional_values, meal_items } = meal.analysis;
  const mainItem = meal_items?.[0];
  const mealTitle = localTitle || meal.analysis.title || mainItem?.item_name || 'Unknown Meal';

  const handleScrollViewLayout = () => {
    // Ensure scroll indicators are visible and content size is properly calculated
    if (Platform.OS === 'android' && scrollViewRef.current) {
      scrollViewRef.current.flashScrollIndicators();
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'overFullScreen'}
      onRequestClose={onClose}
      statusBarTranslucent={Platform.OS === 'android'}
      transparent={Platform.OS === 'android'}
      onShow={() => {
        if (Platform.OS === 'android') {
          // Reinitialize ScrollView after modal is shown (fixes scroll freeze)
          setScrollViewKey(prev => prev + 1);
          scrollViewRef.current?.flashScrollIndicators();
        }
      }}
      hardwareAccelerated={Platform.OS === 'android' ? false : undefined}
    >
      {Platform.OS === 'android' && (
        <View style={styles.androidOverlay} pointerEvents='none' />
      )}

      <ThemedView
        style={[
          styles.container,
          { backgroundColor: colors.background, flex: 1 },
          Platform.OS === 'android' && styles.androidModalContent,
        ]}
        collapsable={false}
        >
        <TouchableOpacity
          onPress={onClose}
          style={[styles.controlButton, styles.closeButton]}
        >
          <IconSymbol name="xmark" size={18} color="white" />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleFixIt}
          style={[styles.controlButton, styles.fixItButton]}
        >
          <View style={styles.fixItButtonContent}>
            <IconSymbol name="wand.and.stars" size={18} color="white" />
            <ThemedText style={styles.fixItText}>Fix It</ThemedText>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleDelete}
          style={[styles.controlButton, styles.deleteButton]}
        >
          <IconSymbol name="trash" size={18} color="white" />
        </TouchableOpacity>

        <ScrollView 
          key={scrollViewKey}
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollViewContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          removeClippedSubviews={false}
          scrollEventThrottle={16}
          scrollEnabled={true}
          nestedScrollEnabled={Platform.OS === 'android'}
          onLayout={handleScrollViewLayout}>
          {/* Header with image */}
          {meal.imageUri && (
            <View style={styles.imageContainer}>
              {meal.afterImageUri ? (
                <View style={styles.beforeAfterContainer}>
                  <TouchableWithoutFeedback
                    onLongPress={() => handleLongPress('before')}
                    onPressOut={handlePressOut}
                    onPress={() => setShowSaveButton(null)}
                  >
                    <View style={styles.beforeAfterImageWrapper}>
                      <Image source={{ uri: meal.imageUri }} style={styles.mealImage} />
                      <View style={styles.beforeAfterOverlay}>
                        <ThemedText style={styles.beforeAfterText}>Before</ThemedText>
                      </View>
                      {showSaveButton === 'before' && (
                        <TouchableOpacity
                          style={styles.saveImageButton}
                          onPress={() => handleSaveImage(meal.imageUri, 'before')}
                          disabled={savingImage}
                        >
                          <IconSymbol name="square.and.arrow.down" size={20} color="white" />
                          <ThemedText style={styles.saveImageText}>
                            {savingImage ? 'Saving...' : 'Save Image'}
                          </ThemedText>
                        </TouchableOpacity>
                      )}
                    </View>
                  </TouchableWithoutFeedback>
                  <TouchableWithoutFeedback
                    onLongPress={() => handleLongPress('after')}
                    onPressOut={handlePressOut}
                    onPress={() => setShowSaveButton(null)}
                  >
                    <View style={styles.beforeAfterImageWrapper}>
                      <Image source={{ uri: meal.afterImageUri }} style={styles.mealImage} />
                      <View style={styles.beforeAfterOverlay}>
                        <ThemedText style={styles.beforeAfterText}>After</ThemedText>
                      </View>
                      {showSaveButton === 'after' && (
                        <TouchableOpacity
                          style={styles.saveImageButton}
                          onPress={() => handleSaveImage(meal.afterImageUri, 'after')}
                          disabled={savingImage}
                        >
                          <IconSymbol name="square.and.arrow.down" size={20} color="white" />
                          <ThemedText style={styles.saveImageText}>
                            {savingImage ? 'Saving...' : 'Save Image'}
                          </ThemedText>
                        </TouchableOpacity>
                      )}
                    </View>
                  </TouchableWithoutFeedback>
                </View>
              ) : (
                <TouchableWithoutFeedback
                  onLongPress={() => handleLongPress('before')}
                  onPressOut={handlePressOut}
                  onPress={() => setShowSaveButton(null)}
                >
                  <View style={styles.imageWrapper}>
                    <Image source={{ uri: meal.imageUri }} style={styles.mealImage} />
                    {showSaveButton === 'before' && (
                      <TouchableOpacity
                        style={styles.saveImageButton}
                        onPress={() => handleSaveImage(meal.imageUri, 'before')}
                        disabled={savingImage}
                      >
                        <IconSymbol name="square.and.arrow.down" size={20} color="white" />
                        <ThemedText style={styles.saveImageText}>
                          {savingImage ? 'Saving...' : 'Save Image'}
                        </ThemedText>
                      </TouchableOpacity>
                    )}
                  </View>
                </TouchableWithoutFeedback>
              )}
            </View>
          )}

          {/* Meal info */}
          <View style={[styles.mealInfo, !meal.imageUri && styles.mealInfoNoImage]}>
            {isEditingTitle ? (
              <TextInput
                style={[styles.titleEditInput, { color: colors.text, borderColor: colors.text + '30' }]}
                value={editTitleValue}
                onChangeText={setEditTitleValue}
                autoFocus
                onSubmitEditing={handleSaveTitle}
                onEndEditing={handleSaveTitle}
                placeholder="Enter meal title"
                placeholderTextColor={colors.text + '60'}
              />
            ) : (
              <TouchableOpacity onPress={handleEditTitle} style={styles.titleContainer}>
                <ThemedText style={styles.mealTitle}>{mealTitle}</ThemedText>
              </TouchableOpacity>
            )}
            <View style={styles.dateTimeContainer}>
              <TouchableOpacity onPress={() => setShowTimePicker(true)} style={styles.timeSection}>
                <ThemedText style={[styles.dateTimeText, { color: colors.text }]}>
                  {formatTime(selectedDate)}
                </ThemedText>
              </TouchableOpacity>

              <ThemedText style={[styles.dateTimeSeparator, { color: colors.text + '60' }]}>
                •
              </ThemedText>

              <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.dateSection}>
                <ThemedText style={[styles.dateTimeText, { color: colors.text }]}>
                  {formatDate(selectedDate)}
                </ThemedText>
              </TouchableOpacity>
            </View>
          </View>

          {/* Comment card */}
          {meal.comment && meal.comment.trim() && (
            <View style={[styles.commentCard, { backgroundColor: colors.text + '15' }]}>
              <ThemedText style={styles.commentHeader}>Comment</ThemedText>
              <ThemedText style={styles.commentText}>{meal.comment}</ThemedText>
            </View>
          )}

          {/* Nutrition grid */}
          <View style={styles.nutritionGrid}>
            <EditableNutrient
              label="Calories"
              value={total_meal_nutritional_values.total_calories || 0}
              unit=""
              color="#FFA726"
              colors={colors}
              onEdit={(newValue) => updateNutrientValue('calories', newValue)}
            />
            <EditableNutrient
              label="Protein"
              value={total_meal_nutritional_values.total_protein_g || 0}
              unit="g"
              color="#EF5350"
              colors={colors}
              onEdit={(newValue) => updateNutrientValue('protein', newValue)}
            />
            <EditableNutrient
              label="Fats"
              value={total_meal_nutritional_values.total_total_fat_g || 0}
              unit="g"
              color="#26A69A"
              colors={colors}
              onEdit={(newValue) => updateNutrientValue('fats', newValue)}
            />
            <EditableNutrient
              label="Carbs"
              value={total_meal_nutritional_values.total_total_carbohydrate_g || 0}
              unit="g"
              color="#FFEE58"
              colors={colors}
              onEdit={(newValue) => updateNutrientValue('carbs', newValue)}
            />
          </View>

          {/* Items list */}
          <ThemedView style={[
            styles.itemsCard, 
            { 
              borderColor: colors.text + '20',
              backgroundColor: colors.cardBackground 
            }
          ]}>
            <ThemedText style={styles.itemsTitle}>Items</ThemedText>
            {meal_items?.map((item: any, index: number) => (
              <View key={index} style={styles.itemRow}>
                <ThemedText style={styles.itemName}>• {item.item_name}</ThemedText>
                <ThemedText style={styles.servingSize}>
                  ({item.estimated_serving_size})
                </ThemedText>
              </View>
            ))}
          </ThemedView>

          {/* Meal Insights */}
          {meal.analysis?.meal_insights && (
            meal.analysis.meal_insights.health_benefits?.length > 0 || 
            meal.analysis.meal_insights.health_concerns?.length > 0
          ) && (
            <ThemedView style={[
              styles.insightsCard, 
              { 
                borderColor: colors.text + '20',
                backgroundColor: colors.cardBackground 
              }
            ]}>
              <View style={styles.insightsHeader}>
                <IconSymbol name="insights" size={24} color={colors.text} />
                <ThemedText style={styles.insightsTitle}>Meal Insights</ThemedText>
              </View>
              
              {/* Nested card with sections */}
              <View style={[
                styles.insightsNestedCard,
                {
                  backgroundColor: colors.background,
                  shadowColor: colorScheme === 'dark' ? '#FFF' : '#000',
                  shadowOpacity: colorScheme === 'dark' ? 0.05 : 0.1,
                }
              ]}>
                {meal.analysis.meal_insights.health_benefits?.length > 0 && (
                  <View style={[
                    styles.insightsGoodSection,
                    { backgroundColor: colorScheme === 'dark' ? '#0F1F0F' : '#F8FDF8' }
                  ]}>
                    <View style={styles.insightsSectionHeader}>
                      <IconSymbol name="recommend" size={20} color="#4CAF50" />
                      <ThemedText style={[styles.insightsSectionTitle, { color: '#4CAF50' }]}>
                        Good
                      </ThemedText>
                    </View>
                    {meal.analysis.meal_insights.health_benefits.map((benefit: string, index: number) => (
                      <View key={index} style={styles.insightRow}>
                        <ThemedText style={[styles.insightText, { color: colors.text }]}>• {benefit}</ThemedText>
                      </View>
                    ))}
                  </View>
                )}

                {meal.analysis.meal_insights.health_benefits?.length > 0 && 
                 meal.analysis.meal_insights.health_concerns?.length > 0 && (
                  <View style={[styles.insightsDivider, { backgroundColor: colors.text + '20' }]} />
                )}

                {meal.analysis.meal_insights.health_concerns?.length > 0 && (
                  <View style={[
                    styles.insightsBadSection,
                    { backgroundColor: colorScheme === 'dark' ? '#1F1A0F' : '#FFFBF8' }
                  ]}>
                    <View style={styles.insightsSectionHeader}>
                      <IconSymbol 
                        name="recommend" 
                        size={20} 
                        color="#FF5722" 
                        style={{ transform: [{ rotate: '180deg' }] }}
                      />
                      <ThemedText style={[styles.insightsSectionTitle, { color: '#FF5722' }]}>
                        Bad
                      </ThemedText>
                    </View>
                    {meal.analysis.meal_insights.health_concerns.map((concern: string, index: number) => (
                      <View key={index} style={styles.insightRow}>
                        <ThemedText style={[styles.insightText, { color: colors.text }]}>• {concern}</ThemedText>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </ThemedView>
          )}

          {/* Relog Button */}
          <View style={styles.relogButtonContainer}>
            <TouchableOpacity
              style={[styles.relogButton, { backgroundColor: colors.text }]}
              onPress={handleRelogMeal}
            >
              <IconSymbol name="rebase-edit" size={20} color={colors.background} />
              <ThemedText style={[styles.relogButtonText, { color: colors.background }]}>
                Relog this meal
              </ThemedText>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Date Picker Modal */}
        <DateTimePickerModal
          visible={showDatePicker}
          onClose={() => setShowDatePicker(false)}
          onSave={handleDateSave}
          initialDate={selectedDate}
          mode="date"
          title="Select Date"
        />

        {/* Time Picker Modal */}
        <DateTimePickerModal
          visible={showTimePicker}
          onClose={() => setShowTimePicker(false)}
          onSave={handleTimeSave}
          initialDate={selectedDate}
          mode="time"
          title="Select Time"
        />

        <CommentModal
          visible={showFixItModal}
          onClose={() => {
            setShowFixItModal(false);
            setTempAfterPhoto(null);
            setFixItComment('');
          }}
          onSave={handleSaveFix}
          initialComment={fixItComment}
          showAddAfterPicture={!!meal.imageUri && !meal.afterImageUri && !tempAfterPhoto}
          onAddAfterPicture={handleAddAfterPicture}
        />

        <BeforeAfterModal
          visible={showBeforeAfterModal}
          onClose={() => setShowBeforeAfterModal(false)}
          onPhotoTaken={handleAfterPhotoTaken}
        />

        <FixItPreviewModal
          visible={showFixItPreview}
          onClose={() => {
            setShowFixItPreview(false);
            setTempAfterPhoto(null);
            setFixItComment('');
          }}
          onSave={handleSaveFix}
          beforeImageUri={meal.imageUri}
          afterImageUri={tempAfterPhoto}
          initialComment={fixItComment}
        />
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    paddingBottom: 40,
    flexGrow: 1,
  },
  imageContainer: {
    height: 300,
    position: 'relative',
    marginBottom: 20,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
  },
  mealImage: {
    width: '100%',
    height: '100%',
  },
  controlButton: {
    position: 'absolute',
    top: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  closeButton: {
    left: 20,
  },
  deleteButton: {
    right: 20,
  },
  fixItButton: {
    right: 70,
    width: 'auto',
    paddingHorizontal: 12,
  },
  fixItButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fixItText: {
    color: 'white',
    marginLeft: 6,
    fontWeight: '600',
  },
  mealInfo: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  mealInfoNoImage: {
    marginTop: 80, // Space for control buttons when no image
  },
  titleContainer: {
    marginBottom: 8,
  },
  mealTitle: {
    fontSize: 42,
    fontWeight: '900',
    lineHeight: 46,
  },
  titleEditInput: {
    fontSize: 42,
    fontWeight: '900',
    lineHeight: 46,
    borderBottomWidth: 2,
    paddingVertical: 4,
    marginBottom: 8,
  },
  dateTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 8,
    flexWrap: 'wrap',
  },
  timeSection: {
    // Invisible touchable area for time
  },
  dateSection: {
    // Invisible touchable area for date
  },
  dateTimeText: {
    fontSize: 16,
    fontWeight: '400',
    opacity: 0.6,
  },
  dateTimeSeparator: {
    fontSize: 16,
    fontWeight: '400',
    opacity: 0.6,
  },
  nutritionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    justifyContent: 'space-between',
    marginBottom: 24,
    gap: 12,
  },
  nutrientCard: {
    width: '48%',
    padding: 16,
    borderRadius: 12,
  },
  nutrientHorizontalLayout: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nutrientCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  nutrientValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  labelWithEdit: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  nutrientLabel: {
    fontSize: 16,
    fontFamily: 'TikTokSans-Bold',
    marginRight: 4,
  },
  editIcon: {
    padding: 2,
  },
  nutrientEditInput: {
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
    minWidth: 30,
  },
  itemsCard: {
    margin: 20,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
  },
  itemsTitle: {
    fontSize: 20,
    fontFamily: 'TikTokSans-Bold',
    marginBottom: 16,
  },
  itemRow: {
    marginBottom: 8,
  },
  itemName: {
    fontSize: 16,
    marginBottom: 2,
  },
  servingSize: {
    fontSize: 14,
    opacity: 0.6,
    marginLeft: 8,
  },

  commentCard: {
    marginHorizontal: 20,
    marginBottom: 24,
    padding: 16,
    borderRadius: 12,
  },
  commentHeader: {
    fontSize: 16,
    fontFamily: 'TikTokSans-Bold',
    marginBottom: 8,
  },
  commentText: {
    fontSize: 15,
    fontStyle: 'italic',
    lineHeight: 20,
    opacity: 0.8,
  },
  beforeAfterContainer: {
    flexDirection: 'row',
    height: '100%',
  },
  beforeAfterImageWrapper: {
    flex: 1,
    position: 'relative',
  },
  beforeAfterOverlay: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  beforeAfterText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  imageWrapper: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  saveImageButton: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -75 }, { translateY: -30 }],
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  saveImageText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
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
  // Meal Insights styles
  insightsCard: {
    margin: 20,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
  },
  insightsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  insightsTitle: {
    fontSize: 20,
    fontFamily: 'TikTokSans-Bold',
    marginLeft: 8,
  },
  insightsNestedCard: {
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 1,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
  },
  insightsGoodSection: {
    padding: 16,
  },
  insightsBadSection: {
    padding: 16,
  },
  insightsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  insightsSectionTitle: {
    fontSize: 16,
    fontFamily: 'TikTokSans-Bold',
    marginLeft: 8,
  },
  insightRow: {
    marginBottom: 6,
    marginLeft: 28,
  },
  insightText: {
    fontSize: 15,
    lineHeight: 20,
  },
  insightsDivider: {
    height: 1,
  },
  relogButtonContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
  },
  relogButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  relogButtonText: {
    fontSize: 16,
    fontFamily: 'TikTokSans-Bold',
  },
});