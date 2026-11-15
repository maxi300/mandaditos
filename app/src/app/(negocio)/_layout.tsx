import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router/js-tabs';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { color } from '@/theme';

export default function NegocioTabs() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: color.ink,
        tabBarInactiveTintColor: color.muted,
        tabBarStyle: { borderTopColor: '#EFEAE4', height: 60 + insets.bottom, paddingTop: 6, paddingBottom: Math.max(insets.bottom, 8) },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
        sceneStyle: { backgroundColor: color.bg },
      }}>
      <Tabs.Screen name="pedidos" options={{ title: 'Pedidos', tabBarIcon: ({ color: c, focused }) => <Ionicons name={focused ? 'notifications' : 'notifications-outline'} size={24} color={c as string} /> }} />
      <Tabs.Screen name="catalogo" options={{ title: 'Catálogo', tabBarIcon: ({ color: c, focused }) => <Ionicons name={focused ? 'pricetags' : 'pricetags-outline'} size={24} color={c as string} /> }} />
      <Tabs.Screen name="ajustes" options={{ title: 'Negocio', tabBarIcon: ({ color: c, focused }) => <Ionicons name={focused ? 'storefront' : 'storefront-outline'} size={24} color={c as string} /> }} />
    </Tabs>
  );
}
