import { StyleSheet, Text, SafeAreaView, View, TouchableOpacity, FlatList, TextInput, ScrollView, Image, Modal } from 'react-native';
import React, { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import * as ImagePicker from 'expo-image-picker';
import cities from '../assets/cities.json';
import { db } from '../config/firebase'; 
import { collection, addDoc, doc, setDoc, query, where, getDocs } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const CLUB_TYPES = [
  { id: '1', name: 'Business', icon: 'briefcase-outline' },
  { id: '2', name: 'Casual', icon: 'cafe-outline' },
  { id: '3', name: 'Lounge', icon: 'wine-outline' },
  { id: '4', name: 'Premium', icon: 'star-outline' },
  { id: '5', name: 'Social', icon: 'people-outline' },
];

const CLUB_TAGS = [
  'Brand/Organization', 'Local Community', 'Fundraising', 'Business',
  'Fun', 'Networking', 'Casual', 'High Value',
  'Relaxation', 'Celebratory', 'Event', 'Team',
  'Travel', 'Lounge', 'Exclusive', 'Social Impact'
];

const CLUB_PRIVACY_OPTIONS = [
  {
    id: 'public',
    name: 'Public',
    icon: 'globe-outline',
    description: 'Anyone can find and join your club.'
  },
  {
    id: 'private',
    name: 'Private',
    icon: 'lock-closed-outline',
    description: 'Only invited members can join your club.'
  },
];

export default function ClubAdditions({ navigation }) {
  const [selectedType, setSelectedType] = useState(null);
  const [activeStep, setActiveStep] = useState(1);
  const [selectedTags, setSelectedTags] = useState([]);
  const [clubName, setClubName] = useState('');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState(null);
  const [selectedPrivacy, setSelectedPrivacy] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [citySearchModalVisible, setCitySearchModalVisible] = useState(false);
  const [citySearchText, setCitySearchText] = useState('');
  const { theme } = useTheme();

  const renderClubType = ({ item }) => {
    const isSelected = selectedType === item.id;
    return (
      <TouchableOpacity
        style={[
          styles.clubTypeRow,
          { borderBottomColor: theme.border }
        ]}
        onPress={() => setSelectedType(item.id)}
      >
        <Ionicons name={item.icon} size={24} color={theme.text} style={{ marginLeft: 20 }} />
        <Text style={[styles.clubTypeText, { color: theme.text, marginLeft: 16 }]}>{item.name}</Text>
        <View
          style={[
            styles.circle,
            { borderColor: theme.primary },
            isSelected && { backgroundColor: theme.primary }
          ]}
        />
      </TouchableOpacity>
    );
  };

  const renderClubTag = ({ item }) => {
    const isSelected = selectedTags.includes(item);
    return (
      <TouchableOpacity
        style={[
          styles.clubTypeRow,
          { borderBottomColor: theme.border }
        ]}
        onPress={() => {
          setSelectedTags(prev =>
            prev.includes(item)
              ? prev.filter(tag => tag !== item)
              : prev.length < 4 ? [...prev, item] : prev
          );
        }}
      >
        <Ionicons
          name={
            item.includes('Business') ? 'briefcase-outline' :
            item.includes('Community') ? 'people-outline' :
            item.includes('Fun') ? 'happy-outline' :
            item.includes('Relaxation') ? 'cafe-outline' :
            item.includes('Networking') ? 'chatbox-ellipses-outline' :
            item.includes('Event') ? 'calendar-outline' :
            item.includes('Team') ? 'people-circle-outline' :
            item.includes('Fundraising') ? 'cash-outline' :
            item.includes('Travel') ? 'airplane-outline' :
            item.includes('Exclusive') ? 'lock-closed-outline' :
            item.includes('Celebratory') ? 'sparkles-outline' :
            item.includes('Lounge') ? 'wine-outline' :
            item.includes('Social') ? 'earth-outline' :
            'pricetag-outline'
          }
          size={24}
          color={theme.text}
          style={{ marginLeft: 20 }}
        />
        <Text style={[styles.clubTypeText, { color: theme.text, marginLeft: 16 }]}>{item}</Text>
        <View
          style={[
            styles.circle,
            { borderColor: theme.primary },
            isSelected && { backgroundColor: theme.primary }
          ]}
        />
      </TouchableOpacity>
    );
  };

  const renderPrivacyOption = ({ item }) => {
    const isSelected = selectedPrivacy === item.id;
    return (
      <TouchableOpacity
        style={[styles.clubTypeRow, { borderBottomColor: theme.border }]}
        onPress={() => setSelectedPrivacy(item.id)}
      >
        <Ionicons
          name={item.icon}
          size={24}
          color={theme.text}
          style={{ marginLeft: 20 }}
        />
        <View style={{ flex: 1, marginLeft: 16 }}>
          <Text style={[styles.clubTypeText, { color: theme.text }]}>{item.name}</Text>
          <Text style={{ fontSize: 12, color: theme.placeholder, marginTop: 4 }}>
            {item.description}
          </Text>
        </View>
        <View
          style={[
            styles.circle,
            { borderColor: theme.primary },
            isSelected && { backgroundColor: theme.primary }
          ]}
        />
      </TouchableOpacity>
    );
  };

  const renderLocation = ({ item }) => {
    const isSelected =
      (item.id === 'Everywhere' && selectedLocation === 'Everywhere') ||
      (item.id === 'search' && selectedLocation && selectedLocation !== 'Everywhere');

    return (
      <TouchableOpacity
        style={[styles.clubTypeRow, { borderBottomColor: theme.border }]}
        onPress={() => {
          if (item.id === 'search') {
            setCitySearchModalVisible(true);
          } else {
            setSelectedLocation(item.id);
          }
        }}
      >
        <Ionicons name={item.icon} size={24} color={theme.text} style={{ marginLeft: 20 }} />
        <Text style={[styles.clubTypeText, { color: theme.text, marginLeft: 16 }]}>
          {item.id === 'search' && selectedLocation && selectedLocation !== 'Everywhere'
            ? selectedLocation
            : item.name}
        </Text>
        <View
          style={[
            styles.circle,
            { borderColor: theme.primary },
            isSelected && { backgroundColor: theme.primary }
          ]}
        />
      </TouchableOpacity>
    );
  };

  return (
    <>
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Top Row with Back and X */}
      <View style={[styles.topRow, { paddingTop: 8, paddingHorizontal: 16 }]}>
        <TouchableOpacity
          style={[styles.closeButton, { backgroundColor: theme.primary }]}
          onPress={() => setActiveStep((prev) => Math.max(prev - 1, 1))}
        >
          <Ionicons name="arrow-back" size={20} color={theme.iconOnPrimary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.closeButton, { backgroundColor: theme.primary }]}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="close" size={27} color={theme.iconOnPrimary} />
        </TouchableOpacity>
      </View>

      {/* Step Progress Bar */}
      <View style={styles.progressBar}>
        {[1, 2, 3, 4, 5].map((step) => (
          <View
            key={step}
            style={[
              styles.stepBar,
              { backgroundColor: step === activeStep ? theme.primary : theme.accent }
            ]}
          />
        ))}
      </View>

      {/* Header Section */}
      <Text style={[styles.header, { color: theme.text }]}>
        {activeStep === 1
          ? "Choose your club's type"
          : activeStep === 2
          ? "Describe your club"
          : activeStep === 3
          ? "Create your club"
          : activeStep === 4
          ? "Choose the privacy for your club"
          : "Choose a location for your club"}
      </Text>
      <Text style={[styles.subtext, { color: theme.placeholder }]}>
        {activeStep === 1
          ? "Create a general club or be specific with one type"
          : activeStep === 2
          ? "Pick up to 4 tags that best fit for your club. This will help others know more about your club"
          : activeStep === 3
          ? "Customize your club's name, image, and mission"
          : activeStep === 5
          ? "If your club does not have a set location, choose \"Everywhere\""
          : ""}
      </Text>

      {/* Club Type List or Tag List or Privacy Options or Location */}
      {activeStep === 1 && (
        <FlatList
          data={CLUB_TYPES}
          renderItem={renderClubType}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingVertical: 20 }}
        />
      )}
      {activeStep === 2 && (
        <FlatList
          data={CLUB_TAGS}
          renderItem={renderClubTag}
          keyExtractor={(item, index) => `${item}_${index}`}
          contentContainerStyle={{ paddingVertical: 20 }}
        />
      )}
      {activeStep === 3 && (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 20 }}>
          <TouchableOpacity
            style={{
              height: 150,
              borderWidth: 1,
              borderColor: theme.border,
              borderRadius: 8,
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: 20,
            }}
            onPress={async () => {
              const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
              if (status !== 'granted') {
                alert('Permission to access media library is required!');
                return;
              }

              const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [4, 3],
                quality: 1,
              });

              if (!result.canceled) {
                setImage(result.assets[0].uri);
              }
            }}
          >
            {image ? (
              <Image
                source={{ uri: image }}
                style={{ width: '100%', height: '100%', borderRadius: 8 }}
                resizeMode="cover"
              />
            ) : (
              <>
                <Ionicons name="image-outline" size={32} color={theme.primary} />
                <Text style={{ color: theme.primary, marginTop: 8 }}>Upload Photo</Text>
              </>
            )}
          </TouchableOpacity>

          <Text style={{ fontSize: 16, fontWeight: '600', color: theme.text, marginBottom: 8 }}>
            Club Name
          </Text>
          <TextInput
            style={{
              borderWidth: 1,
              borderColor: theme.border,
              borderRadius: 6,
              padding: 10,
              color: theme.text,
              marginBottom: 10,
            }}
            maxLength={120}
            placeholder="Enter your club name"
            placeholderTextColor={theme.placeholder}
            value={clubName}
            onChangeText={setClubName}
          />
          <Text style={{ fontSize: 12, color: theme.placeholder, marginBottom: 16 }}>
            {120 - clubName.length} characters remaining
          </Text>

          <Text style={{ fontSize: 16, fontWeight: '600', color: theme.text, marginBottom: 8 }}>
            Description
          </Text>
          <TextInput
            style={{
              borderWidth: 1,
              borderColor: theme.border,
              borderRadius: 6,
              padding: 10,
              color: theme.text,
              height: 150,
              textAlignVertical: 'top',
            }}
            maxLength={1300}
            placeholder="Describe your club's purpose or mission"
            placeholderTextColor={theme.placeholder}
            multiline
            value={description}
            onChangeText={setDescription}
          />
          <Text style={{ fontSize: 12, color: theme.placeholder, marginTop: 10 }}>
            {1300 - description.length} characters remaining
          </Text>
        </ScrollView>
      )}
      {activeStep === 4 && (
        <FlatList
          data={CLUB_PRIVACY_OPTIONS}
          renderItem={renderPrivacyOption}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingVertical: 20 }}
        />
      )}
      {activeStep === 5 && (
        <FlatList
          data={[
            { id: 'Everywhere', name: 'Everywhere', icon: 'earth-outline' },
            { id: 'search', name: 'Choose location', icon: 'location-outline' },
          ]}
          renderItem={renderLocation}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingVertical: 20 }}
        />
      )}

      {/* Bottom Next Button */}
      <View style={[styles.bottomBar, { borderTopColor: theme.border }]}>
        <TouchableOpacity
          style={[
            styles.nextButton,
            {
              backgroundColor:
                (activeStep === 2 && selectedTags.length < 4) ||
                (activeStep === 3 && (clubName.trim() === '' || description.trim() === '' || !image)) ||
                (activeStep === 4 && !selectedPrivacy)
                  ? theme.border
                  : theme.primary,
            },
          ]}
          disabled={
            (activeStep === 2 && selectedTags.length < 4) ||
            (activeStep === 3 && (clubName.trim() === '' || description.trim() === '' || !image)) ||
            (activeStep === 4 && !selectedPrivacy)
          }
          onPress={async () => {
            if (activeStep === 3 && (clubName.trim() === '' || description.trim() === '' || !image)) {
              alert('Please fill in all fields and upload a photo to proceed.');
              return;
            }
            if (activeStep === 4 && !selectedPrivacy) {
              alert('Please select a privacy option to proceed.');
              return;
            }
            if (activeStep === 5) {
              try {
                const auth = getAuth();
                const user = auth.currentUser;

                // Prevent duplicate club creation
                const duplicateCheckQuery = query(
                  collection(db, 'clubs'),
                  where('name', '==', clubName.trim()),
                  where('createdBy', '==', user.uid),
                  where('type', '==', selectedType)
                );
                const existing = await getDocs(duplicateCheckQuery);
                if (!existing.empty) {
                  alert('You have already created a club with the same name and type.');
                  return;
                }

                const clubRef = await addDoc(collection(db, 'clubs'), {
                  name: clubName.trim(),
                  description: description.trim(),
                  image,
                  type: selectedType,
                  tags: selectedTags,
                  privacy: selectedPrivacy,
                  location: selectedLocation,
                  createdAt: new Date(),
                  createdBy: user.uid
                });

                await setDoc(doc(db, 'clubs', clubRef.id, 'members', user.uid), {
                  userId: user.uid,
                  role: 'admin',
                  joinedAt: new Date()
                });

                navigation.navigate('Clubs');
              } catch (error) {
                console.error("Error creating club: ", error);
                alert('There was an error creating your club. Please try again.');
              }
              return;
            }
            setActiveStep((prev) => Math.min(prev + 1, 5));
          }}
        >
          <Text
            style={[
              styles.nextButtonText,
              {
                color:
                  (activeStep === 2 && selectedTags.length < 4) ||
                  (activeStep === 3 && (clubName.trim() === '' || description.trim() === '' || !image)) ||
                  (activeStep === 4 && !selectedPrivacy)
                    ? theme.placeholder
                    : theme.iconOnPrimary,
              },
            ]}
          >
            {activeStep === 5 ? 'Create' : 'Next'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
    {/* City Search Modal */}
    <Modal
      animationType="slide"
      transparent={true}
      visible={citySearchModalVisible}
      onRequestClose={() => setCitySearchModalVisible(false)}
    >
      <View style={{
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.4)',
      }}>
        <View style={{
          height: '75%',
          backgroundColor: theme.background,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          padding: 20
        }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.text, marginBottom: 12 }}>
            Choose a City
          </Text>
          <TextInput
            placeholder="Search cities..."
            placeholderTextColor={theme.placeholder}
            value={citySearchText}
            onChangeText={setCitySearchText}
            style={{
              borderWidth: 1,
              borderColor: theme.border,
              borderRadius: 8,
              padding: 10,
              color: theme.text,
              marginBottom: 12
            }}
          />
          {citySearchText.trim() === '' ? (
            <Text style={{ color: theme.placeholder, marginTop: 12 }}>
              Search for a city...
            </Text>
          ) : (
            <FlatList
              data={cities.filter(city =>
                city.name.toLowerCase().includes(citySearchText.toLowerCase())
              )}
              keyExtractor={(item, index) => `${item.name}_${index}`}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => {
                    setSelectedLocation(item.name);
                    setCitySearchModalVisible(false);
                  }}
                  style={{
                    paddingVertical: 12,
                    borderBottomWidth: 1,
                    borderBottomColor: theme.border
                  }}
                >
                  <Text style={{ color: theme.text }}>{item.name}</Text>
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </View>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16   
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  closeButton: {
    width: 37,
    height: 37,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    marginRight: 8
  },
  progressBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginVertical: 16,
    marginLeft: 20,
    marginRight: 20
  },
  stepBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    marginHorizontal: 3
  },
  stepDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginHorizontal: 4
  },
  header: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    marginLeft: 20,
  },
  subtext: {
    fontSize: 14,
    marginBottom: 20,
    marginLeft: 20,
  },
  clubTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    borderBottomWidth: 0,
  },
  clubTypeText: {
    fontSize: 16,
    flex: 1
  },
  circle: {
    width: 22,
    height: 22,
    borderRadius: 10,
    borderWidth: 2,
    marginRight: 25,
  },
  circleSelected: {},
  bottomBar: {
    padding: 16,
    borderTopWidth: 0.5
  },
  nextButton: {
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
  },
  nextButtonText: {
    fontWeight: '600',
    fontSize: 18,
  }
});