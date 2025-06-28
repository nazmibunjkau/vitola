import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Image,
  ScrollView,
  TouchableOpacity,
  Modal,
  FlatList,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { Share } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { db } from '../config/firebase';
import { collection, doc, setDoc, addDoc, getDocs } from 'firebase/firestore';
import useAuth from '../hooks/useAuth';
import { RadioButton } from 'react-native-paper';

export default function CigarDetails() {
  const route = useRoute();
  const navigation = useNavigation();
  const { cigar, humidorId, userId, humidorTitle } = route.params || {};
  const { theme } = useTheme();
  const { user } = useAuth();

  const [selectedSpec, setSelectedSpec] = useState('Manufacturer');
  const [containerWidth, setContainerWidth] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);
  const scrollRef = React.useRef(null);
  const tabWidth = 95;

  // Humidor selection modal state
  const [humidorModalVisible, setHumidorModalVisible] = useState(false);
  const [humidors, setHumidors] = useState([]);
  const [selectedHumidorId, setSelectedHumidorId] = useState(null);

  // Function to add cigar to selected humidor
  const handleAddToHumidor = async (humidorId) => {
    try {
      const uid = user?.uid;
      if (!humidorId || !uid) {
        alert('Humidor or user not found.');
        return;
      }

      const cigarId = cigar?.id || cigar?.name?.toLowerCase().replace(/\s+/g, '-');
      if (!cigarId) {
        console.error('Cigar ID is missing.');
        alert('This cigar is missing an ID and cannot be added.');
        return;
      }
      console.log('Adding cigar with ID:', cigarId);
      const humidorCigarRef = doc(db, 'users', uid, 'humidors', humidorId, 'cigars', cigarId);
      await setDoc(humidorCigarRef, {
        ...cigar,
        id: cigarId,
        addedAt: new Date().toISOString(),
      });

      alert('Cigar added to your humidor!');
    } catch (error) {
      console.error('Failed to add cigar:', error);
      alert('Failed to add cigar to humidor.');
    }
  };

  // Fetch user's humidors and show modal
  const fetchHumidors = async () => {
    if (!user?.uid) return;
    try {
      const snapshot = await getDocs(collection(db, 'users', user.uid, 'humidors'));
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setHumidors(list);
      setHumidorModalVisible(true);
    } catch (error) {
      console.error('Error fetching humidors:', error);
      alert('Failed to load humidors.');
    }
  };

  const handleTabPress = (index, label) => {
    setSelectedSpec(label);
    if (scrollRef.current && containerWidth && contentWidth) {
      let offset = tabWidth * index - (containerWidth / 2) + (tabWidth / 2);
      if (offset < 0) offset = 0;
      const maxOffset = contentWidth - containerWidth;
      if (offset > maxOffset) offset = maxOffset > 0 ? maxOffset : 0;
      scrollRef.current.scrollTo({ x: offset, animated: true });
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    scrollContent: {
      padding: 16,
    },
    name: {
      fontSize: 22,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 20,
    },
    backButton: {
      position: 'absolute',
      top: 80,
      left: 16,
      zIndex: 10,
      backgroundColor: theme.primary,
      borderRadius: 20,
      padding: 6,
    },
    shareButton: {
      position: 'absolute',
      top: 80,
      right: 16,
      zIndex: 10,
      backgroundColor: theme.primary,
      borderRadius: 20,
      padding: 6,
    },
    imageContainer: {
      width: '100%',
      height: 380,
      overflow: 'hidden',
    },
    image: {
      width: '100%',
      height: '100%',
      resizeMode: 'contain',
    },
    overlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0, 0, 0, 0.13)',
    },
    detailsCard: {
      marginTop: -20,
      backgroundColor: theme.accent,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 20,
      paddingBottom: 100,
      zIndex: 5,
    },
    ratingContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 20,
    },
    ratingText: {
      marginLeft: 6,
      fontSize: 14,
      color: theme.text,
    },
    description: {
      fontSize: 15,
      fontWeight: 300,
      color: theme.text,
      marginBottom: 16,
    },
    descriptionContainer: {
      borderBottomColor: theme.border || '#ccc',
      borderBottomWidth: StyleSheet.hairlineWidth,
      paddingBottom: 12,
      marginBottom: 20,
    },
    detailsSection: {
      marginBottom: 20,
      borderBottomColor: theme.border || '#ccc',
      borderBottomWidth: StyleSheet.hairlineWidth,
      paddingBottom: 30,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 10,
      color: theme.text,
    },
    detailRow: {
      flexDirection: 'row',
      marginBottom: 6,
    },
    detailLabel: {
      fontWeight: '300',
      width: 120,
      color: theme.primary,
      fontSize: 15,
      lineHeight: 20,
    },
    detailValue: {
      color: theme.text,
      flexShrink: 1,
      fontSize: 15,
      lineHeight: 20,
    },
    buttonGroup: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginTop: 16,
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'center',
      backgroundColor: theme.primary,
      paddingVertical: 11,
      paddingHorizontal: 16,
      borderRadius: 30,
      width: '90%',
      justifyContent: 'center',
    },
    buttonText: {
      color: theme.iconOnPrimary,
      fontSize: 14,
      marginLeft: 10,
    },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    floatingAddButton: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: theme.accent,
      paddingVertical: 24,
      alignItems: 'center',
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      elevation: 10,
    },
    thinBorder: {
      borderBottomColor: theme.border || '#ccc',
      borderBottomWidth: StyleSheet.hairlineWidth,
      marginVertical: 12,
    },
    removeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'center',
      backgroundColor: '#B71C1C',
      paddingVertical: 11,
      paddingHorizontal: 16,
      borderRadius: 30,
      width: '90%',
      justifyContent: 'center',
      marginTop: 12,
    },
  });

  function Detail({ label, value, theme }) {
    if (!value) return null;
    return (
      <View style={styles.detailRow}>
        <Text style={[styles.detailLabel, { color: theme.primary }]}>{label}:</Text>
        <Text style={[styles.detailValue, { color: theme.text }]}>{value}</Text>
      </View>
    );
  }

  const onShare = async () => {
    if (!cigar) return;
    const message = `Check out this amazing cigar on Vitola!`;
    try {
      await Share.share({
        message,
      });
    } catch (error) {
      // Optionally handle error
    }
  };

  const renderStars = (rating) => {
    const stars = [];
    const roundedRating = Math.round(rating * 2) / 2; // round to nearest 0.5
    for (let i = 1; i <= 5; i++) {
      if (i <= Math.floor(roundedRating)) {
        stars.push(
          <FontAwesome5 key={i} name="star" size={16} color={theme.highlight} solid />
        );
      } else if (i === Math.ceil(roundedRating) && roundedRating % 1 !== 0) {
        stars.push(
          <FontAwesome5 key={i} name="star-half-alt" size={16} color={theme.highlight} solid />
        );
      } else {
        stars.push(
          <FontAwesome5 key={i} name="star" size={16} color={theme.placeholder} solid />
        );
      }
    }
    return stars;
  };

  if (!cigar) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text>No cigar data provided.</Text>
      </SafeAreaView>
    );
  }

  const [expandedDescription, setExpandedDescription] = useState(false);
  const descriptionLimit = 150;
  const isLongDescription = cigar.description && cigar.description.length > descriptionLimit;
  const displayedDescription = !expandedDescription && isLongDescription
    ? cigar.description.substring(0, descriptionLimit) + '...'
    : cigar.description;

  const cigarSpecs = [
    { label: 'Manufacturer', value: cigar.manufacturer },
    { label: 'Origin', value: cigar.origin },
    { label: 'Wrapper', value: cigar.wrapper },
    { label: 'Strength', value: cigar.strength },
    { label: 'Binder', value: cigar.binder },
    { label: 'Filler', value: cigar.filler },
    { label: 'Vitola', value: cigar.vitola },
    { label: 'Pressed', value: cigar.pressed },
    { label: 'Sweet', value: cigar.sweet },
    { label: 'Flavored', value: cigar.flavored },
    { label: 'Rolled By', value: cigar.rolled_by },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={28} color={theme.iconOnPrimary} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.shareButton} onPress={onShare}>
        <Ionicons name="share-outline" size={28} color={theme.iconOnPrimary} />
      </TouchableOpacity>
      <ScrollView contentContainerStyle={{paddingBottom: 0}}>
        <View style={styles.imageContainer}>
          {cigar.image_url && (
            <>
              <Image source={{ uri: cigar.image_url }} style={styles.image} />
              <View style={styles.overlay} />
            </>
          )}
        </View>
        <View style={styles.detailsCard}>
          <Text style={styles.name}>{cigar.name}</Text>
          <View style={styles.ratingContainer}>
            {renderStars(cigar.rating || 0)}
            <Text style={styles.ratingText}>({cigar.review_count || 0} Reviews)</Text>
          </View>
          <View style={styles.thinBorder} />
          <Text style={styles.sectionTitle}>Description</Text>
          <View style={styles.descriptionContainer}>
            <Text style={styles.description}>{displayedDescription}</Text>
            {isLongDescription && (
              <Text
                style={{ color: theme.primary, fontWeight: '600', marginTop: 4 }}
                onPress={() => setExpandedDescription(!expandedDescription)}
              >
                {expandedDescription ? 'Show less' : 'Read more'}
              </Text>
            )}
          </View>
          <View style={styles.detailsSection}>
            <View onLayout={e => setContainerWidth(e.nativeEvent.layout.width)}>
              <ScrollView
                ref={scrollRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 16 }}
                onContentSizeChange={(w, h) => setContentWidth(w)}
              >
                {cigarSpecs.map((spec, index) => (
                  <TouchableOpacity
                    key={spec.label}
                    onPress={() => handleTabPress(index, spec.label)}
                    style={{
                      paddingVertical: 10,
                      paddingHorizontal: 14,
                      marginRight: 10,
                      borderBottomWidth: 3,
                      borderBottomColor: selectedSpec === spec.label ? theme.primary : 'transparent',
                      backgroundColor: 'transparent',
                    }}
                  >
                    <Text
                      style={{
                        color: selectedSpec === spec.label ? theme.primary : theme.text,
                        fontWeight: selectedSpec === spec.label ? '700' : '500',
                        fontSize: 15,
                      }}
                    >
                      {spec.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            {selectedSpec === 'Strength' ? (
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 20, color: theme.text, marginBottom: 12 }}>
                  {cigarSpecs.find(spec => spec.label === selectedSpec)?.value || 'N/A'}
                </Text>
                <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 4 }}>
                  {['Mild', 'Mild-Medium', 'Medium-Full', 'Full'].map((level) => (
                    <View
                      key={level}
                      style={{
                        width: 30,
                        alignItems: 'center',
                      }}
                    >
                    </View>
                  ))}
                </View>
                {/* Strength scale with marker */}
                <View style={{ position: 'relative', width: 120, height: 24, alignItems: 'center' }}>
                  <View style={{ flexDirection: 'row', height: 10, width: 120, borderRadius: 5, overflow: 'hidden' }}>
                    <View style={{ flex: 1, backgroundColor: 'green' }} />
                    <View style={{ flex: 1, backgroundColor: 'yellow' }} />
                    <View style={{ flex: 1, backgroundColor: 'orange' }} />
                    <View style={{ flex: 1, backgroundColor: 'red' }} />
                  </View>
                  {/* Marker */}
                  <View style={{
                    position: 'absolute',
                    top: 12,
                    left: (() => {
                      const levels = ['Mild', 'Mild-Medium', 'Medium', 'Medium-Full', 'Full'];
                      const mapping = {
                        'Mild': 0,
                        'Mild-Medium': 1,
                        'Medium': 2,
                        'Medium-Full': 3,
                        'Full': 4
                      };
                      const index = cigar && cigar.strength && mapping[cigar.strength] !== undefined ? mapping[cigar.strength] : 0;
                      const segmentWidth = 120 / levels.length;
                      return index * segmentWidth + (segmentWidth / 2) - 6;
                    })(),
                    width: 0,
                    height: 0,
                    borderLeftWidth: 6,
                    borderRightWidth: 6,
                    borderBottomWidth: 8,
                    borderLeftColor: 'transparent',
                    borderRightColor: 'transparent',
                    borderBottomColor: theme.primary,
                  }} />
                </View>
              </View>
            ) : (
              <View style={{ paddingHorizontal: 16 }}>
                {(() => {
                  const value = cigarSpecs.find(spec => spec.label === selectedSpec)?.value;
                  const valueStr = typeof value === 'string' ? value : '';
                  if (!valueStr) {
                    return <Text style={{ fontSize: 18, fontWeight: '700', color: theme.text, textAlign: 'center' }}>N/A</Text>;
                  }
                  return valueStr.includes(',') ? (
                    valueStr.split(',').map((item, idx) => (
                      <Text
                        key={idx}
                        style={{
                          fontSize: 16,
                          color: theme.text,
                          marginBottom: 4,
                          textAlign: 'left',
                        }}
                      >
                        {'\u2022'} {item.trim()}
                      </Text>
                    ))
                  ) : (
                    <Text style={{ fontSize: 18, fontWeight: 700, color: theme.text, textAlign: 'center' }}>
                      {valueStr}
                    </Text>
                  );
                })()}
              </View>
            )}
          </View>
        </View>
      </ScrollView>
      <View style={styles.floatingAddButton}>
        <TouchableOpacity style={styles.actionButton} onPress={fetchHumidors}>
          <Ionicons name="add-circle-outline" size={24} color={theme.iconOnPrimary} />
          <Text style={styles.buttonText}>Add to My Humidor</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.removeButton}>
          <Ionicons name="remove-circle-outline" size={24} color="#fff" />
          <Text style={styles.buttonText}>Remove from Humidor</Text>
        </TouchableOpacity>
      </View>

      {/* Humidor selection modal */}
      <Modal visible={humidorModalVisible} transparent animationType="slide">
        <View style={{ flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View style={{ backgroundColor: 'white', margin: 20, borderRadius: 10, padding: 20 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 12 }}>Select a Humidor</Text>
            <FlatList
              data={humidors}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity onPress={() => setSelectedHumidorId(item.id)} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
                  <RadioButton
                    value={item.id}
                    status={selectedHumidorId === item.id ? 'checked' : 'unchecked'}
                    onPress={() => setSelectedHumidorId(item.id)}
                  />
                  <Text>{item.title}</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity
              style={{ marginTop: 20, backgroundColor: '#4b382a', padding: 12, borderRadius: 8 }}
              onPress={async () => {
                if (!selectedHumidorId) {
                  alert('Please select a humidor.');
                  return;
                }
                setHumidorModalVisible(false);
                await handleAddToHumidor(selectedHumidorId);
              }}
            >
              <Text style={{ color: 'white', textAlign: 'center' }}>Add to Selected Humidor</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ marginTop: 10 }}
              onPress={() => setHumidorModalVisible(false)}
            >
              <Text style={{ textAlign: 'center', color: '#B71C1C' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}