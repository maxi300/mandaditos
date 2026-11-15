import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router/js-tabs';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { color } from '@/theme';

export default function ClienteTabs() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: color.brand,
        tabBarInactiveTintColor: color.muted,
        tabBarStyle: { borderTopColor: '#EFEAE4', height: 60 + insets.bottom, paddingTop: 6, paddingBottom: Math.max(insets.bottom, 8) },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
        sceneStyle: { backgroundColor: color.bg },
      }}>
      <Tabs.Screen name="inicio" options={{ title: 'Inicio', tabBarIcon: ({ color: c, focused }) => <Ionicons name={focused ? 'home' : 'home-outline'} size={24} color={c as string} /> }} />
      <Tabs.Screen name="actividad" options={{ title: 'Actividad', tabBarIcon: ({ color: c, focused }) => <Ionicons name={focused ? 'receipt' : 'receipt-outline'} size={24} color={c as string} /> }} />
      <Tabs.Screen name="cuenta" options={{ title: 'Cuenta', tabBarIcon: ({ color: c, focused }) => <Ionicons name={focused ? 'person' : 'person-outline'} size={24} color={c as string} /> }} />
    </Tabs>
  );
}
