import { createDrawerNavigator } from '@react-navigation/drawer';
import { MapsScreen } from '../screens/MapsScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { ChangePasswordScreen } from '../screens/ChangePasswordScreen';

export type DrawerParamList = {
  Maps: undefined;
  Profile: undefined;
  'Change Password': undefined;
};

const Drawer = createDrawerNavigator<DrawerParamList>();

export function DrawerNavigator() {
  return (
    <Drawer.Navigator initialRouteName="Maps">
      <Drawer.Screen name="Maps" component={MapsScreen} />
      <Drawer.Screen name="Profile" component={ProfileScreen} />
      <Drawer.Screen name="Change Password" component={ChangePasswordScreen} />
    </Drawer.Navigator>
  );
}
