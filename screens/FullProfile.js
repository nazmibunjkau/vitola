import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Image,
  TouchableOpacity,
  Dimensions,
  Alert,
  ScrollView,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  FlatList,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { doc, getDoc, updateDoc, setDoc, collection, getDocs, onSnapshot, query, where, limit } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from '../config/firebase';
import { useTheme } from '../context/ThemeContext';

import citiesData from '../assets/cities.json';

const { width, height } = Dimensions.get('window'); 
const HEADER_HEIGHT = height * 0.2;

export default function FullProfile() {
  const navigation = useNavigation();
  const route = useRoute();
  // When returning from HumidorAdditions with a cigar to pair, open the pairing modal
  useEffect(() => {
    const payload = route?.params?.pairingFromCigar;
    if (!payload || !isOwnProfile) return;

    // Normalize payload into the same shape we use elsewhere
    const item = {
      id: payload.id,
      name: payload.name || 'Cigar',
      image: payload.image || null,
    };

    setPairingPendingCigar(item);
    setPairDrinkInput('');
    setPairModalVisible(true);

    // Clear the param so the modal doesn't re-open on re-render
    try {
      navigation.setParams({ pairingFromCigar: undefined });
    } catch (_) {}
  }, [route?.params?.pairingFromCigar, isOwnProfile]);
  // Expecting navigation like: navigate('FullProfile', { userId: 'abc123' })
  const { userId: paramUserId } = route.params || {};

  const auth = getAuth();
  const currentUser = auth.currentUser;
  const viewedUserId = paramUserId || currentUser?.uid; // fallback to self if none provided
  const isOwnProfile = useMemo(() => currentUser?.uid === viewedUserId, [currentUser?.uid, viewedUserId]);

  const { theme, isDarkMode } = useTheme();

  const [profile, setProfile] = useState(null);
  const [bgUri, setBgUri] = useState(null);
  const [avatarUri, setAvatarUri] = useState(null);
  const [displayLocation, setDisplayLocation] = useState(null);

  // full_profile subdocument
  const [fpLoaded, setFpLoaded] = useState(false);
  const [yearsSmoked, setYearsSmoked] = useState(null);

  // Derived: classify user based on years smoked
  const experienceLabel = useMemo(() => {
    if (yearsSmoked == null || isNaN(Number(yearsSmoked))) return '—';
    const y = Number(yearsSmoked);
    if (y <= 1) return 'Amateur';
    if (y <= 2) return 'Beginner';
    if (y <= 10) return 'Advanced';
    return 'Expert';
  }, [yearsSmoked]);
  // editable bio/description (stored in full_profile)
  const [bioText, setBioText] = useState('');

  // favorites / rarest cigars arrays (stored in full_profile)
  // Each item should be an object: { id: string, name: string, image?: string }
  const [favoriteCigars, setFavoriteCigars] = useState([]);
  const [rarestCigars, setRarestCigars] = useState([]);

  // Favorite drink pairings
  const [favoriteDrinks, setFavoriteDrinks] = useState([]); // [{ id, name }]
  const [drinkModalVisible, setDrinkModalVisible] = useState(false);
  const [drinkInput, setDrinkInput] = useState('');

  // Cigar–Drink pairings
  const [favoritePairs, setFavoritePairs] = useState([]); // [{ id, cigar: {id,name,image}, drink }]
  const [pairModalVisible, setPairModalVisible] = useState(false);
  const [pairDrinkInput, setPairDrinkInput] = useState('');
  const [pairingPendingCigar, setPairingPendingCigar] = useState(null);

  // Humidor picker state
  const [humidorsModalVisible, setHumidorsModalVisible] = useState(false);
  const [humidorsLoading, setHumidorsLoading] = useState(false);
  const [humidors, setHumidors] = useState([]); // [{id, name}]
  const [pendingListType, setPendingListType] = useState(null); // 'favorite' | 'rarest'
  const [selectedHumidorId, setSelectedHumidorId] = useState(null);

  // location editor
  const [locationEditVisible, setLocationEditVisible] = useState(false);
  const [cityQuery, setCityQuery] = useState('');
  const [filteredCities, setFilteredCities] = useState([]);

// Normalize possible string arrays into [{id,name,image?}], preserving master id fields
const mapCigarArray = (arr) => Array.isArray(arr)
  ? arr.map((it) => {
      if (!it) return it;
      if (typeof it === 'string') return ({ id: it, name: it });
      // normalize possible master cigar id fields into id
      const masterId = it.cigarId || it.masterId || it.cigar_id || it.id;
      return { ...it, id: masterId };
    }).filter(Boolean)
  : [];

// Normalize drinks into [{id,name}]
const mapDrinkArray = (arr) => Array.isArray(arr)
  ? arr.map((it) => {
      if (!it) return null;
      if (typeof it === 'string') return { id: it, name: it };
      const id = it.id || it.drinkId || it.name;
      const name = it.name || it.title || String(id || '');
      return id ? { id, name } : null;
    }).filter(Boolean)
  : [];

// Normalize pairs into [{id,cigar:{id,name,image?}, drink}]
const mapPairArray = (arr) => Array.isArray(arr)
  ? arr.map((it) => {
      if (!it || typeof it !== 'object') return null;
      const cigar = it.cigar || {};
      const cid = cigar.cigarId || cigar.masterId || cigar.cigar_id || cigar.id;
      const cname = cigar.name || it.cigarName || '';
      const cimg = cigar.image || cigar.image_url || it.cigarImage || null;
      const drink = it.drink || it.drinkName || '';
      const id = it.id || cid || `${cname}-${drink}`;
      if (!cid && !cname) return null;
      return { id, cigar: { id: cid, name: cname, image: cimg }, drink };
    }).filter(Boolean)
  : [];


  // edit modal
  const [editVisible, setEditVisible] = useState(false);
  const [editField, setEditField] = useState(null); // 'favoriteCigars' | 'rarestCigars' | 'yearsSmoked'
  const [editText, setEditText] = useState('');

  // --- Fetch profile ---
  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        if (!viewedUserId) return;
        const ref = doc(db, 'users', viewedUserId);
        const snap = await getDoc(ref);
        let baseBio = '';
        let baseLocation = null;
        if (snap.exists() && isMounted) {
          const data = snap.data();
          setProfile({ id: snap.id, ...data });
          setBgUri(data.backgroundImage || null);
          setAvatarUri(data.photoURL || data.image || null);
          const _bio = data.bio || data.about || '';
          baseBio = _bio;
          baseLocation = data.location || data.city || null;
        } else if (isMounted) {
          setProfile(null);
        }
        // load full_profile subdoc (now readable for others per rules)
        try {
          const fpRef = doc(db, 'users', viewedUserId, 'full_profile', 'profile');
          const fpSnap = await getDoc(fpRef);
          if (fpSnap.exists() && isMounted) {
            const fp = fpSnap.data();
            setYearsSmoked(typeof fp.yearsSmoked === 'number' ? fp.yearsSmoked : (profile?.yearsSmoked ?? profile?.years_smoked ?? null));
            setBioText(typeof fp.bio === 'string' ? fp.bio : (baseBio || ''));
            const fav = mapCigarArray(fp.favoriteCigars);
            const rare = mapCigarArray(fp.rarestCigars);
            setFavoriteCigars(fav);
            setRarestCigars(rare);
            enrichCigarListImages(fav, 'favoriteCigars');
            enrichCigarListImages(rare, 'rarestCigars');
            setDisplayLocation(fp.location != null ? fp.location : baseLocation);
            const drinks = mapDrinkArray(fp.favoriteDrinks);
            setFavoriteDrinks(drinks);
            const pairs = mapPairArray(fp.favoritePairs);
            setFavoritePairs(pairs);
          } else if (isMounted) {
            // Fallbacks when no full_profile exists
            setYearsSmoked(profile?.yearsSmoked ?? profile?.years_smoked ?? null);
            setBioText(baseBio || '');
            setFavoriteCigars([]);
            setRarestCigars([]);
            setDisplayLocation(baseLocation);
            setFavoriteDrinks([]);
            setFavoritePairs([]);
          }
          if (isMounted) setFpLoaded(true);
        } catch (e) {
          console.log('full_profile read failed', e?.code || e?.message || e);
          if (isMounted) setFpLoaded(true);
        }
      } catch (e) {
        console.log('Error loading profile:', e);
        if (isMounted) setFpLoaded(true);
      }
    };
    load();
    return () => { isMounted = false; };
  }, [viewedUserId]);

  // Live sync favorite/rarest lists
  useEffect(() => {
    if (!viewedUserId) return;
    const fpRef = doc(db, 'users', viewedUserId, 'full_profile', 'profile');
    const unsub = onSnapshot(
      fpRef,
      (snap) => {
        if (!snap.exists()) return;
        const fp = snap.data() || {};
        const fav = mapCigarArray(fp.favoriteCigars);
        const rare = mapCigarArray(fp.rarestCigars);
        setFavoriteCigars(fav);
        setRarestCigars(rare);
        enrichCigarListImages(fav, 'favoriteCigars');
        enrichCigarListImages(rare, 'rarestCigars');
        const drinks = mapDrinkArray(fp.favoriteDrinks);
        setFavoriteDrinks(drinks);
        const pairs = mapPairArray(fp.favoritePairs);
        setFavoritePairs(pairs);
        setYearsSmoked(typeof fp.yearsSmoked === 'number' ? fp.yearsSmoked : yearsSmoked);
      },
      (err) => {
        console.log('full_profile snapshot error', err?.code || err?.message || err);
      }
    );
    return () => unsub();
  }, [viewedUserId]);
  // --- Favorite Cigar–Drink Pairings ---
  const openPairingFlow = () => {
    if (!isOwnProfile) return;
    setPairDrinkInput('');
    setPairingPendingCigar(null);
    // Reuse humidor picker to select the cigar first
    openHumidorPicker('pairings');
  };

  const startPairForCigar = (cigarItem) => {
    setPairingPendingCigar(cigarItem);
    setPairDrinkInput('');
    setPairModalVisible(true);
  };

  const savePair = async () => {
    if (!isOwnProfile) { setPairModalVisible(false); return; }
    const drink = (pairDrinkInput || '').trim();
    if (!drink) return Alert.alert('Add Pairing', 'Please enter a drink.');
    if (!pairingPendingCigar) return Alert.alert('Add Pairing', 'Please select a cigar first.');
    try {
      const cigar = pairingPendingCigar;
      const id = cigar.id || `${cigar.name}-${drink}`.toLowerCase();
      const next = [...favoritePairs, { id, cigar, drink }];
      const fpRef = doc(db, 'users', viewedUserId, 'full_profile', 'profile');
      await setDoc(fpRef, { favoritePairs: next }, { merge: true });
      setFavoritePairs(next);
      setPairModalVisible(false);
      setPairingPendingCigar(null);
      setPairDrinkInput('');
    } catch (e) {
      Alert.alert('Save Failed', e.message || String(e));
    }
  };

  const handleRemovePair = async (pairId) => {
    if (!isOwnProfile) return;
    try {
      const next = favoritePairs.filter(p => (p.id) !== pairId);
      const fpRef = doc(db, 'users', viewedUserId, 'full_profile', 'profile');
      await setDoc(fpRef, { favoritePairs: next }, { merge: true });
      setFavoritePairs(next);
    } catch (e) {
      Alert.alert('Remove Failed', e.message || String(e));
    }
  };
  // --- Favorite Drink Pairings ---
  const openDrinkModal = () => {
    if (!isOwnProfile) return;
    setDrinkInput('');
    setDrinkModalVisible(true);
  };

  const saveDrink = async () => {
    if (!isOwnProfile) { setDrinkModalVisible(false); return; }
    const name = (drinkInput || '').trim();
    if (!name) return Alert.alert('Add Drink', 'Please enter a drink name.');
    try {
      const id = name.toLowerCase();
      const next = [...favoriteDrinks, { id, name }];
      const fpRef = doc(db, 'users', viewedUserId, 'full_profile', 'profile');
      await setDoc(fpRef, { favoriteDrinks: next }, { merge: true });
      setFavoriteDrinks(next);
      setDrinkModalVisible(false);
    } catch (e) {
      Alert.alert('Save Failed', e.message || String(e));
    }
  };

  const handleRemoveDrink = async (drinkId) => {
    if (!isOwnProfile) return;
    try {
      const next = favoriteDrinks.filter(d => (d.id || d.name) !== drinkId);
      const fpRef = doc(db, 'users', viewedUserId, 'full_profile', 'profile');
      await setDoc(fpRef, { favoriteDrinks: next }, { merge: true });
      setFavoriteDrinks(next);
    } catch (e) {
      Alert.alert('Remove Failed', e.message || String(e));
    }
  };

  // Ensure any items missing images are enriched
  useEffect(() => {
    const needsFav = Array.isArray(favoriteCigars) && favoriteCigars.some(it => it && it.id && !it.image);
    const needsRare = Array.isArray(rarestCigars) && rarestCigars.some(it => it && it.id && !it.image);
    if (needsFav) {
      enrichCigarListImages(favoriteCigars, 'favoriteCigars');
    }
    if (needsRare) {
      enrichCigarListImages(rarestCigars, 'rarestCigars');
    }
  }, [favoriteCigars, rarestCigars]);

  const handleImagePick = async (type) => {
    if (!isOwnProfile) return; // Only owner can update
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: type === 'background' ? [3, 1] : [1, 1],
        quality: 1,
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        const uri = result.assets[0].uri;
        const ref = doc(db, 'users', viewedUserId);
        await updateDoc(ref, {
          [type === 'background' ? 'backgroundImage' : 'photoURL']: uri,
        });
        if (type === 'background') setBgUri(uri); else setAvatarUri(uri);
      }
    } catch (err) {
      Alert.alert('Image Upload Error', err.message || String(err));
    }
  };

  // Derived display fields with fallbacks
  const name = profile?.displayName || profile?.user_name || profile?.name || '';
  const location = displayLocation;
  const followers = Array.isArray(profile?.followers) ? profile.followers.length : (profile?.followersCount || 0);
  const following = Array.isArray(profile?.following) ? profile.following.length : (profile?.followingCount || 0);

  const mockPosts = [
    { id: '1', userName: name, date: '2h ago', text: 'Enjoyed a great stick today.' },
    { id: '2', userName: name, date: '1d ago', text: 'Anyone tried the new release?' },
  ];

  const saveFullProfileField = async () => {
    if (!isOwnProfile || !currentUser) { setEditVisible(false); return; }
    try {
      const fpRef = doc(db, 'users', viewedUserId, 'full_profile', 'profile');
      if (editField === 'yearsSmoked') {
        const val = parseInt(editText, 10);
        const safe = Number.isFinite(val) ? val : null;

        let exp = '—';
        if (safe != null) {
          if (safe <= 1) exp = 'Amateur';
          else if (safe <= 2) exp = 'Beginner';
          else if (safe <= 10) exp = 'Advanced';
          else exp = 'Expert';
        }

        await setDoc(fpRef, { yearsSmoked: safe, experience: exp }, { merge: true });
        setYearsSmoked(safe);
      } else if (editField === 'bio') {
        await setDoc(fpRef, { bio: editText }, { merge: true });
        setBioText(editText);
      }
      setEditVisible(false);
    } catch (e) {
      Alert.alert('Save Failed', e.message || String(e));
    }
  };


  // Helper to format joined date
  const joinedDate = (() => {
    const ts = profile?.createdAt || profile?.created_at;
    let d = null;
    if (ts?.toDate) {
      try { d = ts.toDate(); } catch {}
    } else if (typeof ts === 'string' || ts instanceof Date) {
      d = new Date(ts);
    }
    return d && !isNaN(d.getTime()) ? d : null;
  })();
  const joinedLabel = joinedDate ? ` · Joined ${joinedDate.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}` : '';

  // --- Location search helpers ---
  useEffect(() => {
    if (!cityQuery || cityQuery.trim().length < 2) {
      setFilteredCities([]);
      return;
    }
    const q = cityQuery.trim().toLowerCase();
    const results = [];
    for (let i = 0; i < citiesData.length; i++) {
      const c = citiesData[i];
      const cityName = (c.name || '').toLowerCase();
      // Only match on city name
      if (cityName.includes(q)) {
        results.push(c);
        if (results.length >= 50) break; // cap list
      }
    }
    setFilteredCities(results);
  }, [cityQuery]);

  const formatCityLabel = (c) => {
    const parts = [c.name];
    if (c.state_name) parts.push(c.state_name);
    else if (c.state_code) parts.push(c.state_code);
    if (c.country_name) parts.push(c.country_name);
    return parts.filter(Boolean).join(', ');
  };

