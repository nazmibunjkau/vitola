import { StyleSheet, SafeAreaView, Switch, Text, TouchableOpacity } from 'react-native';
import React from 'react';
import { ArrowLeftIcon } from 'react-native-heroicons/solid';
import { useTheme } from '../context/ThemeContext';

export default function Appearance({ navigation }) {
  const { theme, toggleTheme, isDarkMode } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
        <ArrowLeftIcon color={theme.text} size={30} />
      </TouchableOpacity>
      <Text style={[styles.text, { color: theme.text }]}>Toggle Theme</Text>
      <Switch
        value={isDarkMode}
        onValueChange={toggleTheme}
        thumbColor={isDarkMode ? theme.primary : '#ccc'}
        trackColor={{ false: '#767577', true: '#a0896f' }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 50,
  },
  backButton: {
    marginTop: 70,
    marginLeft: 10,
    position: 'absolute',
    top: 10,
    left: 10,
    zIndex: 10,
  },
  text: {
    fontSize: 20,
    marginBottom: 20,
  }
});