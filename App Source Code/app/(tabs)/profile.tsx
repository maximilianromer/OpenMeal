import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, Alert, Linking, View, Modal, TextInput, Dimensions, NativeSyntheticEvent, NativeScrollEvent, Platform, StatusBar, KeyboardAvoidingView, Image } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import FileSystemStorageService from '@/services/FileSystemStorageService';
import OnboardingService from '@/services/OnboardingService';
import { DailyGoalsScreen } from '@/components/DailyGoalsScreen';
import { AppHeader } from '@/components/AppHeader';
import { MealRemindersModal } from '@/components/MealRemindersModal';
import { NutritionHistoryChart, Nutrient } from '@/components/NutritionHistoryChart';
import { requestHealthConnectPermission, hasWritePermission } from '@/services/HealthConnectService';
import { useFocusEffect } from '@react-navigation/native';
import UserProfileService from '@/services/UserProfileService';
import ExportImportService from '@/services/ExportImportService';
import { ExportImportModal } from '@/components/ExportImportModal';
import { ReactNativeLegal } from 'react-native-legal';
import { useNavigation } from '@react-navigation/native';
import { router } from 'expo-router';

const nutrients: Nutrient[] = ['calories', 'protein', 'fats', 'carbs'];
const { width } = Dimensions.get('window');

