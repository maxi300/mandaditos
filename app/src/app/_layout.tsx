import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { CartProvider } from '@/state/cart';
import { Push } from '@/state/push';
import { SessionProvider, useSession } from '@/state/session';
import { color } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

function Navegacion() {
  const { cargando } = useSession();
  useEffect(() => {
    if (!cargando) SplashScreen.hideAsync().catch(() => {});
  }, [cargando]);
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.bg }, animation: 'slide_from_right' }}>
      <Stack.Screen name="producto/[id]" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <CartProvider>
          <StatusBar style="dark" />
          <Navegacion />
          <Push />
        </CartProvider>
      </SessionProvider>
    </SafeAreaProvider>
  );
}
