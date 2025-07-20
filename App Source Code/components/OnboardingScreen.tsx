import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  BackHandler,
  Keyboard,
  Modal,
  StatusBar,
  Animated,
} from 'react-native';
import WheelPicker from '@quidone/react-native-wheel-picker';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import DailyGoalsService, { DailyGoals } from '@/services/DailyGoalsService';
import OnboardingService from '@/services/OnboardingService';
import UserProfileService, { UserProfile } from '@/services/UserProfileService';
import ExportImportService from '@/services/ExportImportService';
import * as DocumentPicker from 'expo-document-picker';
import * as WebBrowser from 'expo-web-browser';
import { ExportImportModal } from '@/components/ExportImportModal';

interface OnboardingScreenProps {
  onComplete: () => void;
  mode?: 'onboarding' | 'recalculation';
  onCancel?: () => void;
}

const allSteps = [
  'welcome',
  'age',
  'gender',
  'height',
  'weight',
  'activity',
  'goal',
  'summary',
  'byokExplanation',
  'apiKey',
  'modelSelector'
];

const storyMessages = [
  "On July 4, 2024, Hua, et. al published Nutribench: A dataset for evaluating large language models on nutrition estimation from meal descriptions.",
  "It found that Large Language Models, given good instructions, outperformed licensed nutritionists at estimating the nutritional content of a meal, given just a picture.",
  "After reading the paper, I downloaded a bunch of apps that offered this type of AI-powered nutrition analysis. They were way overpriced, and had horrible UI.",
  "More importantly, they were designed with a disbelief in the technology they were serving: almost all of them were overengineered to plug into nutrition databases that tended to persuade models away from the analysis that research showed them capable of.",
  "So I built my own. It's 100% free, open-source, and gives you complete control over your data.",
  "I hope you find it as useful as I do.",
  "--Max Romer",
];


// Pre-generate wheel picker data to avoid recreating arrays on every render
const FEET_DATA = Array.from({ length: 8 }, (_, i) => ({
  label: `${i + 2}'`,
  value: i + 2,
}));

const INCHES_DATA = Array.from({ length: 12 }, (_, i) => ({
  label: `${i}"`,
  value: i,
}));

const CM_DATA = Array.from({ length: 242 }, (_, i) => ({
  label: `${i + 61} cm`,
  value: i + 61,
}));

const LBS_DATA = Array.from({ length: 451 }, (_, i) => ({
  label: `${i + 50} lbs`,
  value: i + 50,
}));

const KG_DATA = Array.from({ length: 201 }, (_, i) => ({
  label: `${i + 25} kg`,
  value: i + 25,
}));

