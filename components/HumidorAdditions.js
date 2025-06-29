import { StyleSheet, Text, View, TouchableOpacity, TextInput, Platform, Alert, FlatList, Image, Dimensions, ScrollView, TouchableWithoutFeedback } from 'react-native';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Provider } from 'react-native-paper';
import { useTheme } from '../context/ThemeContext';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { db } from '../config/firebase';
import { deleteDoc, getDoc, getDocs, collection, doc, updateDoc } from 'firebase/firestore';
import { ActionSheetIOS } from 'react-native';

export default function HumidorAdditions() {
  const { theme, isDarkMode } = useTheme();
  const route = useRoute();
  const navigation = useNavigation();
  const { humidorTitle, createdAt, humidorId, userId, } = route.params || {};
  const createdDate = createdAt ? new Date(createdAt).toLocaleDateString() : '';
  const [isActive, setIsActive] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [cigars, setCigars] = useState([]);

  const [activeFilters, setActiveFilters] = useState({
    brand: null,
    vitola: null,
    origin: null,
    flavored: null,
    strength: null,
  });

  const [selectedFilterCategory, setSelectedFilterCategory] = useState(null);
  // For filter popup dynamic positioning
  const filterBarRef = useRef(null);
  const filterButtonRefs = useRef({});
  const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 });
  const onFilterPress = (category) => {
    filterButtonRefs.current[category]?.measure((x, y, width, height, pageX, pageY) => {
      setPopupPosition({ x: pageX, y: pageY + height + 6 });
      setSelectedFilterCategory(selectedFilterCategory === category ? null : category);
    });
  };

  const closePopup = () => setSelectedFilterCategory(null);


  const screenWidth = Dimensions.get('window').width;
  const CARD_WIDTH = (screenWidth - 48) / 2; // 16 * 2 padding + 16 horizontal padding + 4 * 2 marginHorizontal

  // Load humidor_status from Firestore on mount
  useEffect(() => {
    const fetchStatus = async () => {
      if (!humidorId || !userId) return;
      try {
        const docRef = doc(db, 'users', userId, 'humidors', humidorId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          const status = data.humidor_status?.toLowerCase();
          if (status === 'active' || status === 'inactive') {
            setIsActive(status === 'active');
          }
        }
      } catch (error) {
        console.error('Failed to fetch status:', error);
      }
    };
    fetchStatus();
  }, [humidorId, userId]);

  useFocusEffect(
    useCallback(() => {
      const fetchCigars = async () => {
        if (!humidorId || !userId) return;
        try {
          const cigarsRef = collection(db, 'users', userId, 'humidors', humidorId, 'cigars');
          const snapshot = await getDocs(cigarsRef);
          const cigarList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setCigars(cigarList);
        } catch (error) {
          console.error('Failed to fetch cigars:', error);
        }
      };

      fetchCigars();
    }, [humidorId, userId])
  );

  // Parse comma-separated values, flatten, trim, and deduplicate for filters
  const brands = [
    ...new Set(
      cigars
        .flatMap(c => c.brand?.split(',').map(v => v.trim()) || [])
        .filter(Boolean)
    ),
  ];
  const vitolas = [
    ...new Set(
      cigars
        .flatMap(c => c.vitola?.split(',').map(v => v.trim()) || [])
        .filter(Boolean)
    ),
  ];
  const origins = [
    ...new Set(
      cigars
        .flatMap(c => c.origin?.split(',').map(v => v.trim()) || [])
        .filter(Boolean)
    ),
  ];
  const flavored = [
    ...new Set(
      cigars
        .flatMap(c => c.flavored?.split(',').map(v => v.trim()) || [])
        .filter(Boolean)
    ),
  ];
  const strengths = [
    ...new Set(
      cigars
        .flatMap(c => c.strength?.split(',').map(v => v.trim()) || [])
        .filter(Boolean)
    ),
  ];
  // Added for Date Added filter
  const addedDates = [
    ...new Set(
      cigars
        .map(c => c.addedAt)
        .filter(Boolean)
        .map(date => new Date(date).toLocaleDateString())
    ),
  ];

  const filteredCigars = cigars.filter(cigar => {
    const matchesSearch = cigar.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilters =
      (!activeFilters.brand || cigar.brand === activeFilters.brand) &&
      (!activeFilters.vitola || cigar.vitola === activeFilters.vitola) &&
      (!activeFilters.origin || cigar.origin === activeFilters.origin) &&
      (!activeFilters.flavored || cigar.flavored === activeFilters.flavored) &&
      (!activeFilters.strength || cigar.strength === activeFilters.strength) &&
      (!activeFilters.addedAt || (cigar.addedAt && new Date(cigar.addedAt).toLocaleDateString() === activeFilters.addedAt));
    return matchesSearch && matchesFilters;
  });

  const toggleFilter = (category, value) => {
    setActiveFilters(prev => ({
      ...prev,
      [category]: prev[category] === value ? null : value,
    }));
  };

  // Handler for deleting a cigar
  const handleDeleteCigar = (cigarId) => {
    Alert.alert(
      'Delete Cigar',
      'Are you sure you want to delete this cigar?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const cigarRef = doc(db, 'users', userId, 'humidors', humidorId, 'cigars', cigarId);
              await deleteDoc(cigarRef);
              setCigars(prev => prev.filter(cigar => cigar.id !== cigarId));
            } catch (error) {
              console.error('Failed to delete cigar:', error);
              Alert.alert('Error', 'Failed to delete cigar.');
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  const renderCigar = ({ item }) => (
    <View
      style={{
        backgroundColor: theme.accent,
        borderColor: theme.primary,
        minHeight: 180,
        padding: 10,
        marginBottom: 12,
        borderWidth: 1,
        borderRadius: 8,
        width: CARD_WIDTH,
        marginHorizontal: 4,
        alignItems: 'center',
        position: 'relative', // Added for absolute positioning of ellipsis
      }}
    >
      <TouchableOpacity
        style={{
          position: 'absolute',
          top: 6,
          right: 6,
          padding: 6,
          zIndex: 2,
        }}
        onPress={() => handleDeleteCigar(item.id)}
        hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
      >
        <MaterialCommunityIcons name="dots-vertical" size={24} color={theme.text} />
      </TouchableOpacity>
      <TouchableOpacity
        style={{ alignItems: 'center', width: '100%' }}
        onPress={() => navigation.navigate('CigarDetails', { cigar: item, humidorId, userId })}
        activeOpacity={0.8}
      >
        {item.image_url && (
          <Image
            source={{ uri: item.image_url }}
            style={{
              width: 100,
              height: 100,
              resizeMode: 'contain',
              marginBottom: 8,
            }}
          />
        )}
        <Text style={{ color: theme.text, fontWeight: 'bold', marginBottom: 4, textAlign: 'center' }}>
          {item.name || 'Unnamed Cigar'}
        </Text>
        {item.addedAt && (
          <Text style={{ color: theme.text, fontSize: 12, marginTop: 4 }}>
            Date Added: {new Date(item.addedAt).toLocaleDateString()}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
  
  // Update status in Firestore when toggled
  const handleToggleStatus = async () => {
    if (!humidorId || !userId) return;

    const newStatus = isActive ? 'inactive' : 'active';

    try {
      const humidorRef = doc(db, 'users', userId, 'humidors', humidorId);
      await updateDoc(humidorRef, {
        humidor_status: newStatus,
      });
      setIsActive(newStatus === 'active'); // update local state after saving
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  const showAddCigarOptions = () => {
    if (Platform.OS === 'ios') {
      const options = ['Scan a Cigar', 'Search a Cigar', 'Cancel'];
      const cancelButtonIndex = 2;
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex,
          title: 'Add a Cigar',
        },
        (buttonIndex) => {
          if (buttonIndex === 0) {
            navigation.navigate('Scanner', { humidorId, userId, humidorTitle });
          } else if (buttonIndex === 1) {
            navigation.navigate('Search', { humidorId, userId, humidorTitle });
          }
        }
      );
    } else {
      Alert.alert(
        'Add a Cigar',
        '',
        [
          { text: 'Scan a Cigar', onPress: () => navigation.navigate('Scanner', { humidorId, userId }) },
          { text: 'Search a Cigar', onPress: () => navigation.navigate('Search', { humidorId, userId }) },
          { text: 'Cancel', style: 'cancel' },
        ],
        { cancelable: true }
      );
    }
  };

  return (
    <Provider>
      <View style={{ flex: 1 }}>
        <View style={[styles.sectionTop, { backgroundColor: theme.primary }]}>
          <View style={styles.topRow}>
            <TouchableOpacity style={styles.backIcon} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={30} color={theme.accent} />
            </TouchableOpacity>
            <Text style={[styles.title, { color: theme.accent }]}>
              {humidorTitle || 'My Humidor'}
            </Text>
            <View style={styles.buttonRow}>
              <TouchableOpacity
                onPress={() => {
                  Alert.alert(
                    'Delete Humidor',
                    'Are you sure you want to delete this humidor? This action cannot be undone.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: async () => {
                          if (!humidorId || !userId) {
                            console.warn('Missing humidorId or userId:', humidorId, userId);
                            return;
                          }

                          try {
                            const humidorRef = doc(db, 'users', userId, 'humidors', humidorId);

                            // Manually delete known subcollection: 'humidor_cigars'
                            const cigarsRef = collection(db, 'users', userId, 'humidors', humidorId, 'humidor_cigars');
                            const snapshot = await getDocs(cigarsRef);
                            const cigarDeletions = snapshot.docs.map(docSnap => deleteDoc(docSnap.ref));
                            await Promise.all(cigarDeletions);

                            // Then delete the humidor document
                            const docSnap = await getDoc(humidorRef);
                            if (docSnap.exists()) {
                              console.log('✅ Humidor document exists. Deleting:', humidorRef.path);
                              await deleteDoc(humidorRef);
                              navigation.goBack();
                            } else {
                              console.warn('❌ Humidor document not found at:', humidorRef.path);
                              Alert.alert('Error', 'Humidor not found in database.');
                            }
                          } catch (error) {
                            console.error('❌ Failed to delete humidor and cigars:', error);
                            Alert.alert('Error', 'Failed to delete humidor. Please try again.');
                          }
                        },
                      },
                    ],
                    { cancelable: true }
                  );
                }}
                style={[styles.moreButton, { borderColor: theme.accent }]}
              >
                <MaterialCommunityIcons name="trash-can-outline" size={17} color={theme.accent} />
              </TouchableOpacity>
            </View>
          </View>
        <View style={[styles.searchContainer, { backgroundColor: theme.accent, borderColor: theme.border }]}>
          <Ionicons name="search-outline" size={20} color={theme.primary} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Search..."
            placeholderTextColor={theme.placeholder}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#B71C1C" />
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.statusRow}>
          <View style={styles.statusSliderContainer}>
            <View style={styles.statusLabels}>
              <Text style={[styles.statusOption, isActive && styles.statusOptionActive]}>
                Active
              </Text>
              <Text style={[styles.statusOption, !isActive && styles.statusOptionActive]}>
                Inactive
              </Text>
            </View>
          <TouchableOpacity
            style={[
              styles.statusOverlay,
              { left: isActive ? 0 : '50%', backgroundColor: isActive ? 'green' : 'red' },
            ]}
            onPress={handleToggleStatus}
            activeOpacity={0.8}
          >
            <Text style={styles.sliderValue}>{isActive ? 'Active' : 'Inactive'}</Text>
          </TouchableOpacity>
          </View>
          {createdDate && (
            <View style={styles.createdRow}>
              <MaterialCommunityIcons name="calendar" size={16} color={theme.accent} />
              <Text style={[styles.createdText, { color: theme.accent }]}>
                {'  '}Created on {createdDate}
              </Text>
            </View>
          )}
        </View>
      </View>

      <View ref={filterBarRef} style={{ paddingHorizontal: 16, marginTop: 12 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ alignItems: 'center' }}>
          {Object.values(activeFilters).some(val => val) && (
            <TouchableOpacity
              onPress={() => {
                setActiveFilters({
                  brand: null,
                  vitola: null,
                  origin: null,
                  flavored: null,
                  strength: null,
                  addedAt: null,
                });
                closePopup();
              }}
              style={{
                paddingVertical: 6,
                paddingHorizontal: 12,
                borderRadius: 20,
                borderWidth: 1.5,
                borderColor: '#B71C1C',
                backgroundColor: 'transparent',
                justifyContent: 'center',
                alignItems: 'center',
                marginRight: 10,
              }}
            >
              <Text style={{ color: '#B71C1C', fontWeight: 'bold' }}>X</Text>
            </TouchableOpacity>
          )}
          {[
            { label: 'Brand', category: 'brand' },
            { label: 'Date Added', category: 'addedAt' },
            { label: 'Size', category: 'vitola' },
            { label: 'Origin', category: 'origin' },
            { label: 'Flavored', category: 'flavored' },
            { label: 'Strength', category: 'strength' },
          ].map(({ label, category }) => (
            <TouchableOpacity
              key={category}
              ref={el => (filterButtonRefs.current[category] = el)}
              onPress={() => onFilterPress(category)}
              style={{
                marginRight: 10,
                paddingVertical: 8,
                paddingHorizontal: 20,
                borderRadius: 20,
                backgroundColor: theme.accent,
                borderWidth: 1,
                borderColor: theme.border,
              }}
            >
              <Text style={{ color: theme.text }}>{label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={{ flex: 1, marginTop: 20 }}>
        <FlatList
          data={filteredCigars}
          keyExtractor={item => item.id}
          renderItem={renderCigar}
          numColumns={2}
          columnWrapperStyle={{ justifyContent: 'space-between', paddingHorizontal: 16 }}
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 16 }}
          ListEmptyComponent={
            <Text style={{ color: theme.placeholder, textAlign: 'center' }}>
              {Object.values(activeFilters).some(val => val)
                ? 'No results found for this filter.'
                : 'No cigars in this humidor yet.'}
            </Text>
          }
        />
      </View>

      {/* Second section to be added */}
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: theme.primary }]}
          onPress={showAddCigarOptions}
        >
          <Ionicons name="add" size={32} color={theme.iconOnPrimary} />
        </TouchableOpacity>

      {/* Overlay and pop-up moved to root level */}
      {selectedFilterCategory && (
        <>
          <TouchableWithoutFeedback
            onPress={() => {
              closePopup();
              if (typeof Keyboard !== 'undefined' && Keyboard.dismiss) Keyboard.dismiss();
            }}
          >
            <View
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: 0,
                right: 0,
                zIndex: 9,
              }}
              pointerEvents="auto"
            />
          </TouchableWithoutFeedback>
          <View
            style={{
              position: 'absolute',
              top: popupPosition.y,
              left: popupPosition.x,
              width: 200,
              backgroundColor: theme.background,
              borderRadius: 8,
              paddingVertical: 8,
              zIndex: 10,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.3,
              shadowRadius: 6,
              elevation: 5,
            }}
          >
            {(selectedFilterCategory === 'addedAt' ? addedDates :
              selectedFilterCategory === 'brand' ? brands :
              selectedFilterCategory === 'vitola' ? vitolas :
              selectedFilterCategory === 'origin' ? origins :
              selectedFilterCategory === 'flavored' ? flavored :
              strengths
            ).map(value => {
              const active = activeFilters[selectedFilterCategory] === value;
              return (
                <TouchableOpacity
                  key={value}
                  onPress={() => {
                    toggleFilter(selectedFilterCategory, value);
                    closePopup();
                  }}
                  style={{
                    paddingVertical: 10,
                    paddingHorizontal: 14,
                    backgroundColor: active ? theme.accent : 'transparent',
                  }}
                >
                  <Text style={{ color: theme.text }}>
                    {value.split(',').join('\n')}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}
    </View>
    </Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  sectionTop: {
    height: 250,
    paddingHorizontal: 16,
    paddingTop: 60,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  backIcon: {
    padding: 8,
    marginLeft: -8,
  },
  searchContainer: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 40,
  },
  searchInput: {
    flex: 1,
    height: 40,
    marginLeft: 8,
  },
  title: {
    fontSize: 25,
    fontWeight: '500',
    flex: 1,
    textAlign: 'center',
  },
  addButton: {  
    padding: 6,
    borderWidth: 2,
    borderRadius: 30,
  },
  moreButton: {
    padding: 6,
    borderWidth: 2,
    borderRadius: 30,
  },
  statusRow: {
    marginTop: 22,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  createdRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  createdText: {
    fontSize: 14,
  },
  statusSliderContainer: {
    width: 120,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#e0e0e0',
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  statusLabels: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  statusOption: {
    color: '#555',
    fontSize: 12,
    fontWeight: '400',
  },
  statusOptionActive: {
    fontWeight: '400',
    color: '#000',
  },
  statusOverlay: {
    position: 'absolute',
    top: 0,
    width: '50%',
    height: '100%',
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
  },
  sliderValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: 'white',
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
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalButton: {
    backgroundColor: '#4b382a',
    padding: 12,
    borderRadius: 10,
    marginVertical: 6,
  },
  modalButtonText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: 'bold',
  },
});