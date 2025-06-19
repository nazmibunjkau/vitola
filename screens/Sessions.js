import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Modal,
  Image,
  TouchableWithoutFeedback
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { ArrowLeftIcon } from "react-native-heroicons/solid"
import { useNavigation } from '@react-navigation/native'
import { useTheme } from '../context/ThemeContext'
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';

const cigarTypes = ['Robusto', 'Toro', 'Churchill', 'Torpedo', 'Gordo']
const sessionFeelings = ['Relaxing', 'Social', 'Celebratory', 'Reflective', 'Routine']

export default function SessionAdditions() {
  const navigation = useNavigation()
  const { theme } = useTheme()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [typeModalVisible, setTypeModalVisible] = useState(false)
  const [feelingModalVisible, setFeelingModalVisible] = useState(false)
  const [media, setMedia] = useState(null);

  const [cigarType, setCigarType] = useState('')
  const [sessionFeeling, setSessionFeeling] = useState('')
  const [privateNotes, setPrivateNotes] = useState('')
  const [gearUsed, setGearUsed] = useState('')
  const [drinkPairing, setDrinkPairing] = useState('')

  const handleSave = () => {
    // Save logic here
    navigation.goBack()
  }

  const handleDiscard = () => {
    navigation.goBack()
  }

  const handlePickMedia = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      alert('Sorry, we need media library permissions to make this work!');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled) {
      setMedia(result.assets[0].uri);
      console.log('Selected media:', result.assets[0].uri);
    }
  };

  const borderColorValue = theme.primary;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={[styles.header, { borderBottomColor: borderColorValue }]}>
            <Text style={[styles.headerTitle, { color: theme.text }]}>Save Session</Text>
          </View>
          <TextInput
            style={[styles.titleInput, { borderColor: borderColorValue, backgroundColor: theme.inputBackground, color: theme.text }]}
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Afternoon Smoke on Patio"
            placeholderTextColor={theme.placeholder}
          />

          <TextInput
            style={[styles.descriptionInput, { borderColor: borderColorValue, backgroundColor: theme.inputBackground, color: theme.text }]}
            value={description}
            onChangeText={setDescription}
            placeholder="Add a description"
            multiline
            placeholderTextColor={theme.placeholder}
          />

          <TouchableOpacity style={[styles.mediaBox, { borderColor: theme.primary }]} onPress={handlePickMedia}>
            {media ? (
              <Image
                source={{ uri: media }}
                style={{ width: '100%', height: '100%', borderRadius: 8 }}
                resizeMode="cover"
              />
            ) : (
              <Text style={[styles.mediaText, { color: theme.text }]}>+ Add Photos / Video</Text>
            )}
          </TouchableOpacity>

          <Text style={[styles.sectionHeader, { color: theme.text }]}>Details</Text>

          <TouchableOpacity style={[styles.selector, { borderColor: borderColorValue }]} onPress={() => setTypeModalVisible(true)}>
            <View style={styles.selectorRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="leaf-outline" size={18} color={theme.placeholder} style={styles.selectorIcon} />
                <Text style={[
                    styles.selectorValue,
                    { color: cigarType ? theme.text : theme.placeholder, textAlign: 'left' }
                    ]}>
                    {cigarType || 'Cigar'}
                </Text>
              </View>
              <Ionicons name="chevron-down" size={18} color={theme.text} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.selector, { borderColor: borderColorValue }]} onPress={() => setFeelingModalVisible(true)}>
            <View style={styles.selectorRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center'}}>
                <Ionicons name="happy-outline" size={18} color={theme.placeholder} style={styles.selectorIcon} />
                <Text style={[
                  styles.selectorValue,
                  { color: sessionFeeling ? theme.text : theme.placeholder, textAlign: 'left' }
                ]}>{sessionFeeling || 'Session Feel'}</Text>
              </View>
              <Ionicons name="chevron-down" size={18} color={theme.text} />
            </View>
          </TouchableOpacity>

          <Text style={[styles.selectorLabel, { color: theme.text }]}>Private Notes</Text>
          <TextInput
            style={[styles.notesInput, { borderColor: borderColorValue, backgroundColor: theme.inputBackground, color: theme.text }]}
            value={privateNotes}
            onChangeText={setPrivateNotes}
            placeholder="Any private notes"
            multiline
            placeholderTextColor={theme.placeholder}
          />

          <Text style={[styles.selectorLabel, { color: theme.text }]}>Accessories / Gear Used</Text>
          <TextInput
            style={[styles.gearInput, { borderColor: borderColorValue, backgroundColor: theme.inputBackground, color: theme.text }]}
            value={gearUsed}
            onChangeText={setGearUsed}
            placeholder="e.g. Lighter, Cutter, Ashtray"
            placeholderTextColor={theme.placeholder}
          />
          <Text style={[styles.selectorLabel, { color: theme.text }]}>Drink Pairing</Text>
          <TextInput
            style={[styles.gearInput, { borderColor: borderColorValue, backgroundColor: theme.inputBackground, color: theme.text }]}
            value={drinkPairing}
            onChangeText={setDrinkPairing}
            placeholder="e.g. Whiskey, Coffee, Water"
            placeholderTextColor={theme.placeholder}
          />

          <TouchableOpacity onPress={handleDiscard} style={styles.discardButton}>
            <Text style={[styles.discardText, { color: theme.primary }]}>Discard Session</Text>
          </TouchableOpacity>

          {/* Spacer so content doesn't get hidden under fixed button */}
          <View style={{ height: 80 }} />

          {/* Modals */}
          <Modal visible={typeModalVisible} animationType="slide" transparent>
            <TouchableWithoutFeedback onPress={() => setTypeModalVisible(false)}>
              <View style={styles.modalOverlay}>
                <TouchableWithoutFeedback>
                  <View style={[styles.bottomSheet, { backgroundColor: theme.background }]}>
                      <Text style={[styles.bottomSheetTitle, { color: theme.text }]}>Choose Cigar Type</Text>
                      {cigarTypes.map((item) => (
                      <TouchableOpacity
                          key={item}
                          style={styles.optionRow}
                          onPress={() => {
                            if (item === cigarType) {
                              setCigarType('')
                            } else {
                              setCigarType(item)
                            }
                            setTypeModalVisible(false)
                          }}
                      >
                          <Ionicons
                          name={item === cigarType ? 'radio-button-on' : 'radio-button-off'}
                          size={20}
                          color={theme.primary}
                          style={{ marginRight: 10 }}
                          />
                          <Text style={[styles.modalText, { color: theme.text }]}>{item}</Text>
                      </TouchableOpacity>
                      ))}
                  </View>
                </TouchableWithoutFeedback>
              </View>
            </TouchableWithoutFeedback>
          </Modal>

          <Modal visible={feelingModalVisible} animationType="slide" transparent>
            <TouchableWithoutFeedback onPress={() => setFeelingModalVisible(false)}>
              <View style={styles.modalOverlay}>
                <TouchableWithoutFeedback>
                  <View style={[styles.bottomSheet, { backgroundColor: theme.background }]}>
                    <Text style={[styles.bottomSheetTitle, { color: theme.text }]}>Choose Session Feel</Text>
                    {sessionFeelings.map((item) => (
                      <TouchableOpacity
                        key={item}
                        style={styles.optionRow}
                        onPress={() => {
                          if (item === sessionFeeling) {
                            setSessionFeeling('')
                          } else {
                            setSessionFeeling(item)
                          }
                          setFeelingModalVisible(false)
                        }}
                      >
                        <Ionicons
                          name={item === sessionFeeling ? 'radio-button-on' : 'radio-button-off'}
                          size={20}
                          color={theme.primary}
                          style={{ marginRight: 10 }}
                        />
                        <Text style={[styles.modalText, { color: theme.text }]}>{item}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </TouchableWithoutFeedback>
              </View>
            </TouchableWithoutFeedback>
          </Modal>
        </ScrollView>
        <View style={[styles.fixedBottomButton, { backgroundColor: theme.background, borderTopColor: theme.placeholder }]}>
          <TouchableOpacity style={[styles.saveButton, { backgroundColor: theme.primary }]} onPress={handleSave}>
            <Text style={[styles.saveText, { color: theme.background }]}>Save Session</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  titleInput: {
    fontSize: 16,
    fontWeight: '600',
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 12,
    padding: 12,
  },
  descriptionInput: {
    fontSize: 16,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 20,
    padding: 12,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  notesInput: {
    fontSize: 16,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 24,
    padding: 12,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  gearInput: {
    fontSize: 16,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 24,
    padding: 12,
    textAlignVertical: 'top',
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 12,
  },
  selector: {
    marginBottom: 20,
    height: 48,
    borderWidth: 1,
    borderRadius: 8,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  selectorLabel: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
    marginTop: 4,
    textAlignVertical: 'center',
  },
  selectorValue: {
    fontSize: 16,
    textAlign: 'center',
  },
  discardButton: {
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 24,
  },
  discardText: {
    fontSize: 16,
  },
  saveButton: {
    paddingVertical: 14,
    marginTop: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
    padding: 20,
  },
  modalItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  modalText: {
    fontSize: 16,
  },
  mediaBox: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 8,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  mediaText: {
    fontSize: 14,
    fontWeight: '500',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 17,
  },
  backButton: {
    position: 'absolute',
    left: 0,
  },
  leftArrow: {
    marginLeft: -2,
    marginTop: -6,
 },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  selectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectorIcon: {
    marginRight: 6,
    textAlignVertical: 'center',
  },
  fixedBottomButton: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: 10,
    borderTopWidth: 1,
  },
  bottomSheet: {
  position: 'absolute',
  bottom: 0,
  left: 0,
  right: 0,
  borderTopLeftRadius: 16,
  borderTopRightRadius: 16,
  padding: 20,
  maxHeight: '50%',
    },
    bottomSheetTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    },
    optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    },
    modalOverlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0,0,0,0.1)',
    },
})