export function OnboardingScreen({ onComplete, mode = 'onboarding', onCancel }: OnboardingScreenProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const scrollViewRef = useRef<ScrollView>(null);

  const getSteps = () => {
    if (mode === 'recalculation') {
      return allSteps.filter(s => s !== 'welcome' && s !== 'apiKey' && s !== 'modelSelector');
    }
    return allSteps;
  }
  const [steps, setSteps] = useState(getSteps());

  const [step, setStep] = useState(0);

  const welcomeElementsOpacity = useRef(new Animated.Value(1)).current;

  const [age, setAge] = useState('');
  const ageInput = useRef<TextInput | null>(null);
  const [gender, setGender] = useState<'male' | 'female' | ''>('');
  const [useMetric, setUseMetric] = useState(false);
  const [heightFeet, setHeightFeet] = useState(5);
  const [heightInches, setHeightInches] = useState(10);
  const [heightCm, setHeightCm] = useState(178);
  const [weight, setWeight] = useState(150); // Default to 150 lbs (imperial)
  const [activityLevel, setActivityLevel] = useState<number | null>(null);
  const [goal, setGoal] = useState<'lose' | 'maintain' | 'gain' | null>(null);
  const [goals, setGoals] = useState<DailyGoals>({
    calories: 2000,
    protein: 150,
    fats: 65,
    carbs: 250,
  });
  const [apiKey, setApiKey] = useState('');
  const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash');
  const [customModel, setCustomModel] = useState('');
  const [loading, setLoading] = useState(false);
  const [importProgress, setImportProgress] = useState({ visible: false, progress: 0, message: '' });

  useEffect(() => {
    if (mode === 'recalculation') {
      loadProfile();
    }
  }, [mode]);

  useEffect(() => {
    // Add a small delay to ensure the component is fully rendered before focusing
    const focusTimeout = setTimeout(() => {
      if (step === 1 && ageInput.current) {
        ageInput.current.focus();
      }
    }, 100);

    return () => clearTimeout(focusTimeout);
  }, [step]);

  useEffect(() => {
    if (steps[step] === 'summary') {
      calculateGoals();
    }
  }, [step, steps]);

  useEffect(() => {
    // Simple animation for import button in onboarding mode
    if (steps[step] === 'welcome' && mode === 'onboarding') {
      Animated.timing(welcomeElementsOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();
    }
  }, [step, mode, steps]);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step > 0) {
        goBack();
        return true; // Prevent default behavior
      } else if (mode === 'recalculation' && onCancel) {
        onCancel();
        return true;
      }
      return false; // Allow default behavior (exit app) on first screen
    });

    return () => backHandler.remove();
  }, [step, mode, onCancel]);

  const progress = step / (steps.length - 1);

  const loadProfile = async () => {
    const profile = await UserProfileService.getProfile();
    if (profile) {
      setAge(String(profile.age));
      setGender(profile.gender);
      setUseMetric(profile.units === 'metric');
      if (profile.units === 'metric') {
        setHeightCm(profile.heightCm);
      } else {
        const totalInches = profile.heightCm / 2.54;
        const feet = Math.floor(totalInches / 12);
        const inches = Math.round(totalInches % 12);
        setHeightFeet(feet);
        setHeightInches(inches);
      }
      if (profile.units === 'metric') {
        setWeight(Math.round(profile.weightKg));
      } else {
        setWeight(Math.round(profile.weightKg / 0.453592));
      }
      setActivityLevel(profile.activityLevel);
      setGoal(profile.goal);
    }
    
    // Load AI model settings
    const aiModel = await UserProfileService.getAIModel();
    if (aiModel) {
      const predefinedModels = ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash'];
      if (predefinedModels.includes(aiModel)) {
        setSelectedModel(aiModel);
      } else {
        setSelectedModel('custom');
        setCustomModel(aiModel);
      }
    }
  };

  const validateCurrentStep = () => {
    switch (steps[step]) {
      case 'welcome':
        return true;
      case 'age':
        return age.trim() !== '' && parseInt(age) > 0 && parseInt(age) < 120;
      case 'gender':
        return gender !== '';
      case 'height':
        if (useMetric) {
          return heightCm > 0;
        } else {
          return heightFeet > 0 && heightInches >= 0;
        }
      case 'weight':
        return weight > 0;
      case 'activity':
        return activityLevel !== null;
      case 'goal':
        return goal !== null;
      case 'summary':
        return true;
      case 'apiKey':
        return apiKey.trim() !== '' && apiKey.startsWith('AIza') && apiKey.length >= 30;
      case 'modelSelector':
        if (selectedModel === 'custom') {
          return customModel.trim() !== '';
        }
        return selectedModel !== '';
      default:
        return true;
    }
  };

  const goNext = () => {
    if (!validateCurrentStep()) {
      Alert.alert('Required Information', 'Please fill in all required information before continuing.');
      return;
    }
    if (step < steps.length - 1) {
      setStep(step + 1);
    }
  };

  const goBack = () => {
    if (step > 0) {
      setStep(step - 1);
    } else if (mode === 'recalculation' && onCancel) {
      onCancel();
    }
  };

  const getHeightCm = () => {
    if (useMetric) {
      return heightCm || 0;
    }
    const ft = heightFeet || 0;
    const inch = heightInches || 0;
    return ft * 30.48 + inch * 2.54;
  };

  const getWeightKg = () => {
    if (useMetric) {
      return weight || 0;
    }
    return (weight || 0) * 0.453592;
  };

  const calculateGoals = () => {
    const ageNum = parseInt(age) || 0;
    const weightKg = getWeightKg();
    const heightCmVal = getHeightCm();
    if (!gender || !activityLevel || !goal || !ageNum || !weightKg || !heightCmVal) {
      return;
    }
    let bmr = 0;
    if (gender === 'male') {
      bmr = 10 * weightKg + 6.25 * heightCmVal - 5 * ageNum + 5;
    } else {
      bmr = 10 * weightKg + 6.25 * heightCmVal - 5 * ageNum - 161;
    }
    const activityFactors = [1.2, 1.375, 1.55, 1.725, 1.9];
    let calories = bmr * activityFactors[activityLevel - 1];
    if (goal === 'lose') calories -= 500;
    if (goal === 'gain') calories += 500;

    const recommended: DailyGoals = {
      calories: Math.round(calories),
      protein: Math.round((calories * 0.25) / 4),
      carbs: Math.round((calories * 0.4) / 4),
      fats: Math.round((calories * 0.3) / 9),
    };
    setGoals(recommended);
  };

  const handleFinish = async () => {
    if (mode === 'onboarding') {
      if (!apiKey.trim()) {
        Alert.alert('Required', 'Please enter your Gemini API key to continue.');
        return;
      }
      if (!apiKey.startsWith('AIza') || apiKey.length < 30) {
        Alert.alert(
          'Invalid API Key',
          'Please enter a valid Gemini API key. It should start with "AIza" and be at least 30 characters long.'
        );
        return;
      }
    }
    
    setLoading(true);
    try {
      if (mode === 'onboarding') {
        await OnboardingService.saveApiKey(apiKey.trim());
        
        // Save selected AI model
        const modelToSave = selectedModel === 'custom' ? customModel.trim() : selectedModel;
        await UserProfileService.saveAIModel(modelToSave);
      }

      const profile: UserProfile = {
        age: parseInt(age) || 0,
        gender: gender as 'male' | 'female',
        heightCm: getHeightCm(),
        weightKg: getWeightKg(),
        activityLevel: activityLevel || 1,
        goal: goal || 'maintain',
        units: useMetric ? 'metric' : 'imperial',
      };
      await UserProfileService.saveProfile(profile);
      await DailyGoalsService.saveDailyGoals(goals);
      onComplete();
    } catch (e) {
      Alert.alert('Error', 'Failed to save onboarding data.');
    } finally {
      setLoading(false);
    }
  };

  const handleImportData = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const fileUri = result.assets[0].uri;
      setImportProgress({ visible: true, progress: 0, message: 'Starting import...' });

      await ExportImportService.importData(fileUri, (progress, message) => {
        setImportProgress({ visible: true, progress, message });
      });

      // Load the imported profile data into the onboarding state
      setImportProgress({ visible: true, progress: 95, message: 'Loading imported data...' });
      
      try {
        const importedProfile = await UserProfileService.getProfile();
        const importedGoals = await DailyGoalsService.getDailyGoals();
        const importedAIModel = await UserProfileService.getAIModel();
        
        if (importedProfile) {
          setAge(String(importedProfile.age));
          setGender(importedProfile.gender);
          setUseMetric(importedProfile.units === 'metric');
          
          if (importedProfile.units === 'metric') {
            setHeightCm(importedProfile.heightCm);
            setWeight(Math.round(importedProfile.weightKg));
          } else {
            const totalInches = importedProfile.heightCm / 2.54;
            const feet = Math.floor(totalInches / 12);
            const inches = Math.round(totalInches % 12);
            setHeightFeet(feet);
            setHeightInches(inches);
            setWeight(Math.round(importedProfile.weightKg / 0.453592));
          }
          
          setActivityLevel(importedProfile.activityLevel);
          setGoal(importedProfile.goal);
        }
        
        if (importedGoals) {
          setGoals(importedGoals);
        }
        
        if (importedAIModel) {
          // Check if it's a custom model or one of the predefined ones
          const predefinedModels = ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash'];
          if (predefinedModels.includes(importedAIModel)) {
            setSelectedModel(importedAIModel);
          } else {
            setSelectedModel('custom');
            setCustomModel(importedAIModel);
          }
        }
        
        // Skip to API key step since all other data is imported
        const apiKeyStepIndex = allSteps.indexOf('apiKey');
        setImportProgress({ visible: true, progress: 100, message: 'Data imported! Enter your API key to continue.' });
        
        setTimeout(() => {
          setImportProgress({ visible: false, progress: 0, message: '' });
          setStep(apiKeyStepIndex);
        }, 1500);
        
      } catch (loadError) {
        console.error('Error loading imported data:', loadError);
        // If we can't load the data, still skip to API key step
        const apiKeyStepIndex = allSteps.indexOf('apiKey');
        setImportProgress({ visible: true, progress: 100, message: 'Import complete! Enter your API key to continue.' });
        
        setTimeout(() => {
          setImportProgress({ visible: false, progress: 0, message: '' });
          setStep(apiKeyStepIndex);
        }, 1500);
      }
      
    } catch (error) {
      setImportProgress({ 
        visible: true, 
        progress: 0, 
        message: `Import failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      });
      setTimeout(() => {
        setImportProgress({ visible: false, progress: 0, message: '' });
      }, 3000);
    }
  };

  const renderProgressBar = () => {
    if (step === 0 && mode === 'onboarding') return null;
    return (
      <View style={styles.progressBarContainer}>
        <View style={[styles.progressBar, { width: `${progress * 100}%`, backgroundColor: colors.tint }]} />
      </View>
    );
  };

  const NextButton = ({ onPress, title }: { onPress: () => void; title?: string }) => {
    const isValid = validateCurrentStep();
    const isLoading = (steps[step] === 'apiKey' || (mode === 'recalculation' && steps[step] === 'summary')) && loading;

    return (
      <TouchableOpacity 
        onPress={onPress} 
        style={[
          styles.nextButton, 
          { 
            backgroundColor: isValid && !isLoading ? colors.tint : colors.text + '40',
            opacity: isValid && !isLoading ? 1 : 0.6
          }
        ]}
        disabled={!isValid || isLoading}
      >
        <ThemedText style={[styles.nextButtonText, { color: colors.background }]}>
          {title || 'Next'}
        </ThemedText>
        <IconSymbol name="chevron.right" size={24} color={colors.background} style={styles.nextIcon} />
      </TouchableOpacity>
    );
  };

  const BackButton = () => {
    if (mode === 'recalculation') {
      return null;
    }
    const showBackButton = mode === 'onboarding' ? step > 0 : true;
    if (!showBackButton) return <View style={styles.backButton} />;

    return (
      <TouchableOpacity onPress={goBack} style={styles.backButton}>
        <IconSymbol name="chevron.right" size={30} color={colors.text} style={{ transform: [{ rotate: '180deg' }] }} />
      </TouchableOpacity>
    )
  };

  const renderWelcome = () => {
    const handleLinkPress = () => {
        WebBrowser.openBrowserAsync('https://arxiv.org/abs/2407.12843');
    };

    const MessageBubble = ({ text, index }: { text: string; index: number }) => (
      <View style={styles.messageBubbleWrapper}>
        <View style={[styles.messageBubble, { backgroundColor: colors.cardBackground }]}>
          {index === 0 ? (
            <ThemedText style={styles.messageText}>
              On July 4, 2024, Hua, et. al published{' '}
              <ThemedText style={{ color: colors.tint, textDecorationLine: 'underline' }} onPress={handleLinkPress}>
                Nutribench: A dataset for evaluating large language models on nutrition estimation from meal descriptions
              </ThemedText>
              .
            </ThemedText>
          ) : (
            <ThemedText style={styles.messageText}>{text}</ThemedText>
          )}
        </View>
      </View>
    );

    const WelcomeTitle = () => (
      <View style={styles.welcomeTitleContainer}>
        <ThemedText style={styles.welcome}>Welcome to OpenMeal</ThemedText>
      </View>
    );

    return (
      <View style={styles.welcomeContainer}>
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesScrollView}
          contentContainerStyle={styles.messagesContentContainer}
          showsVerticalScrollIndicator={false}
        >
          <WelcomeTitle />
          {storyMessages.map((message, index) => (
            <MessageBubble key={index} text={message} index={index} />
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderAge = () => (
    <View style={styles.stepContainer}>
      <ThemedText style={styles.question}>How old are you?</ThemedText>
      <TextInput
        ref={ageInput}
        style={[styles.input, { borderColor: colors.text + '40', color: colors.text }]}
        keyboardType="number-pad"
        value={age}
        onChangeText={setAge}
        placeholder="Age"
        placeholderTextColor={colors.text + '40'}
      />
    </View>
  );

  const renderGender = () => (
    <View style={styles.stepContainer}>
      <ThemedText style={styles.question}>What is your gender?</ThemedText>
      <ThemedText style={styles.subtitle}>This is used for calculating your Basal Metabolic Rate (BMR)</ThemedText>
      <View style={styles.cardRow}>
        {['male','female'].map(g => (
          <TouchableOpacity
            key={g}
            onPress={() => setGender(g as 'male' | 'female')}
            style={[
              styles.selectCard, 
              { backgroundColor: colors.cardBackground },
              gender === g && { borderColor: colors.tint }
            ]}
          >
            <ThemedText style={styles.cardText}>{g === 'male' ? 'Male' : 'Female'}</ThemedText>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderHeight = () => {
    return (
      <View style={styles.stepContainer}>
        <ThemedText style={styles.question}>What is your height?</ThemedText>
        <View style={styles.toggleRow}>
          <TouchableOpacity onPress={() => setUseMetric(false)} style={[
            styles.toggle, 
            { backgroundColor: !useMetric ? colors.tint : colors.cardBackground },
            !useMetric && { borderColor: colors.tint }
          ]}>
            <ThemedText style={[styles.toggleText, { color: !useMetric ? colors.background : colors.text }]}>Imperial</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setUseMetric(true)} style={[
            styles.toggle, 
            { backgroundColor: useMetric ? colors.tint : colors.cardBackground },
            useMetric && { borderColor: colors.tint }
          ]}>
            <ThemedText style={[styles.toggleText, { color: useMetric ? colors.background : colors.text }]}>Metric</ThemedText>
          </TouchableOpacity>
        </View>
        {useMetric ? (
          <View style={styles.metricWheelContainer}>
            <WheelPicker
              data={CM_DATA}
              value={heightCm}
              onValueChanged={({ item }) => setHeightCm(item.value)}
              itemHeight={50}
              visibleItemCount={5}
              width={200}
              itemTextStyle={[styles.wheelPickerText, { color: colors.text }]}
              style={styles.wheelPicker}
            />
          </View>
        ) : (
          <View style={styles.imperialWheelContainer}>
            <View style={styles.heightWheelRow}>
              <View style={styles.wheelPickerContainer}>
                <WheelPicker
                  data={FEET_DATA}
                  value={heightFeet}
                  onValueChanged={({ item }) => setHeightFeet(item.value)}
                  itemHeight={50}
                  visibleItemCount={5}
                  width={100}
                  itemTextStyle={[styles.wheelPickerText, { color: colors.text }]}
                  style={styles.wheelPicker}
                />
              </View>
              <View style={styles.wheelPickerContainer}>
                <WheelPicker
                  data={INCHES_DATA}
                  value={heightInches}
                  onValueChanged={({ item }) => setHeightInches(item.value)}
                  itemHeight={50}
                  visibleItemCount={5}
                  width={100}
                  itemTextStyle={[styles.wheelPickerText, { color: colors.text }]}
                  style={styles.wheelPicker}
                />
              </View>
            </View>
          </View>
        )}
      </View>
    );
  };

  const renderWeight = () => {
    // Set default weight when switching units
    const handleUnitChange = (metric: boolean) => {
      if (metric !== useMetric) {
        if (metric) {
          // Convert to metric (70kg default)
          setWeight(70);
        } else {
          // Convert to imperial (150lbs default)
          setWeight(150);
        }
      }
      setUseMetric(metric);
    };

    return (
      <View style={styles.stepContainer}>
        <ThemedText style={styles.question}>What is your weight?</ThemedText>
        <View style={styles.toggleRow}>
          <TouchableOpacity onPress={() => handleUnitChange(false)} style={[
            styles.toggle, 
            { backgroundColor: !useMetric ? colors.tint : colors.cardBackground },
            !useMetric && { borderColor: colors.tint }
          ]}>
            <ThemedText style={[styles.toggleText, { color: !useMetric ? colors.background : colors.text }]}>Imperial</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleUnitChange(true)} style={[
            styles.toggle, 
            { backgroundColor: useMetric ? colors.tint : colors.cardBackground },
            useMetric && { borderColor: colors.tint }
          ]}>
            <ThemedText style={[styles.toggleText, { color: useMetric ? colors.background : colors.text }]}>Metric</ThemedText>
          </TouchableOpacity>
        </View>
        <View style={styles.weightWheelContainer}>
          <WheelPicker
            data={useMetric ? KG_DATA : LBS_DATA}
            value={weight}
            onValueChanged={({ item }) => setWeight(item.value)}
            itemHeight={50}
            visibleItemCount={5}
            width={180}
            itemTextStyle={[styles.wheelPickerText, { color: colors.text }]}
            style={styles.wheelPicker}
          />
        </View>
      </View>
    );
  };

  const renderActivity = () => (
    <View style={styles.stepContainer}>
      <ThemedText style={styles.question}>How active are you?</ThemedText>
      <View style={styles.cardColumn}>
        {[
          { label: 'Sedentary', desc: 'Little to no exercise' },
          { label: 'Lightly Active', desc: 'Light exercise 1-3 days/week' },
          { label: 'Moderately Active', desc: 'Moderate exercise 3-5 days/week' },
          { label: 'Very Active', desc: 'Hard exercise 6-7 days/week' },
          { label: 'Extra Active', desc: 'Very hard exercise + physical job' },
        ].map((opt, idx) => (
          <TouchableOpacity
            key={opt.label}
            onPress={() => setActivityLevel(idx + 1)}
            style={[
              styles.selectCard, 
              { backgroundColor: colors.cardBackground },
              activityLevel === idx + 1 && { borderColor: colors.tint }
            ]}
          >
            <ThemedText style={styles.cardText}>{opt.label}</ThemedText>
            <ThemedText style={styles.cardDesc}>{opt.desc}</ThemedText>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderGoal = () => (
    <View style={styles.stepContainer}>
      <ThemedText style={styles.question}>What are your goals?</ThemedText>
      <View style={styles.cardColumn}>
        {[
          { label: 'Lose Weight', value: 'lose', desc: '1-2 lbs per week' },
          { label: 'Maintain Weight', value: 'maintain', desc: 'Stay at current weight' },
          { label: 'Gain Weight', value: 'gain', desc: '1-2 lbs per week' },
        ].map(opt => (
          <TouchableOpacity
            key={opt.value}
            onPress={() => setGoal(opt.value as 'lose' | 'maintain' | 'gain')}
            style={[
              styles.selectCard, 
              { backgroundColor: colors.cardBackground },
              goal === opt.value && { borderColor: colors.tint }
            ]}
          >
            <ThemedText style={styles.cardText}>{opt.label}</ThemedText>
            <ThemedText style={styles.cardDesc}>{opt.desc}</ThemedText>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const EditableGoal = ({ label, value, unit, color, onEdit }: { label: string; value: number; unit: string; color: string; onEdit: (v:number)=>void }) => {
    const [editing, setEditing] = useState(false);
    const [val, setVal] = useState(String(value));
    return (
      <TouchableOpacity
        onPress={() => setEditing(true)}
        style={[styles.goalCard, { backgroundColor: color }]}
      >
        {editing ? (
          <View style={styles.goalContent}>
            <View style={styles.goalHeader}>
              <ThemedText style={[styles.goalLabel, { color: '#000' }]}>{label}</ThemedText>
              <TouchableOpacity onPress={() => { const num = parseFloat(val); if(!isNaN(num)) onEdit(num); setEditing(false); }}>
                <IconSymbol name="checkmark" size={18} color="#000" />
              </TouchableOpacity>
            </View>
            <View style={styles.editContainer}>
              <TextInput style={[styles.goalInput,{color:'#000'}]} keyboardType="numeric" value={val} onChangeText={setVal} autoFocus />
              <ThemedText style={[styles.unitText, { color: '#000' }]}>{unit}</ThemedText>
            </View>
          </View>
        ) : (
          <View style={styles.goalContent}>
            <View style={styles.goalHeader}>
              <ThemedText style={[styles.goalLabel, { color: '#000' }]}>{label}</ThemedText>
              <IconSymbol name="edit" size={16} color="#000" />
            </View>
            <View style={styles.valueContainer}>
              <ThemedText style={[styles.goalValue, { color: '#000' }]}>{Math.round(value)}</ThemedText>
              <ThemedText style={[styles.unitText, { color: '#000' }]}>{unit}</ThemedText>
            </View>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderSummary = () => (
    <View style={styles.stepContainer}>
      <ThemedText style={styles.question}>Daily Goals</ThemedText>
      <View style={styles.goalsContainer}>
        <EditableGoal label="Calories" value={goals.calories} unit="kcal" color="#FFA726" onEdit={v=>setGoals(g=>({...g,calories:v}))} />
        <EditableGoal label="Protein" value={goals.protein} unit="g" color="#EF5350" onEdit={v=>setGoals(g=>({...g,protein:v}))} />
        <EditableGoal label="Fats" value={goals.fats} unit="g" color="#26A69A" onEdit={v=>setGoals(g=>({...g,fats:v}))} />
        <EditableGoal label="Carbs" value={goals.carbs} unit="g" color="#FFEE58" onEdit={v=>setGoals(g=>({...g,carbs:v}))} />
      </View>
    </View>
  );

  const renderByokExplanation = () => (
    <View style={styles.stepContainer}>
      <ThemedText style={styles.question}>OpenMeal uses a Bring Your Own Key (BYOK) Model</ThemedText>
      <View style={styles.byokCardsContainer}>
        <View style={[styles.byokCard, { backgroundColor: colors.cardBackground }]}>
          <View style={styles.byokCardHeader}>
            <View style={styles.byokEmojiContainer}>
              <ThemedText style={styles.byokEmoji}>🧠</ThemedText>
            </View>
            <View style={styles.byokTitleContainer}>
              <ThemedText style={styles.byokCardTitle}>OpenMeal uses Google Gemini models</ThemedText>
            </View>
          </View>
          <ThemedText style={styles.byokCardSubtitle}>
            OpenMeal's analysis features are built upon Google Gemini multimodal LLMs, which are trained to apply visual understanding to a general-purpose corpus of human knowledge. OpenMeal works because this corpus contains accurate descriptions of the nutritional values of most common human food.
          </ThemedText>
        </View>
        
        <View style={[styles.byokCard, { backgroundColor: colors.cardBackground }]}>
          <View style={styles.byokCardHeader}>
            <View style={styles.byokEmojiContainer}>
              <ThemedText style={styles.byokEmoji}>🤑</ThemedText>
            </View>
            <View style={styles.byokTitleContainer}>
              <ThemedText style={styles.byokCardTitle}>You can access Gemini models for free</ThemedText>
            </View>
          </View>
          <ThemedText style={styles.byokCardSubtitle}>
            Google offers a "free tier" of the Google Gemini API to every account, with thousands of usages per day. However, they do have rate limits (hundreds per day, per model), and they reserve the right to train future models on your inputs. You can circumvent these by using a paid key.
          </ThemedText>
        </View>
        
        <View style={[styles.byokCard, { backgroundColor: colors.cardBackground }]}>
          <View style={styles.byokCardHeader}>
            <View style={styles.byokEmojiContainer}>
              <ThemedText style={styles.byokEmoji}>🔐</ThemedText>
            </View>
            <View style={styles.byokTitleContainer}>
              <ThemedText style={styles.byokCardTitle}>Your device talks directly to Google</ThemedText>
            </View>
          </View>
          <ThemedText style={styles.byokCardSubtitle}>
            OpenMeal does not have a server or collect any of your data. Instead, your Gemini API key is stored in a secure vault on your device, and API calls are made directly to Google. Your meal history is stored on-device, and can be exported or deleted.
          </ThemedText>
        </View>
      </View>
    </View>
  );

  const renderApiKey = () => {
    const handleOpenAIStudio = () => {
      WebBrowser.openBrowserAsync('https://aistudio.google.com/apikey');
    };

    return (
      <View style={styles.stepContainer}>
        <ThemedText style={styles.question}>Your Gemini API Key</ThemedText>
        <View style={styles.apiKeyCardsContainer}>
          {/* Card 1: Get an API key */}
          <View style={[styles.apiKeyCard, { backgroundColor: colors.cardBackground }]}>
            <View style={styles.apiKeyCardHeader}>
              <ThemedText style={styles.apiKeyCardTitle}>1. Get an API key</ThemedText>
            </View>
            <ThemedText style={styles.apiKeyCardSubtitle}>
              You can get an API key from https://aistudio.google.com. By default, this is a free tier key, and will not incur expenses. Do not share your key with anyone.
            </ThemedText>
            <TouchableOpacity
              style={[styles.apiKeyButton, { backgroundColor: colors.tint }]}
              onPress={handleOpenAIStudio}
            >
              <ThemedText style={[styles.apiKeyButtonText, { color: colors.background }]}>
                Open aistudio.google.com
              </ThemedText>
            </TouchableOpacity>
          </View>

          {/* Card 2: Enter your API key */}
          <View style={[styles.apiKeyCard, { backgroundColor: colors.cardBackground }]}>
            <View style={styles.apiKeyCardHeader}>
              <ThemedText style={styles.apiKeyCardTitle}>2. Enter your API key</ThemedText>
            </View>
            <ThemedText style={styles.apiKeyCardSubtitle}>
              Your API key is stored in a secure vault locally on your device, and is not accessible to OpenMeal's developers.
            </ThemedText>
            <TextInput
              style={[styles.apiKeyInput, { borderColor: colors.text + '40', color: colors.text }]}
              value={apiKey}
              onChangeText={setApiKey}
              placeholder="API Key"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              placeholderTextColor={colors.text + '40'}
            />
          </View>
        </View>
      </View>
    );
  };

  const renderModelSelector = () => {
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

    return (
      <View style={styles.stepContainer}>
        <ThemedText style={styles.question}>Choose your AI model</ThemedText>
        <ThemedText style={styles.subtitle}>Select which Google Gemini model to use for all AI analysis in the app.</ThemedText>
        <View style={styles.modelContainer}>
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
            />
          )}
        </View>
      </View>
    );
  };

  const renderContent = () => {
    switch (steps[step]) {
      case 'welcome':
        return renderWelcome();
      case 'age':
        return renderAge();
      case 'gender':
        return renderGender();
      case 'height':
        return renderHeight();
      case 'weight':
        return renderWeight();
      case 'activity':
        return renderActivity();
      case 'goal':
        return renderGoal();
      case 'summary':
        return renderSummary();
      case 'byokExplanation':
        return renderByokExplanation();
      case 'apiKey':
        return renderApiKey();
      case 'modelSelector':
        return renderModelSelector();
      default:
        return null;
    }
  };

  const getButtonTitle = () => {
    switch (steps[step]) {
      case 'welcome':
        return 'Start';
      case 'apiKey':
        return 'Next';
      case 'modelSelector':
        return loading ? 'Saving...' : 'Finish';
      case 'summary':
        if (mode === 'recalculation') {
          return loading ? 'Saving...' : 'Save & Finish';
        }
        return 'Next';
      default:
        return 'Next';
    }
  }

  // Check if current step has keyboard input
  const hasKeyboardInput = () => {
    const currentStep = steps[step];
    if (currentStep === 'modelSelector' && selectedModel === 'custom') {
      return true;
    }
    return ['age', 'apiKey'].includes(currentStep);
  };

  const isLastStep = steps[step] === 'modelSelector' || (mode === 'recalculation' && steps[step] === 'summary');

  const screenContent = (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <View style={[styles.innerContainer, mode === 'recalculation' && { paddingTop: 0 }]}>
          {/* Import button in top right for welcome screen */}
          {mode === 'onboarding' && step === 0 && (
            <Animated.View style={{ 
              opacity: welcomeElementsOpacity, 
              position: 'absolute',
              top: 50,
              right: 20,
              zIndex: 10,
            }}>
              <TouchableOpacity
                style={[styles.topRightImportButton, { backgroundColor: colors.background, borderColor: colors.text + '20' }]}
                onPress={handleImportData}
              >
                <ThemedText style={[styles.topRightImportText, { color: colors.text }]}>
                  Import Data
                </ThemedText>
              </TouchableOpacity>
            </Animated.View>
          )}
          <BackButton />
          {steps[step] === 'welcome' ? (
            renderWelcome()
          ) : (
            <ScrollView
              ref={scrollViewRef}
              style={styles.scrollView}
              contentContainerStyle={styles.scrollViewContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.content}>
                {renderContent()}
              </View>
              {hasKeyboardInput() && <View style={styles.keyboardSpacer} />}
            </ScrollView>
          )}
          <Animated.View
            style={[
              styles.bottomContainer,
              hasKeyboardInput() && styles.bottomContainerWithKeyboard,
              (mode === 'onboarding' && step === 0) && { opacity: welcomeElementsOpacity }
            ]}>
            <NextButton onPress={isLastStep ? handleFinish : goNext} title={getButtonTitle()} />
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </ThemedView>
  );

  if (mode === 'recalculation') {
    return (
      <Modal
        visible={true}
        animationType="slide"
        presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'overFullScreen'}
        onRequestClose={onCancel}
        statusBarTranslucent={Platform.OS === 'android'}
        transparent={Platform.OS === 'android'}
      >
        {Platform.OS === 'android' && <View style={styles.androidOverlay} />}
        <ThemedView style={[
          styles.modalContainer,
          Platform.OS === 'android' && styles.androidModalContent
        ]}>
          <View style={[styles.header, { borderBottomColor: colors.text + '20' }]}>
            <TouchableOpacity onPress={goBack} style={styles.closeButton}>
              <IconSymbol name="chevron.right" size={24} color={colors.text} style={{ transform: [{ rotate: '180deg' }] }} />
            </TouchableOpacity>
            <ThemedText style={styles.headerTitle}>Recalculate Goals</ThemedText>
            <View style={styles.placeholder} />
          </View>
          {screenContent}
        </ThemedView>
      </Modal>
    )
  }

  return (
    <>
      {screenContent}
      
      {/* Import Progress Modal */}
      <ExportImportModal
        visible={importProgress.visible}
        progress={importProgress.progress}
        message={importProgress.message}
        isError={importProgress.message.includes('failed')}
      />
    </>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 20 : 0,
  },
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 16 : 16,
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
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  placeholder: {
    width: 40,
  },
  container: {
    flex: 1,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  innerContainer: {
    flex: 1,
    paddingTop: 50,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  progressBarContainer: {
    height: 4,
    backgroundColor: '#e5e5e5',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 20,
    marginHorizontal: 20,
  },
  progressBar: {
    height: 4,
  },
  backButton: {
    height: 50,
    width: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    paddingHorizontal: 40,
    borderRadius: 20,
    width: '100%',
  },
  nextButtonText: {
    fontSize: 22,
    fontWeight: '600',
  },
  nextIcon: {
    marginLeft: 16,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  welcomeContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    width: '100%',
  },
  messagesScrollView: {
    flex: 1,
    width: '100%',
  },
  messagesContentContainer: {
    paddingHorizontal: 20,
    paddingTop: 20, // For space when scrolled all the way up
  },
  messageBubbleWrapper: {
    alignSelf: 'flex-start',
    maxWidth: '85%',
    marginVertical: 4,
  },
  messageBubble: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 22,
  },
  messageText: {
    fontSize: 16.5,
    lineHeight: 24,
  },
  welcomeTitleContainer: {
    width: '100%',
    marginTop: 30,
    marginBottom: 20,
  },
  welcomeContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-start',
    width: '100%',
  },
  welcome: {
    fontSize: 64,
    fontWeight: '900',
    textAlign: 'left',
    lineHeight: 68,
    width: '100%',
  },
  question: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 20,
  },
  subtitle: {
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 20,
  },
  input: {
    borderWidth: 2,
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 20,
  },
  inputHalf: {
    borderWidth: 2,
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    textAlign: 'center',
    flex: 1,
    marginBottom: 20,
    marginHorizontal: 4,
  },
  rowInputs: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
  },
  toggle: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccc',
    marginHorizontal: 4,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
  },
  stepContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  flex1: { flex: 1 },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    width: '100%',
    marginBottom: 20,
  },
  cardColumn: {
    width: '100%',
    gap: 12,
    marginBottom: 20,
  },
  selectCard: {
    borderWidth: 2,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  cardText: {
    fontSize: 18,
    fontWeight: '600',
  },
  cardDesc: {
    fontSize: 14,
    opacity: 0.7,
    textAlign: 'center',
  },
  goalsContainer: {
    width: '100%',
    gap: 16,
    marginBottom: 20,
  },
  goalCard: {
    padding: 20,
    borderRadius: 16,
  },
  goalContent: {
    justifyContent: 'space-between',
  },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  goalLabel: {
    fontSize: 18,
    fontWeight: '600',
  },
  goalValue: {
    fontSize: 32,
    fontWeight: '700',
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  editContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  goalInput: {
    borderBottomWidth: 2,
    borderBottomColor: '#000',
    fontSize: 32,
    fontWeight: '700',
    minWidth: 80,
    textAlign: 'center',
  },
  unitText: {
    fontSize: 16,
    fontWeight: '500',
  },
  goalsScrollContainer: {
    flex: 1,
    width: '100%',
  },
  bottomContainer: {
    paddingVertical: 20,
    paddingBottom: 30,
    paddingHorizontal: 20,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  bottomContainerWithKeyboard: {
    paddingBottom: 10,
    backgroundColor: 'transparent',
  },
  keyboardSpacer: {
    height: 120,
  },
  metricContainer: {
    width: '100%',
    alignItems: 'center',
  },
  unitLabel: {
    fontSize: 16,
    marginTop: 8,
    opacity: 0.7,
  },
  imperialContainer: {
    width: '100%',
    alignItems: 'center',
  },
  heightInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    maxWidth: 300,
  },
  dropdown: {
    height: 50,
    borderWidth: 2,
    borderRadius: 12,
    paddingHorizontal: 16,
    minWidth: 80,
    backgroundColor: 'transparent',
  },
  dropdownContainer: {
    borderRadius: 8,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  dropdownText: {
    fontSize: 18,
    textAlign: 'center',
  },
  dropdownPlaceholder: {
    fontSize: 18,
    textAlign: 'center',
  },
  dropdownItemText: {
    fontSize: 16,
    textAlign: 'center',
    paddingVertical: 4,
  },
  dropdownItemContainer: {
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  metricWheelContainer: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 20,
  },
  imperialWheelContainer: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 20,
  },
  heightWheelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  wheelPickerContainer: {
    alignItems: 'center',
  },
  wheelPicker: {
    backgroundColor: 'transparent',
  },
  wheelPickerText: {
    fontSize: 18,
    fontWeight: '500',
    textAlign: 'center',
  },
  weightWheelContainer: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 20,
  },
  byokCardsContainer: {
    width: '100%',
    gap: 20,
    marginBottom: 20,
  },
  byokCard: {
    borderRadius: 16,
    padding: 20,
    width: '100%',
  },
  byokCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    marginBottom: 12,
  },
  byokEmojiContainer: {
    width: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  byokEmoji: {
    fontSize: 40,
    lineHeight: 48,
  },
  byokTitleContainer: {
    flex: 1,
  },
  byokCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
  },
  byokCardSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.8,
    width: '100%',
  },
  importButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 24,
  },
  importIcon: {
    marginRight: 8,
  },
  importText: {
    fontSize: 16,
    fontWeight: '600',
  },
  topRightImportButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
  },
  topRightImportText: {
    fontSize: 14,
    fontWeight: '600',
  },
  modelContainer: {
    width: '100%',
    gap: 12,
    marginBottom: 20,
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
  modelTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  modelOptionTitle: {
    fontSize: 18,
    fontWeight: '700',
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
    fontWeight: '600',
  },
  modelOptionSubtitle: {
    fontSize: 14,
    opacity: 0.7,
    lineHeight: 20,
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
  apiKeyCardsContainer: {
    width: '100%',
    gap: 20,
    marginBottom: 20,
  },
  apiKeyCard: {
    borderRadius: 16,
    padding: 20,
    width: '100%',
  },
  apiKeyCardHeader: {
    marginBottom: 12,
  },
  apiKeyCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  apiKeyCardSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.8,
    marginBottom: 16,
  },
  apiKeyButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  apiKeyButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  apiKeyInput: {
    borderWidth: 2,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    marginTop: 8,
  },
});