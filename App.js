import { createStackNavigator } from '@react-navigation/stack';
import { NavigationContainer } from '@react-navigation/native';
import Start from './screens/Start'
import Home from './screens/Home'
import Register from './screens/Register'
import Login from './screens/Login'
import TermsAndConditions from './screens/TermsAndConditions'

const Stack = createStackNavigator()

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName = 'Start'>
          <Stack.Screen
            name='Start'
            component={Start}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name='Register'
            component={Register}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name='Login'
            component={Login}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name='Home'
            component={Home}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name='TermsAndConditions'
            component={TermsAndConditions}
            options={{ headerShown: false }}
          />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
