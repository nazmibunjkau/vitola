import React from "react";
import { StyleSheet, Image, View } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import Home from "../screens/Home";
import Humidor from "../screens/Humidor";
import Scanner from "../screens/Scanner";
import Sessions from "../screens/Sessions";
import Profile from "../screens/Profile";
import { useRoute } from "@react-navigation/native";
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

const Tab = createBottomTabNavigator();

export default function BottomTabs() {
  const route = useRoute();
  const user = route.params?.user;
  const { theme } = useTheme();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: theme.background,
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={Home}
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={styles.icon}>
              <Ionicons
                name={focused ? 'home' : 'home-outline'}
                size={24}
                color={theme.primary}
              />
              {focused && <View style={[styles.dot, { backgroundColor: theme.primary }]} />}
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="Humidor"
        component={Humidor}
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={styles.icon}>
              <Ionicons
                name={focused ? 'archive' : 'archive-outline'}
                size={24}
                color={theme.primary}
              />
              {focused && <View style={[styles.dot, { backgroundColor: theme.primary }]} />}
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="Scanner"
        component={Scanner}
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={styles.icon}>
              <Ionicons
                name={focused ? 'scan' : 'scan-outline'}
                size={24}
                color={theme.primary}
              />
              {focused && <View style={[styles.dot, { backgroundColor: theme.primary }]} />}
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="Sessions"
        component={Sessions}
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={styles.icon}>
              <Ionicons
                name={focused ? 'flame' : 'flame-outline'}
                size={24}
                color={theme.primary}
              />
              {focused && <View style={[styles.dot, { backgroundColor: theme.primary }]} />}
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={Profile}
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={styles.icon}>
              <Ionicons
                name={focused ? 'person' : 'person-outline'}
                size={24}
                color={theme.primary}
              />
              {focused && <View style={[styles.dot, { backgroundColor: theme.primary }]} />}
            </View>
          ),
        }}
      />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  icon: {
    alignItems: 'center',
    marginTop: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#4b382a",
    marginTop: 5,
  },
});