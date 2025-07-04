import { View, ActivityIndicator } from 'react-native'
import { createStackNavigator } from '@react-navigation/stack';
import { NavigationContainer } from '@react-navigation/native';
import Start from './screens/Start'
import Home from './screens/Home'
import Register from './screens/Register'
import Login from './screens/Login'
import TermsAndConditions from './components/TermsAndConditions'
import BottomTabs from './navigation/BottomTabs';
import useAuth from './hooks/useAuth';
import AccountInfo from './components/AccountInfo';
import Notifications from './components/Notifications';
import Appearance from './components/Appearance';
import DataUsage from './components/DataUsage';
import Security from './components/Security';
import Privacy from './components/Privacy';
import Support from './components/Support';
import FAQ from './components/FAQ';
import HumidorAddition from './utils/HumidorAdditions';
import NavigationScreen from './utils/NotificationScreen';
import { ThemeProvider, useTheme } from './context/ThemeContext';

const Stack = createStackNavigator()

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#4b382a" />
      </View>
    );
  }

  return (
    <ThemeProvider>
      <ThemeConsumer />
    </ThemeProvider>
  );
}

function ThemeConsumer() {
  const theme = useTheme(); // <-- now inside ThemeProvider
  const { user } = useAuth();

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <>
            <Stack.Screen name="MainApp" component={BottomTabs} />
            <Stack.Screen name="AccountInfo" component={AccountInfo} />
            <Stack.Screen name="Notifications" component={Notifications} />
            <Stack.Screen name="Appearance" component={Appearance} />
            <Stack.Screen name="DataUsage" component={DataUsage} />
            <Stack.Screen name="Security" component={Security} />
            <Stack.Screen name="Privacy" component={Privacy} />
            <Stack.Screen name="Support" component={Support} />
            <Stack.Screen name="FAQ" component={FAQ} />
            <Stack.Screen name='TermsAndConditions' component={TermsAndConditions} />
            <Stack.Screen name='HumidorAdditions' component={HumidorAddition}/>
            <Stack.Screen name='NotificationScreen' component={NavigationScreen}/>
          </>
        ) : (
          <>
            <Stack.Screen name='Start' component={Start} />
            <Stack.Screen name='Register' component={Register} />
            <Stack.Screen name='Login' component={Login} />
            <Stack.Screen name='TermsAndConditions' component={TermsAndConditions} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