// Robustly resolve cigar image from master cigars collection
const fetchCigarImage = async ({ cigarId, id, name }) => {
  try {
    // 1) Prefer explicit master id
    const tryId = async (theId) => {
      if (!theId) return null;
      const s = await getDoc(doc(db, 'cigars', theId));
      if (s.exists()) {
        const d = s.data();
        return d.image_url || d.image || null;
      }
      return null;
    };

    // Try cigarId first, then id
    let img = await tryId(cigarId);
    if (!img) img = await tryId(id);

    // 2) Fallback: lookup by name_insensitive (exact match)
    if (!img && name) {
      const q1 = query(collection(db, 'cigars'), where('name_insensitive', '==', (name || '').toLowerCase()), limit(1));
      const r1 = await getDocs(q1);
      const docSnap = r1.docs[0];
      if (docSnap) {
        const d = docSnap.data();
        img = d.image_url || d.image || null;
      }
      // Last resort: exact name (case-sensitive) if no insensitive field
      if (!img) {
        const q2 = query(collection(db, 'cigars'), where('name', '==', name), limit(1));
        const r2 = await getDocs(q2);
        const d2 = r2.docs[0]?.data();
        if (d2) img = d2.image_url || d2.image || null;
      }
    }
    return img || null;
  } catch (_) {
    return null;
  }
};

