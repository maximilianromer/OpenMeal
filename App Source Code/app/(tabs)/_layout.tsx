
import { Tabs, useNavigation } from 'expo-router';
import React, { useState, useEffect } from 'react';
import { Platform, DeviceEventEmitter } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HapticTab } from '@/components/HapticTab';
import { IconSymbol } from '@/components/ui/IconSymbol';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { AddMealModal } from '@/components/AddMealModal';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const navigation = useNavigation();
  const [modalVisible, setModalVisible] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    // Listen for notification taps
    const subscription = DeviceEventEmitter.addListener('openAddMealModal', () => {
      setModalVisible(true);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const CustomAddButton = ({ children, onPress, ...props }: any) => {
    return (
      <HapticTab
        {...props}
        onPress={() => {
          setModalVisible(true);
        }}
      >
        {children}
      </HapticTab>
    );
  };

  return (
    <>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
          headerShown: false,
          tabBarButton: HapticTab,
          tabBarBackground: TabBarBackground,
          tabBarStyle: Platform.select({
            ios: {
              position: 'absolute',
            },
            android: {
              height: 70 + insets.bottom,
              paddingBottom: Math.max(insets.bottom, 10),
              paddingTop: 10,
            },
            default: {},
          }),
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="add"
          options={{
            title: 'Add',
            tabBarIcon: ({ color }) => <IconSymbol size={32} name="plus" color={color} />,
            tabBarButton: CustomAddButton,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="person.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="explore"
          options={{
            href: null, // Hide this tab since we're moving its functionality to the home screen
          }}
        />
        <Tabs.Screen
          name="font-license"
          options={{
            href: null,
            tabBarStyle: { display: 'none' },
            headerShown: false,
          }}
        />
      </Tabs>
      
      <AddMealModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onMealAdded={() => {
          // Close the modal - the home screen will refresh automatically via useFocusEffect
          setModalVisible(false);
        }}
      />
    </>
  );
}
