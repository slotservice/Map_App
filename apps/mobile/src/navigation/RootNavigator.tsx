import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '../lib/auth';
import { SignInScreen } from '../screens/SignInScreen';
import { DrawerNavigator } from './DrawerNavigator';
import { StoreDetailScreen } from '../screens/StoreDetailScreen';
import { AddPhotosScreen } from '../screens/AddPhotosScreen';
import { TagAlertScreen } from '../screens/TagAlertScreen';
import { CheckSignScreen } from '../screens/CheckSignScreen';
import { MapViewScreen } from '../screens/MapViewScreen';

export type RootStackParamList = {
  SignIn: undefined;
  Main: undefined;
  MapView: { mapId: string };
  StoreDetail: { storeId: string };
  AddPhotos: { storeId: string };
  TagAlert: { storeId: string };
  CheckSign: { storeId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const hasToken = useAuthStore((s) => s.hasToken);

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!hasToken ? (
        <Stack.Screen name="SignIn" component={SignInScreen} />
      ) : (
        <>
          <Stack.Screen name="Main" component={DrawerNavigator} />
          <Stack.Screen
            name="MapView"
            component={MapViewScreen}
            options={{ headerShown: true, title: '' }}
          />
          <Stack.Screen
            name="StoreDetail"
            component={StoreDetailScreen}
            options={{ presentation: 'modal' }}
          />
          <Stack.Screen
            name="AddPhotos"
            component={AddPhotosScreen}
            options={{ headerShown: true, title: 'Add Photos' }}
          />
          <Stack.Screen
            name="TagAlert"
            component={TagAlertScreen}
            options={{ headerShown: true, title: 'Tag Alert' }}
          />
          <Stack.Screen
            name="CheckSign"
            component={CheckSignScreen}
            options={{ headerShown: true, title: 'Check and Verification' }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}
