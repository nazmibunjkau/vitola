import { StyleSheet, Text, View, TouchableOpacity, TextInput, Platform, Alert, FlatList, Image, Dimensions, ScrollView, TouchableWithoutFeedback, Modal } from 'react-native';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Provider } from 'react-native-paper';
import { useTheme } from '../context/ThemeContext';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { db } from '../config/firebase';
import { deleteDoc, getDoc, getDocs, collection, doc, updateDoc, addDoc, setDoc, arrayUnion } from 'firebase/firestore';
import { ActionSheetIOS } from 'react-native';

export default function HumidorAdditions() {
  const { theme } = useTheme();
  const isDark = theme?.isDark || theme?.mode === 'dark';
  const route = useRoute();
  const navigation = useNavigation();
  const { humidorTitle, createdAt, humidorId, userId, fromFullProfile, selectionMode, listType, initialHumidorCigars } = route.params || {};
  const fromFullProfileMode = !!(fromFullProfile || selectionMode);
  const createdDate = createdAt ? new Date(createdAt).toLocaleDateString() : '';
  const [isActive, setIsActive] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [cigars, setCigars] = useState([]);
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [selectedCigar, setSelectedCigar] = useState(null);

  const [activeFilters, setActiveFilters] = useState({
    brand: null,
    vitola: null,
    origin: null,
    flavored: null,
    strength: null,
  });

  const [selectedFilterCategory, setSelectedFilterCategory] = useState(null);
  const [isFreePlan, setIsFreePlan] = useState(null);
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
  const CARD_WIDTH = (screenWidth - 48) / 2; 

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
      const fetchCigarsAndSubscription = async () => {
        if (!humidorId || !userId) return;
        // If we were passed initial cigars (e.g., from FullProfile), seed state immediately
        if (Array.isArray(initialHumidorCigars) && initialHumidorCigars.length) {
          const seeded = initialHumidorCigars.map(d => ({ id: d.id, ...d }));
          const seededSorted = seeded.sort((a, b) => {
            const aTime = a.addedAt ? new Date(a.addedAt).getTime() : 0;
            const bTime = b.addedAt ? new Date(b.addedAt).getTime() : 0;
            return bTime - aTime;
          });
          setCigars(seededSorted);
        }
        const cigarsRef = collection(db, 'users', userId, 'humidors', humidorId, 'cigars');
        try {
          const snapshot = await getDocs(cigarsRef);
          const cigarList = snapshot.docs.map(d => {
            const data = d.data();
            return {
              id: d.id,
              ...data,
              quantity: (typeof data?.quantity === 'number' && data.quantity > 0) ? data.quantity : 1,
            };
          });
          const sortedByNewest = cigarList.sort((a, b) => {
            const aTime = a.addedAt ? new Date(a.addedAt).getTime() : 0;
            const bTime = b.addedAt ? new Date(b.addedAt).getTime() : 0;
            return bTime - aTime; // newest first
          });
          setCigars(sortedByNewest);

          // Fetch user subscription status
          const userRef = doc(db, 'users', userId);
          const userSnap = await getDoc(userRef);
          const userData = userSnap.exists() ? userSnap.data() : {};
          // Normalize "free vs paid" across multiple possible shapes
          // Treat these as PAID: subscriptionPlan === 'paid', or any of plan/subscription/tier in ['paid','pro','premium','plus'], or boolean flags isPremium/isPaid true
          let freePlan = true;
          const planFields = [
            userData.subscriptionPlan,
            userData.plan,
            userData.subscription,
            userData.tier,
          ];
          const normalized = planFields
            .map(v => (v ?? '').toString().toLowerCase().trim())
            .filter(Boolean);
          if (normalized.some(p => ['paid', 'pro', 'premium', 'plus'].includes(p))) {
            freePlan = false;
          }
          if (userData.isPremium === true || userData.isPaid === true) {
            freePlan = false;
          }
          setIsFreePlan(freePlan);
        } catch (error) {
          console.error('Failed to fetch cigars or user subscription:', error);
        }
      };

      fetchCigarsAndSubscription();
    }, [humidorId, userId])
  );

  const getTotalCigarCount = useCallback(() => {
    return cigars.reduce((sum, c) => sum + (typeof c.quantity === 'number' ? c.quantity : 1), 0);
  }, [cigars]);

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

  const handleOpenOptions = (cigar) => {
    setSelectedCigar(cigar);
    setOptionsVisible(true);
  };

  const closeOptions = () => {
    setOptionsVisible(false);
    setSelectedCigar(null);
  };

  // Quick add to favorite/rarest for FullProfile flow
  const handleQuickAdd = async (listKey, cigar) => {
    try {
      if (!userId || !cigar) return;

      // build entry, backfill from global cigars if needed (same logic as handleAddToList)
      let entry = {
        cigarId: cigar.id,
        name: cigar.name || '',
        image_url: cigar.image_url || '',
      };

      if ((!entry.image_url || !entry.name) && cigar.id) {
        try {
          const globalCigarRef = doc(db, 'cigars', cigar.id);
          const globalSnap = await getDoc(globalCigarRef);
          if (globalSnap.exists()) {
            const g = globalSnap.data();
            entry = {
              cigarId: entry.cigarId,
              name: entry.name || g.name || '',
              image_url: entry.image_url || g.image_url || '',
            };
          }
        } catch (e) {
          // ignore backfill errors
        }
      }

      const profileRef = doc(db, 'users', userId, 'full_profile', 'profile');

      // Avoid duplicates
      const profileSnap = await getDoc(profileRef);
      const existing = profileSnap.exists() ? (profileSnap.data()?.[listKey] || []) : [];
      const alreadyThere = existing.some((c) => c.cigarId === entry.cigarId);
      if (alreadyThere) {
        Alert.alert('Already added',
          listKey === 'favoriteCigars' ? 'This cigar is already in your Favorite Cigars.' : 'This cigar is already in your Rarest Cigars.'
        );
        return;
      }

      await setDoc(
        profileRef,
        { [listKey]: arrayUnion(entry) },
        { merge: true }
      );

      Alert.alert('Added',
        listKey === 'favoriteCigars' ? 'Added to Favorite Cigars.' : 'Added to Rarest Cigars.'
      );
    } catch (error) {
      console.warn('Failed to add to list:', error);
      Alert.alert('Error', 'Could not add cigar to the list.');
    }
  };

  // listKey should be 'favoriteCigars' or 'rarestCigars'
  const handleAddToList = async (listKey) => {
    try {
      if (!userId || !selectedCigar) return;

      // Build a minimal entry and backfill image/name if missing by checking global cigars/{cigarId}
      let entry = {
        cigarId: selectedCigar.id,
        name: selectedCigar.name || '',
        image_url: selectedCigar.image_url || '',
      };

      if ((!entry.image_url || !entry.name) && selectedCigar.id) {
        try {
          const globalCigarRef = doc(db, 'cigars', selectedCigar.id);
          const globalSnap = await getDoc(globalCigarRef);
          if (globalSnap.exists()) {
            const g = globalSnap.data();
            entry = {
              cigarId: entry.cigarId,
              name: entry.name || g.name || '',
              image_url: entry.image_url || g.image_url || '',
            };
          }
        } catch (e) {
          // Non-fatal: if we can't backfill, we'll proceed with what we have
        }
      }

      const profileRef = doc(db, 'users', userId, 'full_profile', 'profile');

      // Read existing list to avoid duplicates by cigarId
      const profileSnap = await getDoc(profileRef);
      const existing = profileSnap.exists() ? (profileSnap.data()?.[listKey] || []) : [];
      const alreadyThere = existing.some((c) => c.cigarId === entry.cigarId);

      if (alreadyThere) {
        Alert.alert('Already added',
          listKey === 'favoriteCigars' ? 'This cigar is already in your Favorite Cigars.' : 'This cigar is already in your Rarest Cigars.'
        );
        closeOptions();
        return;
      }

      await setDoc(
        profileRef,
        {
          [listKey]: arrayUnion(entry),
        },
        { merge: true }
      );

      Alert.alert('Added',
        listKey === 'favoriteCigars' ? 'Added to Favorite Cigars.' : 'Added to Rarest Cigars.'
      );
      closeOptions();
    } catch (error) {
      console.warn('Failed to add to list:', error);
      Alert.alert('Error', 'Could not add cigar to the list.');
    }
  };

  const groupedCigars = Object.values(
    filteredCigars.reduce((acc, cigar) => {
      const key = cigar.name?.trim().toLowerCase() || cigar.id;
      if (!acc[key]) {
        acc[key] = { ...cigar, count: 1, ids: [cigar.id] };
      } else {
        acc[key].count += 1;
        acc[key].ids.push(cigar.id);
      }
      return acc;
    }, {})
  ).sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  const handleChangeQuantity = async (cigar, delta) => {
    if (!userId || !humidorId) return;
    const newQuantity = (typeof cigar.quantity === 'number' ? cigar.quantity : 1) + delta;
    if (newQuantity < 1) return;

    const totalQuantity = cigars.reduce((sum, c) => {
      const qty = (typeof c.quantity === 'number' && c.quantity > 0) ? c.quantity : 1;
      return sum + (c.id === cigar.id ? newQuantity : qty);
    }, 0);

    // If user is on free plan and would exceed 6, navigate to Upgrade
    if (isFreePlan === true && totalQuantity > 6) {
      navigation.navigate('Upgrade');
      return;
    }

    try {
      const cigarRef = doc(db, 'users', userId, 'humidors', humidorId, 'cigars', cigar.id);
      await updateDoc(cigarRef, { quantity: newQuantity });
      setCigars(prev =>
        prev.map(c =>
          c.id === cigar.id ? { ...c, quantity: newQuantity } : c
        )
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to update quantity.');
    }
  };

  // Start cigar–drink pairing flow from FullProfile selection mode
  const handleStartPairing = (cigar) => {
    if (!cigar) return;
    const payload = {
      id: cigar.id,
      name: cigar.name || '',
      image: cigar.image_url || '',
    };
    // If we are in FullProfile/selection mode, navigate back with a signal param
    if (fromFullProfileMode) {
      navigation.navigate('FullProfile', { pairingFromCigar: payload });
    } else {
      Alert.alert('Pair with Drink', 'Open this from your profile to create a cigar–drink pairing.');
    }
  };

  const renderCigar = ({ item }) => (
    <View
      style={{
        backgroundColor: theme.accent,
        borderColor: theme.primary,
        minHeight: 200,
        padding: 10,
        marginBottom: 12,
        borderWidth: 1,
        borderRadius: 8,
        width: CARD_WIDTH,
        marginHorizontal: 4,
        alignItems: 'center',
        position: 'relative',
        justifyContent: 'space-between',
      }}
    >
      {/* Hide ellipsis options in FullProfile mode */}
      {!fromFullProfileMode && (
        <TouchableOpacity
          style={{
            position: 'absolute',
            top: 6,
            right: 6,
            padding: 4,
            zIndex: 2,
          }}
          onPress={() => handleOpenOptions(item)}
          hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
        >
          <Ionicons name="ellipsis-vertical" size={18} color={theme.text} />
        </TouchableOpacity>
      )}
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
        <View style={{ minHeight: 48, justifyContent: 'center', width: '100%' }}>
          <Text
            style={{
              color: theme.text,
              fontWeight: 'bold',
              marginBottom: 2,
              textAlign: 'center',
              fontSize: 15,
            }}
            numberOfLines={2}
            ellipsizeMode="tail"
          >
            {item.name || 'Unnamed Cigar'}
          </Text>
          {item.addedAt && (
            <Text style={{ color: theme.text, fontSize: 12, textAlign: 'center' }}>
              Date Added: {new Date(item.addedAt).toLocaleDateString()}
            </Text>
          )}
        </View>
      </TouchableOpacity>
      {/* Bottom actions: either quick-add for FullProfile flow OR quantity controls */}
      {fromFullProfileMode ? (
        <View style={styles.quickAddRow}>
          <TouchableOpacity
            onPress={() => handleQuickAdd('favoriteCigars', item)}
            style={[styles.quickAddButton, { backgroundColor: theme.primary }]}
            activeOpacity={0.85}
          >
            <Ionicons name="heart-outline" size={16} color={theme.iconOnPrimary} style={{ marginRight: 6 }} />
            <Text style={[styles.quickAddText, { color: theme.iconOnPrimary }]}>Add as Favorite</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => handleQuickAdd('rarestCigars', item)}
            style={[styles.quickAddButton, { backgroundColor: theme.primary }]}
            activeOpacity={0.85}
          >
            <Ionicons name="sparkles-outline" size={16} color={theme.iconOnPrimary} style={{ marginRight: 6 }} />
            <Text style={[styles.quickAddText, { color: theme.iconOnPrimary }]}>Add as Rare</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => handleStartPairing(item)}
            style={[styles.quickAddButton, { backgroundColor: theme.primary }]}
            activeOpacity={0.85}
          >
            <Ionicons name="wine-outline" size={16} color={theme.iconOnPrimary} style={{ marginRight: 6 }} />
            <Text style={[styles.quickAddText, { color: theme.iconOnPrimary }]}>Pair with Drink</Text>
          </TouchableOpacity>
        </View>
      ) : (
  // quantity controls...
  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
    <TouchableOpacity
      onPress={() => handleChangeQuantity(item, -1)}
      disabled={item.quantity <= 1}
      style={{
              backgroundColor: theme.background,
              borderRadius: 16,
              width: 32,
              height: 32,
              justifyContent: 'center',
              alignItems: 'center',
              marginRight: 10,
              borderColor: theme.primary,
              borderWidth: 1,
            }}
          >
            <Text style={{ color: theme.primary, fontSize: 22, fontWeight: 'bold', marginBottom: 3 }}>-</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.text, minWidth: 32, textAlign: 'center' }}>
            {item.quantity || 1}
          </Text>
          <TouchableOpacity
            onPress={() => handleChangeQuantity(item, 1)}
            style={{
              backgroundColor: theme.primary,
              borderRadius: 16,
              width: 32,
              height: 32,
              justifyContent: 'center',
              alignItems: 'center',
              marginLeft: 10,
            }}
          >
            <Text style={{ color: theme.background, fontSize: 22, fontWeight: 'bold', marginBottom: 3 }}>+</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
  
  // Explicitly set status (active/inactive)
  const handleSetStatus = async (nextActive) => {
    if (!humidorId || !userId) return;
    const newStatus = nextActive ? 'active' : 'inactive';
    try {
      const humidorRef = doc(db, 'users', userId, 'humidors', humidorId);
      await updateDoc(humidorRef, { humidor_status: newStatus });
      setIsActive(nextActive);
    } catch (error) {
      console.error('Failed to set status:', error);
    }
  };

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
    const totalQty = getTotalCigarCount();
    if (isFreePlan === true && totalQty >= 6) {
      navigation.navigate('Upgrade');
      return;
    }

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
            navigation.navigate('CigarSearch', { humidorId, userId, humidorTitle });
          }
        }
      );
    } else {
      Alert.alert(
        'Add a Cigar',
        '',
        [
          { text: 'Scan a Cigar', onPress: () => navigation.navigate('Scanner', { humidorId, userId }) },
          { text: 'Search a Cigar', onPress: () => navigation.navigate('CigarSearch', { humidorId, userId }) },
          { text: 'Cancel', style: 'cancel' },
        ],
        { cancelable: true }
      );  
    }
  };

  return (
    <Provider>
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <View style={[styles.sectionTop, { backgroundColor: theme.primary }]}>
          <View style={styles.topRow}>
            <TouchableOpacity style={styles.backIcon} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={30} color={theme.background} />
            </TouchableOpacity>
            <Text style={[styles.title, { color: theme.background }]}>
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
                style={[styles.moreButton, { borderColor: theme.background }]}
              >
                <MaterialCommunityIcons name="trash-can-outline" size={17} color={theme.background} />
              </TouchableOpacity>
            </View>
          </View>
        <View style={[styles.searchContainer, { backgroundColor: theme.background, borderColor: theme.border }]}>
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
              <TouchableOpacity onPress={() => handleSetStatus(true)} hitSlop={{top:10,bottom:10,left:10,right:10}}>
                <Text style={[styles.statusOption, isActive && styles.statusOptionActive]}>Active</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleSetStatus(false)} hitSlop={{top:10,bottom:10,left:10,right:10}}>
                <Text style={[styles.statusOption, !isActive && styles.statusOptionActive]}>Inactive</Text>
              </TouchableOpacity>
            </View>
            <View
              style={[
                styles.statusOverlay,
                { left: isActive ? 0 : '50%', backgroundColor: isActive ? 'green' : 'red' },
              ]}
              pointerEvents="none"
            >
              <Text style={styles.sliderValue}>{isActive ? 'Active' : 'Inactive'}</Text>
            </View>
          </View>
          {createdDate && (
            <View style={styles.createdRow}>
              <MaterialCommunityIcons name="calendar" size={16} color={theme.background} />
              <Text style={[styles.createdText, { color: theme.background }]}>
                {'  '}Created on {createdDate}
              </Text>
            </View>
          )}
        </View>
      </View>

      <View style={{ flex: 1, backgroundColor: theme.background }}>
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
                  borderColor: theme.primary,
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

      {/* Options Bottom Sheet */}
      <Modal
        visible={optionsVisible}
        transparent
        animationType="slide"
        onRequestClose={closeOptions}
      >
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          {/* Dim only the area above the sheet; tap to close */}
          <TouchableWithoutFeedback onPress={closeOptions}>
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.15)' }} />
          </TouchableWithoutFeedback>

          {/* Sheet */}
          <View style={{
            backgroundColor: theme.background,
            paddingHorizontal: 20,
            paddingTop: 12,
            paddingBottom: 30,
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            alignItems: 'center'
          }}>
            {/* Grab handle */}
            <View style={{ alignItems: 'center', width: '100%' }}>
              <View
                style={{
                  width: 64,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: '#9AA0A6',
                  marginTop: 2,
                  marginBottom: 14,
                }}
              />
            </View>

            <TouchableOpacity
              onPress={() => handleAddToList('favoriteCigars')}
              style={{ paddingVertical: 14 }}
            >
              <Text style={{ color: theme.primary, fontSize: 16 }}>Add to Favorite Cigars</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handleAddToList('rarestCigars')}
              style={{ paddingVertical: 14 }}
            >
              <Text style={{ color: theme.primary, fontSize: 16 }}>Add to Rarest Cigars</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                if (selectedCigar) {
                  handleDeleteCigar(selectedCigar.id);
                }
                closeOptions();
              }}
              style={{ paddingVertical: 14 }}
            >
              <Text style={{ color: '#B71C1C', fontSize: 16, fontWeight: 'bold' }}>Delete from Humidor</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    overflow: 'hidden',
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
  quickAddRow: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    width: '100%',
    gap: 8,
  },
  quickAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,   // lets the button fit its text
    borderRadius: 16,
    alignSelf: 'center',     // centers each button in the card
  },
  quickAddText: {
    fontSize: 12,
    fontWeight: '600',
  },
});