// Ensure lists have image URLs; if missing, fetch and persist back to full_profile
const enrichCigarListImages = async (list, fieldKey) => {
  try {
    if (!Array.isArray(list) || !list.length) return;
    const updated = await Promise.all(
      list.map(async (it) => {
        if (!it) return it;
        if (it.image) return it;
        const img = await fetchCigarImage({
          cigarId: it.cigarId || it.masterId || it.cigar_id,
          id: it.id,
          name: it.name,
        });
        return img ? { ...it, image: img } : it;
      })
    );
    const changed = JSON.stringify(updated) !== JSON.stringify(list);
    if (changed) {
      const fpRef = doc(db, 'users', viewedUserId, 'full_profile', 'profile');
      await setDoc(fpRef, { [fieldKey]: updated }, { merge: true });
      if (fieldKey === 'favoriteCigars') setFavoriteCigars(updated);
      if (fieldKey === 'rarestCigars') setRarestCigars(updated);
    }
  } catch (_) {}
};

  const handleSelectCity = async (c) => {
    const label = formatCityLabel(c);
    try {
      const userRef = doc(db, 'users', viewedUserId);
      await updateDoc(userRef, { location: label });

      const fpRef = doc(db, 'users', viewedUserId, 'full_profile', 'profile');
      // also persist an 'experience' snapshot alongside location, based on current yearsSmoked
      const y = Number(yearsSmoked);
      let exp = '—';
      if (!isNaN(y)) {
        if (y <= 1) exp = 'Amateur';
        else if (y <= 2) exp = 'Beginner';
        else if (y <= 10) exp = 'Advanced';
        else exp = 'Expert';
      }
      await setDoc(fpRef, { location: label, experience: exp }, { merge: true });

      setDisplayLocation(label);
      setProfile(prev => prev ? ({ ...prev, location: label }) : prev);
      setLocationEditVisible(false);
      setCityQuery('');
      setFilteredCities([]);
    } catch (e) {
      Alert.alert('Save Failed', e.message || String(e));
    }
  };


