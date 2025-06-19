import { StyleSheet, Text, SafeAreaView, View, TouchableOpacity, Modal, TextInput, Button } from 'react-native'
import React, { useState } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'

export default function HumidorAdditions() {
  const [modalVisible, setModalVisible] = useState(false)
  const [step, setStep] = useState(0)
  const [humidorName, setHumidorName] = useState('')
  const [searchVisible, setSearchVisible] = useState(false)
  const navigation = useNavigation && useNavigation()

  const handlePlusPress = () => {
    setStep(1)
    setModalVisible(true)
  }

  const handleNext = () => {
    if (step === 1) {
      setStep(2)
    }
  }

  const handleSelectSearch = () => {
    setStep(3)
    setSearchVisible(true)
  }

  const handleSelectScan = () => {
    setModalVisible(false)
    if (navigation && navigation.navigate) {
      navigation.navigate('Scanner')
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Humidor Additions</Text>

      <TouchableOpacity style={styles.fab} onPress={handlePlusPress}>
        <Ionicons name="add" size={30} color="white" />
      </TouchableOpacity>

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalContainer}>
          {step === 1 && (
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Enter Humidor Name</Text>
              <TextInput
                placeholder="e.g., My Desktop Humidor"
                value={humidorName}
                onChangeText={setHumidorName}
                style={styles.input}
              />
              <Button title="Next" onPress={handleNext} />
            </View>
          )}
          {step === 2 && (
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Add a Cigar</Text>
              <Button title="Search" onPress={handleSelectSearch} />
              <View style={{ height: 10 }} />
              <Button title="Scan Barcode" onPress={handleSelectScan} />
            </View>
          )}
          {step === 3 && searchVisible && (
            <View style={styles.modalContent}>
              <TextInput placeholder="Search for a cigar..." style={styles.input} />
              <Button title="Cancel" onPress={() => setModalVisible(false)} />
            </View>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f9f6f2' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 16, color: '#6e4c1e' },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: '#6e4c1e',
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)'
  },
  modalContent: {
    backgroundColor: 'white',
    margin: 20,
    borderRadius: 12,
    padding: 20,
    elevation: 5
  },
  modalTitle: {
    fontSize: 20,
    marginBottom: 12,
    color: '#6e4c1e',
    fontWeight: '600'
  },
  input: {
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 12,
    fontSize: 16
  }
})