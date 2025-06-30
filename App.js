import React from 'react';
import { StatusBar } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from './src/screens/HomeScreen';
import HistoryScreen from './src/screens/HistoryScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#121212" />
      <NavigationContainer theme={DarkTheme}>
        <Stack.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: '#121212' },
            headerTintColor: '#fff',
          }}
        >
          <Stack.Screen name="Home" component={HomeScreen}  options={{ headerShown: false }} />
          <Stack.Screen name="History" component={HistoryScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </>
  );
}
