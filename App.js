import { View, ActivityIndicator } from 'react-native'
import { createStackNavigator } from '@react-navigation/stack';
import { NavigationContainer } from '@react-navigation/native';
import Start from './screens/Start'
import Home from './screens/Home'
import Register from './screens/Register'
import Login from './screens/Login'
import TermsAndConditions from './screens/TermsAndConditions'
import useAuth from './hooks/useAuth';

const Stack = createStackNavigator()

export default function App() {
  const { user, loading } = useAuth();
  console.log("User:", user)

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#4b382a" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <>
            <Stack.Screen name='Home' component={Home} />
            <Stack.Screen name='TermsAndConditions' component={TermsAndConditions} />
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
