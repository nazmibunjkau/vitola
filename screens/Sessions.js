import React, { useState, useEffect } from 'react'
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
  Keyboard,
  TouchableWithoutFeedback,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import { useTheme } from '../context/ThemeContext'
import * as ImagePicker from 'expo-image-picker';
import { collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { getAuth } from 'firebase/auth';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import Autocomplete from 'react-native-autocomplete-input';
import cities from '../assets/cities.json';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

const sessionFeelings = ['Relaxing', 'Social', 'Celebratory', 'Reflective', 'Routine']

export default function SessionAdditions() {
  const navigation = useNavigation()
  const { theme } = useTheme()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [typeModalVisible, setTypeModalVisible] = useState(false)
  const [feelingModalVisible, setFeelingModalVisible] = useState(false)
  const [media, setMedia] = useState(null);
  const [mediaSize, setMediaSize] = useState({ width: 0, height: 0 });
  const [locationQuery, setLocationQuery] = useState('');
  const [filteredCities, setFilteredCities] = useState([]);
  const [selectedCity, setSelectedCity] = useState('');

  const [cigarType, setCigarType] = useState('')
  const [sessionFeeling, setSessionFeeling] = useState('')
  const [privateNotes, setPrivateNotes] = useState('')
  const [gearUsed, setGearUsed] = useState('')
  const [drinkPairing, setDrinkPairing] = useState('')

  // Humidor state
  const [humidors, setHumidors] = useState([]);
  const [selectedHumidor, setSelectedHumidor] = useState(null);
  const [humidorModalVisible, setHumidorModalVisible] = useState(false);
  // Cigars in selected humidor
  const [humidorCigars, setHumidorCigars] = useState([]);

  useEffect(() => {
    const fetchHumidors = async () => {
      try {
        const auth = getAuth();
        const userId = auth.currentUser?.uid;
        if (!userId) {
          console.warn('User is not logged in');
          return;
        }
        const humidorsRef = collection(db, 'users', userId, 'humidors');
        const snapshot = await getDocs(humidorsRef);
        const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setHumidors(list);
      } catch (error) {
        console.error('Failed to fetch humidors:', error);
      }
    };
    fetchHumidors();
  }, []);

  const handleCitySearch = (text) => {
    setLocationQuery(text);
    const results = cities.filter(city =>
      city.name.toLowerCase().startsWith(text.toLowerCase())
    ).slice(0, 10); // limit suggestions
    setFilteredCities(results);
  };

  const handleSave = async () => {
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) {
        alert('User not logged in');
        return;
      }

      const activity = {
        user_id: user.uid,
        user_name: user.displayName || '',
        user_email: user.email,
        date: serverTimestamp(),
        likes: [],
        comments: [],
        title,
        description,
        humidor: selectedHumidor?.title || '',
        humidor_id: selectedHumidor?.id || '',
        cigar: cigarType,
        sessionFeeling,
        privateNotes,
        gearUsed,
        drinkPairing,
        media: media || null,
        location: selectedCity || locationQuery || '',
      };

      const docRef = await addDoc(collection(db, 'user_activities'), activity);

      // Clear fields after save
      setTitle('');
      setDescription('');
      setMedia(null);
      setMediaSize({ width: 0, height: 0 });
      setCigarType('');
      setSessionFeeling('');
      setPrivateNotes('');
      setGearUsed('');
      setDrinkPairing('');
      setSelectedHumidor(null);
      setHumidorCigars([]);
      setTypeModalVisible(false);
      setFeelingModalVisible(false);
      setLocationQuery('');
      setSelectedCity('');
      setFilteredCities([]);

      // Optionally navigate back:
      navigation.goBack();

    } catch (error) {
      console.error('Error saving activity:', error);
      alert('Failed to save activity. Please try again.');
    }
  };

  const handleDiscard = () => {
    setTitle('');
    setDescription('');
    setMedia(null);
    setMediaSize({ width: 0, height: 0 });
    setCigarType('');
    setSessionFeeling('');
    setPrivateNotes('');
    setGearUsed('');
    setDrinkPairing('');
    setSelectedHumidor(null);
    setHumidorCigars([]);
    setTypeModalVisible(false);
    setFeelingModalVisible(false);
    setLocationQuery('');      
    setSelectedCity('');       
    setFilteredCities([]);     
    navigation.goBack();
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
      const uri = result.assets[0].uri;

      // Clear media first to force re-render if same URI is selected again
      setMedia(null);

      // Small delay to ensure state updates before setting new URI
      setTimeout(() => {
        setMedia(uri);
        Image.getSize(uri, (width, height) => {
          setMediaSize({ width, height });
        }, error => {
          console.error("Error getting image size:", error);
          setMediaSize({ width: 0, height: 0 }); // fallback
        });
        console.log('Selected media:', uri);
      }, 50);
    }
  };

  const borderColorValue = theme.primary;
  const screenWidth = 320; // or use Dimensions.get('window').width - padding
  const imageAspectRatio = mediaSize.width && mediaSize.height ? mediaSize.height / mediaSize.width : 0.75;
  const mediaBoxHeight = screenWidth * imageAspectRatio;

  // For dynamic modal height
  const screenHeight = Dimensions.get('window').height;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
          <KeyboardAwareScrollView
            contentContainerStyle={{ flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
            extraScrollHeight={60} // adjust as needed
          >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View style={[styles.content, { flex: 1 }]}>
            <View style={[styles.header, { borderBottomColor: borderColorValue }]}>
              <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                <Ionicons name="arrow-back" size={30} color={theme.text} style={styles.leftArrow} />
              </TouchableOpacity>
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

            <TouchableOpacity
              style={[
                styles.mediaBox,
                {
                  borderColor: theme.primary,
                  height: media ? mediaBoxHeight : styles.mediaBox.height
                }
              ]}
              onPress={handlePickMedia}
            >
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

            {/* Humidor Selector */}
            <TouchableOpacity
              style={[styles.selector, { borderColor: borderColorValue }]}
              onPress={() => setHumidorModalVisible(true)}
            >
              <View style={styles.selectorRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="cube-outline" size={18} color={theme.placeholder} style={styles.selectorIcon} />
                  <Text
                    style={[
                      styles.selectorValue,
                      { color: selectedHumidor ? theme.text : theme.placeholder, textAlign: 'left' },
                    ]}
                  >
                    {selectedHumidor?.title || 'Select Humidor'}
                  </Text>
                </View>
                <Ionicons name="chevron-down" size={18} color={theme.text} />
              </View>
            </TouchableOpacity>

            {/* Cigar Selector */}
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

            <View
              style={[
                styles.selector,
                {
                  borderColor: borderColorValue,
                  paddingVertical: 2,
                  backgroundColor: 'transparent',
                },
              ]}
            >
              <View style={[styles.selectorRow, { alignItems: 'flex-start' }]}>
                <Ionicons
                  name="location-outline"
                  size={18}
                  color={theme.placeholder}
                  style={[styles.selectorIcon, { marginTop: 0 }]}
                />

                <View style={{ flex: 1, marginTop: -12 }}>
                  <Autocomplete
                    autoCapitalize="none"
                    autoCorrect={false}
                    inputContainerStyle={{
                      borderWidth: 0,
                      backgroundColor: 'transparent',
                      padding: 0,
                    }}
                    listContainerStyle={{
                      backgroundColor: theme.inputBackground,
                      borderRadius: 8,
                      marginTop: 6,
                      maxHeight: 120,
                      elevation: 4,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.15,
                      shadowRadius: 4,
                    }}
                    containerStyle={{
                      flex: 1,
                      backgroundColor: 'transparent',
                    }}
                    style={{
                      color: theme.text,
                      paddingVertical: 6,
                      fontSize: 14,
                      backgroundColor: 'transparent',
                    }}
                    data={filteredCities}
                    defaultValue={locationQuery}
                    onChangeText={(text) => {
                      handleCitySearch(text);
                      if (!text) setFilteredCities([]);
                    }}
                    placeholder="Type a city"
                    placeholderTextColor={theme.placeholder}
                    flatListProps={{
                      keyboardShouldPersistTaps: 'handled',
                      keyExtractor: (_, idx) => idx.toString(),
                      renderItem: ({ item }) => (
                        <TouchableOpacity
                          onPress={() => {
                            setLocationQuery(item.name);
                            setSelectedCity(item.name);
                            setFilteredCities([]);
                          }}
                          style={{
                            paddingVertical: 8,
                            paddingHorizontal: 12,
                          }}
                        >
                          <Text style={{ color: theme.text }}>{item.name}</Text>
                        </TouchableOpacity>
                      ),
                    }}
                  />
                </View>

                <Ionicons name="chevron-down" size={18} color={theme.text} style={{ alignSelf: 'center', marginLeft: 6 }} />

                {!!locationQuery && (
                  <TouchableOpacity
                    onPress={() => {
                      setLocationQuery('');
                      setSelectedCity('');
                      setFilteredCities([]);
                    }}
                    style={{ marginLeft: 6, justifyContent: 'center', alignItems: 'center', alignSelf: 'center' }}
                  >
                    <Ionicons name="close-circle" size={18} color={theme.placeholder} />
                  </TouchableOpacity>
                )}
              </View>
            </View>

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
              <Text style={[styles.discardText, { color: theme.primary }]}>Discard Activity</Text>
            </TouchableOpacity>
                    
            {/* Spacer so content doesn't get hidden under fixed button */}
            <View style={{ height: 20 }} />

            {/* Modals */}
            {/* Humidor Modal */}
            <Modal visible={humidorModalVisible} animationType="slide" transparent>
              <TouchableWithoutFeedback onPress={() => setHumidorModalVisible(false)}>
                <View style={styles.modalOverlay}>
                  <TouchableWithoutFeedback>
                    <View
                      style={[
                        styles.bottomSheet,
                        {
                          backgroundColor: theme.background,
                          height: Math.min(Math.max(humidors.length * 130, 180), screenHeight * 0.8),
                        },
                      ]}
                    >
                      {/* Sliver bar for drag indicator */}
                      <View
                        style={{
                          width: 40,
                          height: 4,
                          backgroundColor: theme.placeholder,
                          borderRadius: 2,
                          alignSelf: 'center',
                          marginBottom: 12,
                        }}
                      />
                      <Text style={[styles.bottomSheetTitle, { color: theme.text }]}>Choose Humidor</Text>
                      {humidors.map(item => (
                        <TouchableOpacity
                          key={item.id}
                          style={styles.optionRow}
                          onPress={async () => {
                            setSelectedHumidor(item);
                            setHumidorModalVisible(false);
                            try {
                              const auth = getAuth();
                              const userId = auth.currentUser?.uid;
                              const cigarsRef = collection(db, 'users', userId, 'humidors', item.id, 'cigars');
                              const snapshot = await getDocs(cigarsRef);
                              const cigars = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                              setHumidorCigars(cigars);
                            } catch (error) {
                              console.error('Failed to fetch cigars for humidor:', error);
                            }
                          }}
                        >
                          <Ionicons
                            name={selectedHumidor?.id === item.id ? 'radio-button-on' : 'radio-button-off'}
                            size={28}
                            color={theme.primary}
                            style={{ marginRight: 10 }}
                          />
                          <Text style={[styles.modalText, { color: theme.text }]}>{item.title}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </TouchableWithoutFeedback>
                </View>
              </TouchableWithoutFeedback>
            </Modal>
            <Modal visible={typeModalVisible} animationType="slide" transparent>
              <TouchableWithoutFeedback onPress={() => setTypeModalVisible(false)}>
                <View style={styles.modalOverlay}>
                  <TouchableWithoutFeedback>
                    <View style={[styles.bottomSheet, { backgroundColor: theme.background }]}>
                        {/* Sliver bar for drag indicator */}
                        <View
                          style={{
                            width: 40,
                            height: 4,
                            backgroundColor: theme.placeholder,
                            borderRadius: 2,
                            alignSelf: 'center',
                            marginBottom: 12,
                          }}
                        />
                        <Text style={[styles.bottomSheetTitle, { color: theme.text }]}>Choose Cigar Type</Text>
                        {!selectedHumidor ? (
                          <Text style={{ color: theme.placeholder, fontSize: 16, textAlign: 'center', paddingVertical: 20 }}>
                            Please select a humidor first
                          </Text>
                        ) : humidorCigars.length === 0 ? (
                          <Text style={{ color: theme.placeholder, fontSize: 16, textAlign: 'center', paddingVertical: 20 }}>
                            No cigars found in this humidor
                          </Text>
                        ) : (
                          humidorCigars.map((item) => (
                            <TouchableOpacity
                              key={item.id}
                              style={styles.optionRow}
                              onPress={() => {
                                if (item.name === cigarType) {
                                  setCigarType('');
                                } else {
                                  setCigarType(item.name);
                                }
                                setTypeModalVisible(false);
                              }}
                            >
                              <Ionicons
                                name={item.name === cigarType ? 'radio-button-on' : 'radio-button-off'}
                                size={20}
                                color={theme.primary}
                                style={{ marginRight: 10 }}
                              />
                              <Text style={[styles.modalText, { color: theme.text }]}>{item.name}</Text>
                            </TouchableOpacity>
                          ))
                        )}
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
                      {/* Sliver bar for drag indicator */}
                      <View
                        style={{
                          width: 40,
                          height: 4,
                          backgroundColor: theme.placeholder,
                          borderRadius: 2,
                          alignSelf: 'center',
                          marginBottom: 12,
                        }}
                      />
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
              </View>
            </TouchableWithoutFeedback>
          </KeyboardAwareScrollView>
          <View style={[styles.fixedBottomButton, { backgroundColor: theme.background, borderTopColor: theme.placeholder }]}>
            <TouchableOpacity style={[styles.saveButton, { backgroundColor: theme.primary }]} onPress={handleSave}>
              <Text style={[styles.saveText, { color: theme.background }]}>Save Activity</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
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
    fontWeight: '700',
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
    fontWeight: '700',
    marginBottom: 14,
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
    fontSize: 18,
  },
  mediaBox: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 8,
    height: 200,
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
    paddingBottom: 20,
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
    height: 300
  },
  bottomSheetTitle: {
    fontSize: 20,
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