export default function ProfileScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [activeSlide, setActiveSlide] = useState(0);
  const navigation = useNavigation();

  const openDeleteHistory = () => {
    setShowDeleteHistory(true);
  };

  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [showDailyGoals, setShowDailyGoals] = useState(false);
  const [showMealReminders, setShowMealReminders] = useState(false);
  const [showAIModelModal, setShowAIModelModal] = useState(false);
  const [showDeleteHistory, setShowDeleteHistory] = useState(false);
  const [exportProgress, setExportProgress] = useState({ visible: false, progress: 0, message: '' });

  const changeApiKey = () => {
    setShowApiKeyModal(true);
  };

  const openDailyGoals = () => {
    setShowDailyGoals(true);
  };

  const openMealReminders = () => {
    setShowMealReminders(true);
  };

  const openAIModelModal = () => {
    setShowAIModelModal(true);
  };

  const handleExportData = async () => {
    try {
      setExportProgress({ visible: true, progress: 0, message: 'Starting export...' });
      
      await ExportImportService.exportData((progress, message) => {
        setExportProgress({ visible: true, progress, message });
      });

      // Show success briefly before closing
      setExportProgress({ visible: true, progress: 100, message: 'Export complete!' });
      setTimeout(() => {
        setExportProgress({ visible: false, progress: 0, message: '' });
      }, 1500);
    } catch (error) {
      setExportProgress({ 
        visible: true, 
        progress: 0, 
        message: `Export failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      });
      setTimeout(() => {
        setExportProgress({ visible: false, progress: 0, message: '' });
      }, 3000);
    }
  };

  const openLicenses = () => {
    ReactNativeLegal.launchLicenseListScreen('Open Source Licenses');
  };

  const [healthConnectGranted, setHealthConnectGranted] = useState<boolean>(false);

  // Helper to check current Health Connect permission state
  const checkPermission = useCallback(async () => {
    if (Platform.OS !== 'android') return;
    const granted = await hasWritePermission();
    setHealthConnectGranted(granted);
  }, []);

  // Check once on mount
  useEffect(() => {
    checkPermission();
  }, [checkPermission]);

  // Re-check each time the screen comes into focus (covers revocation in Settings)
  useFocusEffect(
    useCallback(() => {
      checkPermission();
    }, [checkPermission])
  );

  const handleHealthConnectPress = async () => {
    if (healthConnectGranted) return;
    const granted = await requestHealthConnectPermission();
    setHealthConnectGranted(granted);
  };



  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const slide = Math.round(event.nativeEvent.contentOffset.x / (width - 40));
    if (slide !== activeSlide) {
      setActiveSlide(slide);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <AppHeader title="OpenMeal" />
      
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.chartCarousel}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={onScroll}
            scrollEventThrottle={16}
            style={{ width: width - 40 }}
          >
            {nutrients.map((nutrient) => (
              <NutritionHistoryChart key={nutrient} nutrient={nutrient} />
            ))}
          </ScrollView>
          <View style={styles.pagination}>
            {nutrients.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.dot,
                  { backgroundColor: activeSlide === index ? colors.tint : colors.text + '40' }
                ]}
              />
            ))}
          </View>
        </View>
        
        <View style={styles.section}>
          {/* Health Connect permission – Android only */}
          {Platform.OS === 'android' && (
            <TouchableOpacity
              style={[
                styles.option,
                { borderColor: colors.text + '20', backgroundColor: colors.cardBackground, opacity: healthConnectGranted ? 0.6 : 1 },
              ]}
              onPress={handleHealthConnectPress}
              disabled={healthConnectGranted}
            >
              <View style={styles.optionContent}>
                <IconSymbol name="heart.outline" size={24} color={colors.text} style={styles.optionIcon} />
                <View style={styles.optionText}>
                  <ThemedText style={styles.optionTitle}>Health Connect</ThemedText>
                  <ThemedText style={styles.optionSubtitle}>
                    {healthConnectGranted ? 'Connected' : 'Grant permission to export meals'}
                  </ThemedText>
                </View>
              </View>
              {healthConnectGranted ? (
                <IconSymbol name="checkmark.circle" size={18} color={colors.tint} />
              ) : (
                <IconSymbol name="chevron.right" size={16} color={colors.text + '60'} />
              )}
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.option, { borderColor: colors.text + '20', backgroundColor: colors.cardBackground }]}
            onPress={openDailyGoals}
          >
            <View style={styles.optionContent}>
              <IconSymbol name="target" size={24} color={colors.text} style={styles.optionIcon} />
              <View style={styles.optionText}>
                <ThemedText style={styles.optionTitle}>Daily Goals</ThemedText>
                <ThemedText style={styles.optionSubtitle}>Set your nutrition targets</ThemedText>
              </View>
            </View>
            <IconSymbol name="chevron.right" size={16} color={colors.text + '60'} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.option, { borderColor: colors.text + '20', backgroundColor: colors.cardBackground }]}
            onPress={openMealReminders}
          >
            <View style={styles.optionContent}>
              <IconSymbol name="bell.edit" size={24} color={colors.text} style={styles.optionIcon} />
              <View style={styles.optionText}>
                <ThemedText style={styles.optionTitle}>Meal Reminders</ThemedText>
                <ThemedText style={styles.optionSubtitle}>Get notified to log your meals</ThemedText>
              </View>
            </View>
            <IconSymbol name="chevron.right" size={16} color={colors.text + '60'} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.option, { borderColor: colors.text + '20', backgroundColor: colors.cardBackground }]}
            onPress={openAIModelModal}
          >
            <View style={styles.optionContent}>
              <IconSymbol name="psychology" size={24} color={colors.text} style={styles.optionIcon} />
              <View style={styles.optionText}>
                <ThemedText style={styles.optionTitle}>AI Model</ThemedText>
                <ThemedText style={styles.optionSubtitle}>Choose any Google Gemini model</ThemedText>
              </View>
            </View>
            <IconSymbol name="chevron.right" size={16} color={colors.text + '60'} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.option, { borderColor: colors.text + '20', backgroundColor: colors.cardBackground }]}
            onPress={changeApiKey}
          >
            <View style={styles.optionContent}>
              <IconSymbol name="key" size={24} color={colors.text} style={styles.optionIcon} />
              <View style={styles.optionText}>
                <ThemedText style={styles.optionTitle}>Change API Key</ThemedText>
                <ThemedText style={styles.optionSubtitle}>Update your Gemini API key</ThemedText>
              </View>
            </View>
            <IconSymbol name="chevron.right" size={16} color={colors.text + '60'} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.option, { borderColor: colors.text + '20', backgroundColor: colors.cardBackground }]}
            onPress={handleExportData}
          >
            <View style={styles.optionContent}>
              <IconSymbol name="square.and.arrow.down" size={24} color={colors.text} style={styles.optionIcon} />
              <View style={styles.optionText}>
                <ThemedText style={styles.optionTitle}>Export My Data</ThemedText>
                <ThemedText style={styles.optionSubtitle}>Download all your data as JSON</ThemedText>
              </View>
            </View>
            <IconSymbol name="chevron.right" size={16} color={colors.text + '60'} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.option, { borderColor: colors.text + '20', backgroundColor: colors.cardBackground }]}
            onPress={openDeleteHistory}
          >
            <View style={styles.optionContent}>
              <IconSymbol name="trash" size={24} color={colors.text} style={styles.optionIcon} />
              <View style={styles.optionText}>
                <ThemedText style={styles.optionTitle}>Clear History</ThemedText>
                <ThemedText style={styles.optionSubtitle}>Delete all saved meals</ThemedText>
              </View>
            </View>
            <IconSymbol name="chevron.right" size={16} color={colors.text + '60'} />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <View style={[styles.infoCard, { backgroundColor: colors.text + '10' }]}>
            <ThemedText style={styles.appName}>About the author</ThemedText>
            <View style={styles.authorHeader}>
              <Image
                source={require('@/assets/images/max-romer-profile.jpg')}
                style={styles.authorImage}
              />
              <View style={styles.authorInfo}>
                <ThemedText style={styles.authorName}>Max Romer</ThemedText>
                <ThemedText style={styles.authorTitle}>Designer and Developer</ThemedText>
              </View>
            </View>
            <ThemedText style={styles.authorDescription}>
              Max is an undergraduate at Stanford University, planning to major in Symbolic Systems. He grew up in Park City, UT, and enjoys hiking and following technological advancements in his free time.
            </ThemedText>
            <View style={styles.authorLinks}>
              <TouchableOpacity
                style={styles.authorLink}
                onPress={() => Linking.openURL('https://linkedin.com/in/maxromer')}
              >
                <ThemedText style={[styles.authorLinkText, { color: colors.tint }]}>LinkedIn</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.authorLink}
                onPress={() => Linking.openURL('https://github.com/maximilianromer')}
              >
                <ThemedText style={[styles.authorLinkText, { color: colors.tint }]}>GitHub</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={[styles.infoCard, { backgroundColor: colors.text + '10' }]}>
            <ThemedText style={styles.appName}>About OpenMeal</ThemedText>
            <ThemedText style={styles.appDescription}>
              AI-powered meal tracking and nutritional analysis using computer vision and machine learning.
            </ThemedText>
            <View style={[styles.disclaimer, { backgroundColor: colors.text + '05' }]}>
              <ThemedText style={styles.disclaimerText}>
                This app uses AI to analyze food images. Nutritional information is estimated and should not be used as a substitute for professional dietary advice.
              </ThemedText>
            </View>
            <ThemedText style={styles.version}>Version 1.0.0</ThemedText>
            <View style={styles.authorLinks}>
              <TouchableOpacity
                style={styles.authorLink}
                onPress={() => Linking.openURL('https://github.com/maximilianromer/openmeal')}
              >
                <ThemedText style={[styles.authorLinkText, { color: colors.tint }]}>GitHub</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.authorLink}
                onPress={openLicenses}
              >
                <ThemedText style={[styles.authorLinkText, { color: colors.tint }]}>Licenses</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.authorLink}
                onPress={() => router.push('/font-license')}
              >
                <ThemedText style={[styles.authorLinkText, { color: colors.tint }]}>Font License</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* MIT License Card */}
        <View style={styles.section}>
          <View style={[styles.infoCard, { backgroundColor: colors.text + '10' }]}> 
            <ThemedText style={styles.appName}>MIT License</ThemedText>
            <ThemedText style={styles.appDescription}>
              {`Copyright (c) 2025 Max Romer\n\nPermission is hereby granted, free of charge, to any person obtaining a copy\nof this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.`}
            </ThemedText>
          </View>
        </View>
      </ScrollView>

      {/* Daily Goals Modal */}
      {showDailyGoals && (
        <DailyGoalsScreen onClose={() => setShowDailyGoals(false)} />
      )}

      {/* API Key Change Modal */}
      <ApiKeyChangeModal
        visible={showApiKeyModal}
        onClose={() => setShowApiKeyModal(false)}
        colors={colors}
      />

      {/* Meal Reminders Modal */}
      <MealRemindersModal
        visible={showMealReminders}
        onClose={() => setShowMealReminders(false)}
      />

      {/* AI Model Modal */}
      <AIModelModal
        visible={showAIModelModal}
        onClose={() => setShowAIModelModal(false)}
        colors={colors}
      />

      {/* Delete History Modal */}
      <DeleteHistoryModal
        visible={showDeleteHistory}
        onClose={() => setShowDeleteHistory(false)}
        colors={colors}
      />

      {/* Export Progress Modal */}
      <ExportImportModal
        visible={exportProgress.visible}
        progress={exportProgress.progress}
        message={exportProgress.message}
        isError={exportProgress.message.includes('failed')}
      />
    </ThemedView>
  );
}

// API Key Change Modal Component
function ApiKeyChangeModal({ visible, onClose, colors }: {
  visible: boolean;
  onClose: () => void;
  colors: any;
}) {
  const [apiKey, setApiKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSave = async () => {
    if (!apiKey.trim()) {
      Alert.alert('Required', 'Please enter your Gemini API key.');
      return;
    }

    // Basic validation for Gemini API key format
    if (!apiKey.startsWith('AIza') || apiKey.length < 30) {
      Alert.alert(
        'Invalid API Key',
        'Please enter a valid Gemini API key. It should start with "AIza" and be at least 30 characters long.'
      );
      return;
    }

    setIsLoading(true);
    try {
      await OnboardingService.saveApiKey(apiKey.trim());
      Alert.alert('Success', 'API key has been updated successfully.');
      setApiKey('');
      onClose();
    } catch (error) {
      Alert.alert('Error', 'Failed to update API key. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setApiKey('');
    onClose();
  };

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
        styles.modalContainer,
        Platform.OS === 'android' && styles.androidModalContent
      ]}>
        <View style={[styles.modalHeader, { borderBottomColor: colors.text + '20' }]}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <IconSymbol name="xmark" size={24} color={colors.text} />
          </TouchableOpacity>
          <ThemedText style={styles.modalTitle}>Change API Key</ThemedText>
          <TouchableOpacity onPress={handleSave} disabled={isLoading} style={[styles.saveButton, { backgroundColor: colors.text, opacity: isLoading ? 0.5 : 1 }]}>
            <ThemedText style={[styles.saveText, { color: colors.background }]}>
              {isLoading ? 'Saving...' : 'Save'}
            </ThemedText>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
          <ThemedText style={styles.modalDescription}>
            Enter your new Gemini API key below. You can get a free API key from aistudio.google.com.
          </ThemedText>

          <TextInput
            style={[
              styles.apiKeyInput,
              { 
                borderColor: colors.text + '40',
                color: colors.text,
                backgroundColor: colors.background,
              }
            ]}
            placeholder="Enter your Gemini API key here..."
            placeholderTextColor={colors.text + '60'}
            value={apiKey}
            onChangeText={setApiKey}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            multiline
            textAlignVertical="top"
          />
        </ScrollView>
      </ThemedView>
    </Modal>
  );
}

// AI Model Modal Component
function AIModelModal({ visible, onClose, colors }: {
  visible: boolean;
  onClose: () => void;
  colors: any;
}) {
  const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash');
  const [customModel, setCustomModel] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const modelOptions = [
    {
      name: 'Gemini 2.5 Pro',
      value: 'gemini-2.5-pro',
      subtitle: 'Flagship model with cutting edge intelligence. May take several minutes to respond.',
      tag: { text: 'smartest', color: '#FF4444' },
    },
    {
      name: 'Gemini 2.5 Flash',
      value: 'gemini-2.5-flash',
      subtitle: 'Faster model with mid-tier intelligence.',
      tag: { text: 'well-rounded', color: '#4A90E2' },
    },
    {
      name: 'Gemini 2.0 Flash',
      value: 'gemini-2.0-flash',
      subtitle: 'Fast model with outdated performance. Not recommended.',
      tag: { text: 'fastest', color: '#44AA44' },
    },
  ];

  useEffect(() => {
    if (visible) {
      loadCurrentModel();
    }
  }, [visible]);

  const loadCurrentModel = async () => {
    try {
      const currentModel = await UserProfileService.getAIModel();
      setSelectedModel(currentModel);
    } catch (error) {
      console.error('Error loading current model:', error);
    }
  };

  const handleSave = async () => {
    const modelToSave = selectedModel === 'custom' ? customModel.trim() : selectedModel;
    
    if (!modelToSave) {
      Alert.alert('Required', 'Please select a model or enter a custom model name.');
      return;
    }

    setIsLoading(true);
    try {
      await UserProfileService.saveAIModel(modelToSave);
      onClose();
    } catch (error) {
      Alert.alert('Error', 'Failed to update AI model. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setCustomModel('');
    onClose();
  };

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
        styles.modalContainer,
        Platform.OS === 'android' && styles.androidModalContent
      ]}>
        <KeyboardAvoidingView 
          style={styles.keyboardAvoidingView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={[styles.modalHeader, { borderBottomColor: colors.text + '20' }]}>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <IconSymbol name="xmark" size={24} color={colors.text} />
            </TouchableOpacity>
            <ThemedText style={styles.modalTitle}>AI Model</ThemedText>
            <TouchableOpacity onPress={handleSave} disabled={isLoading} style={[styles.saveButton, { backgroundColor: colors.text, opacity: isLoading ? 0.5 : 1 }]}>
              <ThemedText style={[styles.saveText, { color: colors.background }]}>
                {isLoading ? 'Saving...' : 'Save'}
              </ThemedText>
            </TouchableOpacity>
          </View>

          <ScrollView 
            ref={scrollViewRef}
            style={styles.modalContent} 
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.modalScrollContent}
          >
            <ThemedText style={styles.modalDescription}>
              Choose which Google Gemini model to use for all AI analysis in the app.
            </ThemedText>

            {modelOptions.map((model) => (
              <TouchableOpacity
                key={model.value}
                style={[
                  styles.modelOption,
                  {
                    borderColor: colors.text + '20',
                    backgroundColor: selectedModel === model.value ? colors.tint + '20' : colors.background,
                  }
                ]}
                onPress={() => setSelectedModel(model.value)}
              >
                <View style={styles.modelOptionContent}>
                  <View style={styles.modelOptionText}>
                    <View style={styles.modelTitleRow}>
                      <ThemedText style={styles.modelOptionTitle}>{model.name}</ThemedText>
                      <View style={[styles.modelTag, { backgroundColor: model.tag.color }]}>
                        <ThemedText style={styles.modelTagText}>{model.tag.text}</ThemedText>
                      </View>
                    </View>
                    <ThemedText style={styles.modelOptionSubtitle}>{model.subtitle}</ThemedText>
                  </View>
                  <View style={[
                    styles.radioButton,
                    { borderColor: colors.text + '40' }
                  ]}>
                    {selectedModel === model.value && (
                      <View style={[styles.radioButtonInner, { backgroundColor: colors.tint }]} />
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={[
                styles.modelOption,
                {
                  borderColor: colors.text + '20',
                  backgroundColor: selectedModel === 'custom' ? colors.tint + '20' : colors.background,
                }
              ]}
              onPress={() => setSelectedModel('custom')}
            >
              <View style={styles.modelOptionContent}>
                <View style={styles.modelOptionText}>
                  <ThemedText style={styles.modelOptionTitle}>Other model</ThemedText>
                  <ThemedText style={styles.modelOptionSubtitle}>Enter a custom model name</ThemedText>
                </View>
                <View style={[
                  styles.radioButton,
                  { borderColor: colors.text + '40' }
                ]}>
                  {selectedModel === 'custom' && (
                    <View style={[styles.radioButtonInner, { backgroundColor: colors.tint }]} />
                  )}
                </View>
              </View>
            </TouchableOpacity>

            {selectedModel === 'custom' && (
              <TextInput
                style={[
                  styles.customModelInput,
                  {
                    borderColor: colors.text + '40',
                    color: colors.text,
                    backgroundColor: colors.background,
                  }
                ]}
                placeholder="Enter custom model name (e.g., gemini-1.5-pro)"
                placeholderTextColor={colors.text + '60'}
                value={customModel}
                onChangeText={setCustomModel}
                autoCapitalize="none"
                autoCorrect={false}
                onFocus={() => {
                  setTimeout(() => {
                    scrollViewRef.current?.scrollToEnd({ animated: true });
                  }, 100);
                }}
              />
            )}
            
            {selectedModel === 'custom' && (
              <View style={styles.keyboardSpacer} />
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </ThemedView>
    </Modal>
  );
}

// Delete History Modal Component
function DeleteHistoryModal({ visible, onClose, colors }: {
  visible: boolean;
  onClose: () => void;
  colors: any;
}) {
  const [selectedOption, setSelectedOption] = useState('all');
  const [isLoading, setIsLoading] = useState(false);

  const deleteOptions = [
    {
      name: 'Delete all history',
      value: 'all',
      subtitle: 'Permanently delete all meal entries',
    },
    {
      name: 'Delete past hour',
      value: 'hour',
      subtitle: 'Delete meals from the last 60 minutes',
    },
    {
      name: 'Delete past day',
      value: 'day',
      subtitle: 'Delete meals from the last 24 hours',
    },
    {
      name: 'Delete past month',
      value: 'month',
      subtitle: 'Delete meals from the last 30 days',
    },
    {
      name: 'Delete past year',
      value: 'year',
      subtitle: 'Delete meals from the last 365 days',
    },
  ];

  const handleDelete = async () => {
    Alert.alert(
      'Confirm Deletion',
      `Are you sure you want to ${selectedOption === 'all' ? 'delete all meal history' : `delete meals from the past ${selectedOption}`}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsLoading(true);
            try {
              await FileSystemStorageService.clearHistoryByTimeRange(selectedOption as 'hour' | 'day' | 'month' | 'year' | 'all');
              Alert.alert('Success', 'Selected meal history has been deleted.');
              onClose();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete history. Please try again.');
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleClose = () => {
    setSelectedOption('all');
    onClose();
  };

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
        styles.modalContainer,
        Platform.OS === 'android' && styles.androidModalContent
      ]}>
        <View style={[styles.modalHeader, { borderBottomColor: colors.text + '20' }]}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <IconSymbol name="xmark" size={24} color={colors.text} />
          </TouchableOpacity>
          <ThemedText style={styles.modalTitle}>Delete History</ThemedText>
          <TouchableOpacity onPress={handleDelete} disabled={isLoading} style={[styles.saveButton, { backgroundColor: '#FF3B30', opacity: isLoading ? 0.5 : 1 }]}>
            <ThemedText style={[styles.saveText, { color: 'white' }]}>
              {isLoading ? 'Deleting...' : 'Delete'}
            </ThemedText>
          </TouchableOpacity>
        </View>

        <ScrollView 
          style={styles.modalContent} 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.modalScrollContent}
        >
          <ThemedText style={styles.modalDescription}>
            Choose which meals to delete from your history. This action cannot be undone.
          </ThemedText>

          {deleteOptions.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.modelOption,
                {
                  borderColor: colors.text + '20',
                  backgroundColor: selectedOption === option.value ? colors.tint + '20' : colors.background,
                }
              ]}
              onPress={() => setSelectedOption(option.value)}
            >
              <View style={styles.modelOptionContent}>
                <View style={styles.modelOptionText}>
                  <ThemedText style={styles.modelOptionTitle}>{option.name}</ThemedText>
                  <ThemedText style={styles.modelOptionSubtitle}>{option.subtitle}</ThemedText>
                </View>
                <View style={[
                  styles.radioButton,
                  { borderColor: colors.text + '40' }
                ]}>
                  {selectedOption === option.value && (
                    <View style={[styles.radioButtonInner, { backgroundColor: colors.tint }]} />
                  )}
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  chartCarousel: {
    marginBottom: 16,
    alignItems: 'center',
  },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'TikTokSans-Bold',
    marginBottom: 16,
    opacity: 0.8,
  },
  infoCard: {
    padding: 20,
    borderRadius: 12,
  },
  appName: {
    fontSize: 24,
    fontFamily: 'TikTokSans-Bold',
    marginBottom: 8,
  },
  appDescription: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 12,
    opacity: 0.8,
  },
  version: {
    fontSize: 14,
    opacity: 0.6,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  optionIcon: {
    marginRight: 16,
  },
  optionText: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontFamily: 'TikTokSans-SemiBold',
  },
  optionSubtitle: {
    fontSize: 14,
    opacity: 0.6,
    marginTop: 2,
  },
  disclaimer: {
    padding: 16,
    marginTop: 20,
    marginBottom: 40,
  },
  disclaimerText: {
    fontSize: 12,
    opacity: 0.6,
    textAlign: 'center',
    lineHeight: 18,
  },
  modalContainer: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 60 : 0,
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

  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 16 : 0,
    paddingBottom: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonContainer: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'TikTokSans-SemiBold',
  },
  saveButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  saveText: {
    fontSize: 16,
    fontFamily: 'TikTokSans-SemiBold',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  modalDescription: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 32,
    textAlign: 'center',
    opacity: 0.7,
  },
  apiKeyInput: {
    borderWidth: 2,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 120,
    maxHeight: 200,
  },
  modelOption: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  modelOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modelOptionText: {
    flex: 1,
  },
  modelOptionTitle: {
    fontSize: 18,
    fontFamily: 'TikTokSans-Bold',
  },
  modelOptionSubtitle: {
    fontSize: 14,
    opacity: 0.7,
    lineHeight: 20,
  },
  modelTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  modelTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 10,
  },
  modelTagText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontFamily: 'TikTokSans-SemiBold',
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 16,
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  customModelInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    marginTop: 16,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  modalScrollContent: {
    paddingBottom: 20,
  },
  keyboardSpacer: {
    height: 120,
  },
  authorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  authorImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 16,
  },
  authorInfo: {
    flex: 1,
  },
  authorName: {
    fontSize: 20,
    fontFamily: 'TikTokSans-Bold',
    marginBottom: 2,
  },
  authorTitle: {
    fontSize: 14,
    opacity: 0.7,
    fontFamily: 'TikTokSans-Medium',
  },
  authorDescription: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 16,
    opacity: 0.8,
  },
  authorLinks: {
    flexDirection: 'row',
    gap: 20,
  },
  authorLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  authorLinkText: {
    fontSize: 14,
    fontFamily: 'TikTokSans-SemiBold',
  },
});