// After user picks a cigar from a selection screen
const handleCigarPicked = async (type, cigar) => {
  // cigar can be from humidor or search; normalize master id
  if (!cigar || !cigar.name) return;
  try {
    const masterId = cigar.cigarId || cigar.masterId || cigar.cigar_id || cigar.id;
    const img = cigar.image || (await fetchCigarImage({ cigarId: masterId, id: masterId, name: cigar.name }));
    const item = { id: masterId, name: cigar.name, image: img || null };

    const fpRef = doc(db, 'users', viewedUserId, 'full_profile', 'profile');
    if (type === 'favorite') {
      const next = [...favoriteCigars, item];
      await setDoc(fpRef, { favoriteCigars: next }, { merge: true });
      setFavoriteCigars(next);
    } else if (type === 'rarest') {
      const next = [...rarestCigars, item];
      await setDoc(fpRef, { rarestCigars: next }, { merge: true });
      setRarestCigars(next);
    } else if (type === 'pairings') {
      // Start pairing modal for this cigar
      setPairingPendingCigar(item);
      setPairModalVisible(true);
    }
  } catch (e) {
    Alert.alert('Save Failed', e.message || String(e));
  }
};

  // Remove a cigar from Favorite/Rarest and persist
  const handleRemoveCigar = async (listType, cigarId) => {
    if (!isOwnProfile) return;
    try {
      const field = listType === 'favorite' ? 'favoriteCigars' : 'rarestCigars';
      const current = listType === 'favorite' ? favoriteCigars : rarestCigars;
      const next = current.filter(it => {
        const id = it?.id || it?.cigarId || it?.masterId || it?.cigar_id;
        return id !== cigarId;
      });
      const fpRef = doc(db, 'users', viewedUserId, 'full_profile', 'profile');
      await setDoc(fpRef, { [field]: next }, { merge: true });
      if (listType === 'favorite') setFavoriteCigars(next);
      else setRarestCigars(next);
    } catch (e) {
      Alert.alert('Remove Failed', e.message || String(e));
    }
  };

  // --- Humidor Picker helpers ---
  const openHumidorPicker = async (listType) => {
    try {
      setPendingListType(listType);
      setHumidorsLoading(true);
      setHumidors([]);
      setSelectedHumidorId(null);
      const humRef = collection(db, 'users', viewedUserId, 'humidors');
      const snap = await getDocs(humRef);
      const list = snap.docs.map(d => ({ id: d.id, name: d.data().name || d.data().title || 'Humidor' }));
      setHumidors(list);
      setHumidorsModalVisible(true);
    } catch (e) {
      Alert.alert('Load Failed', e.message || String(e));
    } finally {
      setHumidorsLoading(false);
    }
  };

  const handleHumidorChosen = async (humidor) => {
    try {
      setHumidorsModalVisible(false);
      if (!humidor?.id) return;
      // Fetch that humidor's contents to pass along
      const cigarsCol1 = collection(db, 'users', viewedUserId, 'humidors', humidor.id, 'cigars');
      const snap1 = await getDocs(cigarsCol1);

      let cigars = snap1.docs.map(d => ({ id: d.id, ...d.data() }));

      // Fallback to legacy subcollection name if empty
      if (!cigars.length) {
        const cigarsCol2 = collection(db, 'users', viewedUserId, 'humidors', humidor.id, 'humidor_cigars');
        const snap2 = await getDocs(cigarsCol2);
        cigars = snap2.docs.map(d => ({ id: d.id, ...d.data() }));
      }

      navigation.navigate('HumidorAdditions', {
        selectionMode: true,
        userId: viewedUserId,
        listType: pendingListType, // 'favorite' | 'rarest'
        humidorId: humidor.id,
        humidorName: humidor.name,
        initialHumidorCigars: cigars,
      });
    } catch (e) {
      Alert.alert('Open Humidor Failed', e.message || String(e));
    }
  };


  const TILE_SIZE = (width - 20 - 20 - 16) / 3; // margins + gaps for 3 columns

  const renderCigarTile = ({ item, index, listType }) => {
    if (item.__add__) {
      return (
        <View
          style={[
            styles.cigarTile,
            {
              width: TILE_SIZE,
              height: TILE_SIZE,
              backgroundColor: 'transparent',
              justifyContent: 'center',
              alignItems: 'center',
              borderWidth: 0,
            },
          ]}
        >
          <TouchableOpacity
            onPress={() => openHumidorPicker(listType)}
            style={[
              styles.plusCircle,
              { borderColor: theme.border, backgroundColor: theme.background },
            ]}
          >
            <Text style={[styles.plusText, { color: theme.text }]}>+</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View 
        style={[
          styles.cigarTile,
          {
            width: TILE_SIZE,
            height: TILE_SIZE,
            borderColor: theme.border,
            backgroundColor: theme.background,
          },
        ]}
      >
        {isOwnProfile && (
          <TouchableOpacity
            onPress={() => handleRemoveCigar(listType, item.id)}
            style={[
              styles.cigarDeleteBtn,
              { backgroundColor: '#ffffff', borderColor: theme.border }
            ]}
            hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          >
            <Ionicons name="trash-outline" size={14} color="#222222" />
          </TouchableOpacity>
        )}
        {item?.image || item?.image_url ? (
          <Image source={{ uri: item.image || item.image_url }} style={styles.cigarTileImage} />
        ) : (
          <View style={[styles.cigarTileImage, { backgroundColor: '#bbb' }]} />
        )}
        <Text style={[styles.cigarTileLabel, { color: theme.text }]} numberOfLines={2}>
          {item?.name || 'Unknown'}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Back Button */}
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: theme.primary }]}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={theme.iconOnPrimary} />
        </TouchableOpacity>

        {/* Background Header Image */}
        {isOwnProfile ? (
          <TouchableOpacity onPress={() => handleImagePick('background')} activeOpacity={0.7}>
            <View style={[styles.headerImage, { backgroundColor: isDarkMode ? theme.card : '#ddd' }]}>
              {bgUri ? (
                <Image source={{ uri: bgUri }} style={styles.headerImage} />
              ) : (
                <Text style={[styles.uploadText, { color: theme.text }]}>Upload Cover Photo</Text>
              )}
            </View>
          </TouchableOpacity>
        ) : (
          <View style={[styles.headerImage, { backgroundColor: isDarkMode ? theme.card : '#ddd' }]}>
            {bgUri ? (
              <Image source={{ uri: bgUri }} style={styles.headerImage} />
            ) : (
              // Non-owners: show nothing (no placeholder text)
              <View />
            )}
          </View>
        )}

        {/* Profile Avatar */}
        {isOwnProfile ? (
          <TouchableOpacity
            onPress={() => handleImagePick('avatar')}
            activeOpacity={0.7}
            style={[styles.avatarWrapper, { backgroundColor: isDarkMode ? theme.card : '#eee' }]}
          >
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatarEmpty, { backgroundColor: isDarkMode ? theme.card : '#eee' }]}>
                <Ionicons name="camera-outline" size={20} color={theme.text} />
                <Text style={[styles.avatarUploadText, { color: theme.text }]}>Upload Profile Photo</Text>
              </View>
            )}
          </TouchableOpacity>
        ) : (
          <View style={[styles.avatarWrapper, { backgroundColor: isDarkMode ? theme.card : '#eee' }]}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatar} />
            ) : (
              // Non-owners: render an empty placeholder without prompts
              <View style={styles.avatar} />
            )}
          </View>
        )}

        {/* Name + Owner-only edit hint */}
        <View style={[styles.titleRow, { marginTop: HEADER_HEIGHT - 130, marginLeft: 20 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 1 }}>
            <Text style={[styles.nameText, { color: theme.text }]} numberOfLines={1}>
              {name}
            </Text>
            {profile?.subscriptionPlan === 'paid' && (
              <Ionicons name="checkmark-circle" size={18} color={theme.primary} style={{ marginLeft: 4 }} />
            )}
            <Text style={[styles.joinedText, { color: theme.text }]}>{joinedLabel}</Text>
          </View>
        </View>

        {/* Meta row: Years Smoked, Location, Followers */}
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <MaterialIcons name="people" size={16} color={theme.text} style={styles.metaIcon} />
            <Text style={[styles.metaText, { color: theme.text }]}>{followers} followers • {following} following</Text>
          </View>
        </View>

        {/* Bio / About (editable by owner) */}
        {bioText ? (
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginHorizontal: 20, marginTop: 12 }}>
            <Text style={[styles.bioText, { color: theme.text, flex: 1 }]}>{bioText}</Text>
            {isOwnProfile && (
              <TouchableOpacity
                onPress={() => { setEditField('bio'); setEditText(bioText); setEditVisible(true); }}
                style={{ marginLeft: 8, paddingTop: 2 }}
              >
                <Ionicons name="pencil" size={16} color={theme.text} />
              </TouchableOpacity>
            )}
          </View>
        ) : (
          isOwnProfile ? (
            <TouchableOpacity
              onPress={() => { setEditField('bio'); setEditText(''); setEditVisible(true); }}
              style={{ marginHorizontal: 20, marginTop: 12 }}
            >
              <Text style={{ color: theme.primary }}>Add a description</Text>
            </TouchableOpacity>
          ) : null
        )}

        {/* Details Card */}
        <View style={[styles.detailsCard, { backgroundColor: theme.background, borderColor: theme.border }]}>
          <View style={styles.detailRow}>
            <MaterialIcons name="timeline" size={18} color={theme.text} style={styles.detailIcon} />
            <Text style={[styles.detailLabel, { color: theme.text }]}>Years Smoked</Text>
            <Text style={[styles.detailValue, { color: theme.text }]}>{yearsSmoked ?? '—'}</Text>
            {isOwnProfile && (
              <TouchableOpacity onPress={() => { setEditField('yearsSmoked'); setEditText(yearsSmoked?.toString() || ''); setEditVisible(true); }}>
                <Ionicons name="pencil" size={16} color={theme.text} />
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.detailRow}>
            <MaterialIcons name="workspace-premium" size={18} color={theme.text} style={styles.detailIcon} />
            <Text style={[styles.detailLabel, { color: theme.text }]}>Experience</Text>
            <Text style={[styles.detailValue, { color: theme.text }]}>{experienceLabel}</Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="location-outline" size={18} color={theme.text} style={styles.detailIcon} />
            <Text style={[styles.detailLabel, { color: theme.text }]}>Location</Text>
            <Text style={[styles.detailValue, { color: theme.text }]} numberOfLines={2}>
              {location || '—'}
            </Text>
            {isOwnProfile && (
              <TouchableOpacity onPress={() => { setLocationEditVisible(true); }}>
                <Ionicons name="pencil" size={16} color={theme.text} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Favorite Cigars Section */}
        <View style={{ marginTop: 16 }}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Favorite Cigars</Text>
          {favoriteCigars.length === 0 && isOwnProfile ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: 20 }}>
              <Text style={{ color: theme.text, opacity: 0.7, marginRight: 10 }}>
                Add your favorite cigar
              </Text>
              {isOwnProfile && (
                <TouchableOpacity onPress={() => openHumidorPicker('favorite')}>
                  <Text style={[styles.plusText, { color: theme.text }]}>+</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : null}

          <FlatList
            data={[...favoriteCigars, ...(isOwnProfile ? [{ __add__: true, id: '__fav_add__' }] : [])]}
            keyExtractor={(item, idx) => item.id ? `fav-${item.id}` : `fav-add-${idx}`}
            numColumns={3}
            contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 6 }}
            columnWrapperStyle={{ justifyContent: 'flex-start', gap: 8 }}
            renderItem={({ item, index }) => renderCigarTile({ item, index, listType: 'favorite' })}
          />
        </View>

        {/* Rarest Cigars Section */}
        <View style={{ marginTop: 14 }}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Rarest Cigars</Text>
          {rarestCigars.length === 0 && isOwnProfile ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: 20 }}>
              <Text style={{ color: theme.text, opacity: 0.7, marginRight: 10 }}>
                Add your rarest cigar
              </Text>
              {isOwnProfile && (
                <TouchableOpacity onPress={() => openHumidorPicker('rarest')}>
                  <Text style={[styles.plusText, { color: theme.text }]}>+</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : null}

          <FlatList
            data={[...rarestCigars, ...(isOwnProfile ? [{ __add__: true, id: '__rare_add__' }] : [])]}
            keyExtractor={(item, idx) => item.id ? `rare-${item.id}` : `rare-add-${idx}`}
            numColumns={3}
            contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 6 }}
            columnWrapperStyle={{ justifyContent: 'flex-start', gap: 8 }}
            renderItem={({ item, index }) => renderCigarTile({ item, index, listType: 'rarest' })}
          />
        </View>

        {false && (
          <>
            {/* Favorite Drink Pairings Section */}
            <View style={{ marginTop: 16 }}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Favorite Drink Pairings
              </Text>
              {favoriteDrinks.length === 0 ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: 20 }}>
                  <Text style={{ color: theme.muted }}>No pairings added yet</Text>
                </View>
              ) : (
                favoriteDrinks.map((pairing, index) => (
                  <View key={index} style={{ marginHorizontal: 20, marginVertical: 8 }}>
                    <Text style={{ color: theme.text }}>
                      {pairing.cigarName} — {pairing.drink}
                    </Text>
                  </View>
                ))
              )}
            </View>
          </>
        )}

        {/* Add Drink Modal */}
        {isOwnProfile && (
          <Modal
            visible={drinkModalVisible}
            transparent
            animationType="slide"
            onRequestClose={() => setDrinkModalVisible(false)}
          >
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={{ flex: 1, justifyContent: 'flex-end' }}
            >
              <TouchableWithoutFeedback onPress={() => setDrinkModalVisible(false)}>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.15)' }} />
              </TouchableWithoutFeedback>
              <View style={[styles.sheet, { backgroundColor: theme.background, borderColor: theme.border }] }>
                <View className="grabber" style={styles.sheetGrabber} />
                <Text style={[styles.sheetTitle, { color: theme.text }]}>Add Favorite Drink Pairing</Text>
                <Text style={[styles.sheetHint, { color: theme.text }]}>Enter the drink name (e.g., "Coffee", "Bourbon", "Port").</Text>
                <TextInput
                  value={drinkInput}
                  onChangeText={setDrinkInput}
                  placeholder="e.g. Bourbon"
                  placeholderTextColor={theme.text}
                  style={[styles.sheetInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background } ]}
                  autoFocus
                />
                <View style={styles.sheetActions}>
                  <TouchableOpacity onPress={() => setDrinkModalVisible(false)} style={[styles.sheetBtn, { borderColor: theme.border }]}>
                    <Text style={{ color: theme.text }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={saveDrink} style={[styles.sheetBtnPrimary, { backgroundColor: theme.primary }]}>
                    <Text style={{ color: theme.iconOnPrimary }}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </KeyboardAvoidingView>
          </Modal>
        )}

        {/* Favorite Cigar–Drink Pairings Section */}
        <View style={{ marginTop: 16 }}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Favorite Pairings</Text>
          {favoritePairs.length === 0 && isOwnProfile ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: 20 }}>
              <Text style={{ color: theme.text, opacity: 0.7, marginRight: 10 }}>
                Add a cigar–drink pairing
              </Text>
              {isOwnProfile && (
                <TouchableOpacity onPress={openPairingFlow}>
                  <Text style={[styles.plusText, { color: theme.text }]}>+</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : null}

          <FlatList
            data={[...favoritePairs, ...(isOwnProfile ? [{ __add__: true, id: '__pair_add__' }] : [])]}
            keyExtractor={(item, idx) => item.id ? `pair-${item.id}` : `pair-add-${idx}`}
            numColumns={2}
            contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 6 }}
            columnWrapperStyle={{ justifyContent: 'flex-start', gap: 12 }}
            renderItem={({ item }) => {
              if (item.__add__) {
                return (
                  <View
                    style={[
                      styles.cigarTile,
                      {
                        width: TILE_SIZE,
                        height: TILE_SIZE,
                        backgroundColor: 'transparent',
                        justifyContent: 'center',
                        alignItems: 'center',
                        borderWidth: 0,
                      },
                    ]}
                  >
                    <TouchableOpacity
                      onPress={openPairingFlow}
                      style={[
                        styles.plusCircle,
                        { borderColor: theme.border, backgroundColor: theme.background },
                      ]}
                    > 
                      <Text style={[styles.plusText, { color: theme.text }]}>+</Text>
                    </TouchableOpacity>
                  </View>
                );
              }
              const tileW = (width - 20 - 20 - 12) / 2;
              return (
                <View style={[styles.cigarTile, { width: tileW, height: 140, borderColor: theme.border, backgroundColor: theme.background }]}>
                  {isOwnProfile && (
                    <TouchableOpacity
                      onPress={() => handleRemovePair(item.id)}
                      style={[styles.cigarDeleteBtn, { backgroundColor: '#ffffff', borderColor: theme.border }]}
                      hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                    >
                      <Ionicons name="trash-outline" size={14} color="#222222" />
                    </TouchableOpacity>
                  )}
                  {item.cigar?.image ? (
                    <Image source={{ uri: item.cigar.image }} style={[styles.cigarTileImage, { height: '60%' }]} />
                  ) : (
                    <View style={[styles.cigarTileImage, { height: '60%', backgroundColor: '#bbb' }]} />
                  )}
                  <Text style={[styles.cigarTileLabel, { color: theme.text }]} numberOfLines={1}>
                    {item.cigar?.name || 'Cigar'}
                  </Text>
                  <Text style={[styles.cigarTileLabel, { color: theme.text, opacity: 0.8 }]} numberOfLines={1}>
                    with {item.drink || '—'}
                  </Text>
                </View>
              );
            }}
          />
        </View>

        {/* Add Pairing Modal */}
        {isOwnProfile && (
          <Modal
            visible={pairModalVisible}
            transparent
            animationType="slide"
            onRequestClose={() => setPairModalVisible(false)}
          >
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={{ flex: 1, justifyContent: 'flex-end' }}
            >
              <TouchableWithoutFeedback onPress={() => setPairModalVisible(false)}>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.15)' }} />
              </TouchableWithoutFeedback>
              <View style={[styles.sheet, { backgroundColor: theme.background, borderColor: theme.border }] }>
                <View style={styles.sheetGrabber} />
                <Text style={[styles.sheetTitle, { color: theme.text }]}>Add Cigar–Drink Pairing</Text>
                {pairingPendingCigar ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                    {pairingPendingCigar.image ? (
                      <Image source={{ uri: pairingPendingCigar.image }} style={{ width: 36, height: 36, borderRadius: 6, marginRight: 8 }} />
                    ) : (
                      <View style={{ width: 36, height: 36, borderRadius: 6, marginRight: 8, backgroundColor: '#bbb' }} />
                    )}
                    <Text style={{ color: theme.text, fontWeight: '600', flex: 1 }} numberOfLines={1}>{pairingPendingCigar.name}</Text>
                  </View>
                ) : null}
                <Text style={[styles.sheetHint, { color: theme.text }]}>Enter the drink to pair with this cigar (e.g., "Bourbon", "Coffee").</Text>
                <TextInput
                  value={pairDrinkInput}
                  onChangeText={setPairDrinkInput}
                  placeholder="e.g. Bourbon"
                  placeholderTextColor={theme.text}
                  style={[styles.sheetInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background } ]}
                  autoFocus
                />
                <View style={styles.sheetActions}>
                  <TouchableOpacity onPress={() => setPairModalVisible(false)} style={[styles.sheetBtn, { borderColor: theme.border }] }>
                    <Text style={{ color: theme.text }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={savePair} style={[styles.sheetBtnPrimary, { backgroundColor: theme.primary }]}>
                    <Text style={{ color: theme.iconOnPrimary }}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </KeyboardAvoidingView>
          </Modal>
        )}
        {/* Humidor Picker Bottom Sheet */}
        {isOwnProfile && (
          <Modal
            visible={humidorsModalVisible}
            transparent
            animationType="slide"
            onRequestClose={() => setHumidorsModalVisible(false)}
          >
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={{ flex: 1, justifyContent: 'flex-end' }}
            >
              <TouchableWithoutFeedback onPress={() => setHumidorsModalVisible(false)}>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.15)' }} />
              </TouchableWithoutFeedback>
              <View style={[styles.sheet, { backgroundColor: theme.background, borderColor: theme.border }] }>
                <View style={styles.sheetGrabber} />
                <Text style={[styles.sheetTitle, { color: theme.text, marginBottom: 8 }]}>Select a Humidor</Text>
                {humidorsLoading ? (
                  <Text style={{ color: theme.text, opacity: 0.7 }}>Loading…</Text>
                ) : humidors.length === 0 ? (
                  <Text style={{ color: theme.text, opacity: 0.7 }}>No humidors found.</Text>
                ) : (
                  <FlatList
                    data={humidors}
                    keyExtractor={(item) => item.id}
                    style={{ maxHeight: 300 }}
                    keyboardShouldPersistTaps="handled"
                    renderItem={({ item }) => {
                      const selected = selectedHumidorId === item.id;
                      return (
                        <TouchableOpacity
                          onPress={() => setSelectedHumidorId(selected ? null : item.id)}
                          style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: theme.border }}
                        >
                          <Ionicons
                            name={selected ? 'radio-button-on' : 'radio-button-off'}
                            size={20}
                            color={selected ? theme.primary : theme.text}
                            style={{ marginRight: 10 }}
                          />
                          <Text style={{ color: theme.text, flex: 1 }}>{item.name}</Text>
                        </TouchableOpacity>
                      );
                    }}
                  />
                )}
                <View style={[styles.sheetActions, { justifyContent: 'space-between' }]}>
                  <TouchableOpacity onPress={() => setHumidorsModalVisible(false)} style={[styles.sheetBtn, { borderColor: theme.border }]}>
                    <Text style={{ color: theme.text }}>Close</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    disabled={!selectedHumidorId}
                    onPress={() => {
                      const chosen = humidors.find(h => h.id === selectedHumidorId);
                      if (chosen) handleHumidorChosen(chosen);
                    }}
                    style={[styles.sheetBtnPrimary, { backgroundColor: selectedHumidorId ? theme.primary : theme.border }]}
                  >
                    <Text style={{ color: selectedHumidorId ? theme.iconOnPrimary : theme.text }}>Continue</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </KeyboardAvoidingView>
          </Modal>
        )}


        {/* Edit Bottom Sheet */}
        {isOwnProfile && (
          <Modal
            visible={editVisible}
            transparent
            animationType="slide"
            onRequestClose={() => setEditVisible(false)}
          >
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={{ flex: 1, justifyContent: 'flex-end' }}
            >
              <TouchableWithoutFeedback onPress={() => setEditVisible(false)}>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.15)' }} />
              </TouchableWithoutFeedback>
              <View style={[styles.sheet, { backgroundColor: theme.background, borderColor: theme.border }] }>
                <View style={styles.sheetGrabber} />
                <View style={styles.sheetTitleRow}>
                  <Text style={[styles.sheetTitle, { color: theme.text }] }>
                    {editField === 'yearsSmoked'
                      ? 'Edit Years Smoked'
                      : 'Edit Description'}
                  </Text>
                </View>

                <Text style={[styles.sheetHint, { color: theme.text }]}>
                  {editField === 'yearsSmoked' ? 'Enter a number' : 'Write a short description'}
                </Text>

                <TextInput
                  value={editText}
                  onChangeText={setEditText}
                  placeholder={editField === 'yearsSmoked' ? 'e.g. 5' : 'Tell people about yourself...'}
                  placeholderTextColor={theme.text}
                  style={[styles.sheetInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background } ]}
                  keyboardType={editField === 'yearsSmoked' ? 'numeric' : 'default'}
                  multiline={editField !== 'yearsSmoked'}
                  numberOfLines={editField === 'yearsSmoked' ? 1 : 4}
                  autoFocus
                />

                <View style={styles.sheetActions}>
                  <TouchableOpacity onPress={() => setEditVisible(false)} style={[styles.sheetBtn, { borderColor: theme.border }]}>
                    <Text style={{ color: theme.text }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={saveFullProfileField} style={[styles.sheetBtnPrimary, { backgroundColor: theme.primary }]}>
                    <Text style={{ color: theme.iconOnPrimary }}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </KeyboardAvoidingView>
          </Modal>
        )}

        {/* Location Picker Bottom Sheet */}
        {isOwnProfile && (
          <Modal
            visible={locationEditVisible}
            transparent
            animationType="slide"
            onRequestClose={() => setLocationEditVisible(false)}
          >
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={{ flex: 1, justifyContent: 'flex-end' }}
            >
              <TouchableWithoutFeedback onPress={() => setLocationEditVisible(false)}>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.15)' }} />
              </TouchableWithoutFeedback>
              <View style={[styles.sheet, { backgroundColor: theme.background, borderColor: theme.border }]}>
                <View style={styles.sheetGrabber} />
                <Text style={[styles.sheetTitle, { color: theme.text, marginBottom: 8 }]}>Choose Location</Text>
                <TextInput
                  value={cityQuery}
                  onChangeText={setCityQuery}
                  placeholder="Search for a city..."
                  placeholderTextColor={theme.text}
                  style={[styles.sheetInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
                  autoFocus
                />
                {(!cityQuery || cityQuery.trim().length < 2) ? (
                  <Text style={{ color: theme.text, opacity: 0.6, marginTop: 10 }}>Type at least 2 characters…</Text>
                ) : (
                  <FlatList
                    data={filteredCities}
                    keyExtractor={(item, idx) => item.id ? String(item.id) : `${item.name}-${item.state_code || item.state_name}-${idx}`}
                    style={{ maxHeight: 260, marginTop: 8 }}
                    keyboardShouldPersistTaps="handled"
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        onPress={() => handleSelectCity(item)}
                        style={{ paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: theme.border }}
                      >
                        <Text style={{ color: theme.text }}>{formatCityLabel(item)}</Text>
                      </TouchableOpacity>
                    )}
                    ListEmptyComponent={<Text style={{ color: theme.text, opacity: 0.6, marginTop: 8 }}>No results</Text>}
                  />
                )}
                <View style={styles.sheetActions}>
                  <TouchableOpacity onPress={() => setLocationEditVisible(false)} style={[styles.sheetBtn, { borderColor: theme.border }]}>
                    <Text style={{ color: theme.text }}>Close</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </KeyboardAvoidingView>
          </Modal>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  backButton: {
    position: 'absolute',
    top: 20,
    left: 20,
    zIndex: 10,
    borderRadius: 20,
    padding: 6,
  },
  headerImage: {
    width: '100%',
    height: HEADER_HEIGHT,
    // backgroundColor intentionally set dynamically
    justifyContent: 'center',
  },
  avatarWrapper: {
    position: 'absolute',
    top: HEADER_HEIGHT - 70,
    left: 18,
    width: 100,
    height: 100,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#fff',
    // backgroundColor intentionally set dynamically
    zIndex: 5,
  },
  avatar: { width: '100%', height: '100%' },
  avatarEmpty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6 },
  avatarUploadText: { marginTop: 6, fontSize: 12, textAlign: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  nameText: { fontSize: 24, fontWeight: 'bold' },
  joinedText: { fontSize: 14, fontWeight: 'normal', opacity: 0.7 },

  metaRow: { flexDirection: 'row', marginLeft: 20, marginTop: 15, flexWrap: 'wrap' },
  metaItem: { flexDirection: 'row', alignItems: 'center', marginRight: 16, marginBottom: 6 },
  metaIcon: { marginRight: 4 },
  metaText: { fontSize: 14 },

  uploadText: { textAlign: 'center', marginTop: 35, marginLeft: 35 },

  detailsCard: { marginTop: 18, marginHorizontal: 20, borderWidth: 1, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12 },
  detailRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  detailIcon: { marginRight: 8 },
  detailLabel: { width: 120, fontSize: 14, fontWeight: '600' },
  detailValue: { flex: 1, fontSize: 14, lineHeight: 20 },

  bioText: { fontSize: 15, marginHorizontal: 20, marginTop: 12, lineHeight: 20 },   

  buttonRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 20, marginBottom: 10, columnGap: 40 },
  buttonWithLabel: { alignItems: 'center' },
  circleButton: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center' },
  buttonLabel: { marginTop: 6, fontSize: 14 },

  feedPostContainer: { borderWidth: 1, borderRadius: 10, padding: 14, marginHorizontal: 20, marginTop: 12, marginBottom: 0, backgroundColor: '#fff' },
  feedPostHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  feedPostProfileImage: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#ccc' },
  feedPostUserName: { fontSize: 15, fontWeight: 'bold' },
  feedPostDate: { fontSize: 12, marginTop: 2 },
  feedPostText: { fontSize: 15, marginBottom: 6, marginTop: 2, lineHeight: 20 },
  feedPostButtonsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, columnGap: 30 },
  feedPostButton: { flexDirection: 'row', alignItems: 'center', marginRight: 22 },
  feedPostButtonCount: { fontSize: 14 },
  modalOverlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  modalCard: { width: width * 0.9, borderWidth: 1, borderRadius: 12, padding: 16 },
  modalTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  modalBody: { marginTop: 6 },
  modalHint: { fontSize: 12, opacity: 0.7, marginBottom: 8 },
  modalInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10, minHeight: 44 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12, columnGap: 10 },
  modalBtn: { paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderRadius: 8 },
  modalBtnPrimary: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  sheetOverlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.15)' },
  sheet: { borderTopLeftRadius: 16, borderTopRightRadius: 16, borderWidth: 1, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 20 },
  sheetGrabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#999', marginBottom: 8 },
  sheetTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  sheetTitle: { fontSize: 16, fontWeight: '700' },
  sheetHint: { fontSize: 12, opacity: 0.7, marginBottom: 8 },
  sheetInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, maxHeight: 160, textAlignVertical: 'top' },
  sheetActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12, columnGap: 10 },
  sheetBtn: { paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderRadius: 8 },
  sheetBtnPrimary: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  sectionTitle: { marginHorizontal: 20, fontSize: 16, fontWeight: '700', marginBottom: 8 },
  cigarPillsRow: { paddingHorizontal: 16, columnGap: 10 },
  cigarItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 10, borderWidth: 1, borderRadius: 999, marginRight: 10 },
  cigarItemAvatar: { width: 32, height: 32, borderRadius: 16, marginRight: 8, backgroundColor: '#bbb' },
  cigarItemLabel: { maxWidth: 180, fontSize: 14 },
  plusCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  plusText: {
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 26,
    color: '#000',
  },

  cigarTile: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 8,
    marginBottom: 8,
    overflow: 'hidden'
  },
  cigarDeleteBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    borderWidth: 1,
    borderRadius: 10,
    padding: 4,
    zIndex: 2
  },
  cigarTileImage: {
    width: '100%',
    height: '72%',
    borderRadius: 8,
    marginBottom: 6
  },
  cigarTileLabel: {
    fontSize: 12,
    lineHeight: 14,
    textAlign: 'center',
  },

  // Bottom sheet chooser styles
  chooserSheet: { 
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 20
  },
  chooserActionBtnPrimary: {
    paddingVertical: 14,
    borderRadius: 10,
    marginHorizontal: 6,
    marginTop: 8
  },
  chooserActionBtn: {
    paddingVertical: 14,
    borderRadius: 10,
    marginHorizontal: 6,
    marginTop: 10,
    borderWidth: 1
  },
  chooserCancelBtn: {
    paddingVertical: 12,
    borderRadius: 10,
    marginHorizontal: 6,
    marginTop: 14,
    borderWidth: 1
  },
});