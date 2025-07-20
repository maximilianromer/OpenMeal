
import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Pressable,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';

interface DateTimePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (date: Date) => void;
  initialDate: Date;
  mode: 'date' | 'time';
  title: string;
}

export function DateTimePickerModal({ 
  visible, 
  onClose, 
  onSave, 
  initialDate, 
  mode, 
  title 
}: DateTimePickerModalProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [selectedDate, setSelectedDate] = useState(initialDate);

  useEffect(() => {
    if (visible) {
      setSelectedDate(initialDate);
    }
  }, [visible, initialDate]);

  const handleSave = () => {
    onSave(selectedDate);
    onClose();
  };

  const handleCancel = () => {
    setSelectedDate(initialDate);
    onClose();
  };

  const onChange = (event: any, date?: Date) => {
    if (Platform.OS === 'android') {
      if (event.type === 'set' && date) {
        onSave(date);
      }
      onClose();
    } else if (date) {
      setSelectedDate(date);
    }
  };

  // On Android, don't show the custom modal - let the native picker handle everything
  if (Platform.OS === 'android') {
    return visible ? (
      <DateTimePicker
        value={selectedDate}
        mode={mode}
        display="default"
        onChange={onChange}
        textColor={colors.text}
        accentColor={colors.tint}
      />
    ) : null;
  }

  // iOS - show custom modal with embedded picker
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={handleCancel}
    >
      <Pressable style={[styles.overlay, { backgroundColor: colorScheme === 'dark' ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)' }]} onPress={handleCancel}>
        <Pressable style={styles.modalContainer} onPress={(e) => e.stopPropagation()}>
          <ThemedView style={[styles.modalContent, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: colors.text + '20' }]}>
              <TouchableOpacity onPress={handleCancel} style={styles.headerButton}>
                <ThemedText style={[styles.headerButtonText, { color: colors.text }]}>
                  Cancel
                </ThemedText>
              </TouchableOpacity>
              
              <ThemedText style={[styles.headerTitle, { color: colors.text }]}>
                {title}
              </ThemedText>
              
              <TouchableOpacity onPress={handleSave} style={styles.headerButton}>
                <ThemedText style={[styles.headerButtonText, { color: colors.tint }]}>
                  Done
                </ThemedText>
              </TouchableOpacity>
            </View>

            {/* Date/Time Picker */}
            <View style={styles.pickerContainer}>
              <DateTimePicker
                value={selectedDate}
                mode={mode}
                display="spinner"
                onChange={onChange}
                textColor={colors.text}
                accentColor={colors.tint}
                style={styles.picker}
              />
            </View>
          </ThemedView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 400,
  },
  modalContent: {
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  headerButton: {
    minWidth: 60,
  },
  headerButtonText: {
    fontSize: 17,
    fontWeight: '400',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  pickerContainer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    alignItems: 'center',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  picker: {
    width: '100%',
    height: 200,
  },
});
