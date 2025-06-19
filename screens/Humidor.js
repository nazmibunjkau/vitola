import React, { useState } from 'react'
import { View, SafeAreaView, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import { useTheme } from '../context/ThemeContext'

export default function Sessions() {
  const navigation = useNavigation()
  const { theme } = useTheme()
  const [humidor, setHumidor] = useState([])

  const renderHumidor = ({ item }) => (
    <View style={[styles.sessionCard, { backgroundColor: theme.accent }]}>
      <Text style={[styles.sessionTitle, { color: theme.text }]}>{item.title}</Text>
      {/* Add more info as needed */}
    </View>
  )

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {humidor.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: theme.placeholder }]}>
            No humidors created yet. Tap + to add one!
          </Text>
        </View>
      ) : (
        <FlatList
          data={humidor}
          keyExtractor={(item, index) => index.toString()}
          renderItem={renderHumidor}
        />
      )}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: theme.primary }]}
        onPress={() => navigation.navigate('HumidorAdditions')}
      >
        <Ionicons name="add" size={32} color={theme.iconOnPrimary} />
      </TouchableOpacity>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontStyle: 'italic',
  },
  sessionCard: {
    padding: 16,
    margin: 12,
    borderRadius: 12,
    elevation: 2,
  },
  sessionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    borderRadius: 30,
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
  },
})