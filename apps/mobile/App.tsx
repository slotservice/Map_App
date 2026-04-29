import 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NavigationContainer } from '@react-navigation/native';
import { useEffect, useState } from 'react';

import { RootNavigator } from './src/navigation/RootNavigator';
import { useAuthStore } from './src/lib/auth';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

export default function App() {
  const hydrate = useAuthStore((s) => s.hydrate);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    hydrate().finally(() => setReady(true));
  }, [hydrate]);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
      </QueryClientProvider>
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}
