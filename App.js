import { createStackNavigator } from '@react-navigation/stack';
import { NavigationContainer } from '@react-navigation/native';
import Start from './screens/Start'

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
      </Stack.Navigator>
    </NavigationContainer>
  );
}
