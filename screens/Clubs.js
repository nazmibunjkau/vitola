import { StyleSheet, Text, SafeAreaView, View, TextInput, TouchableOpacity, FlatList, ScrollView, Image, Modal, TouchableWithoutFeedback, KeyboardAvoidingView, Platform } from 'react-native'
import React from 'react'
import { useTheme } from '../context/ThemeContext'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import { getFirestore, collection, doc, getDoc, getDocs, onSnapshot, query, limit } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'
import { app } from '../firebase' // ensure this points to your initialized Firebase app

export default function Clubs() {
  // Cleanup all members listeners on unmount (must be inside component)
  React.useEffect(() => {
    return () => {
      const map = membersUnsubsRef.current;
      for (const [, unsub] of map.entries()) {
        try { if (typeof unsub === 'function') unsub(); } catch {}
      }
      map.clear();
    };
  }, []);
  const { theme } = useTheme()
  const [searchText, setSearchText] = React.useState('')
  const navigation = useNavigation()
  const db = getFirestore(app)
  const [clubsData, setClubsData] = React.useState([])
  // Realtime members count per club
  const [memberCounts, setMemberCounts] = React.useState({}); // { [clubId]: number }
  const membersUnsubsRef = React.useRef(new Map()); // clubId -> unsubscribe
  // Attach/detach subcollection listeners for members count
  const attachMembersListener = React.useCallback((clubId) => {
    const key = String(clubId);
    const map = membersUnsubsRef.current;
    if (map.has(key)) return; // already attached
    try {
      const colRef = collection(db, 'clubs', key, 'members');
      const unsub = onSnapshot(colRef, (snap) => {
        setMemberCounts((prev) => ({ ...prev, [key]: snap.size }));
      }, (err) => {
        console.warn('members listen error', key, err?.message || err);
      });
      map.set(key, unsub);
    } catch (e) {
      console.warn('attachMembersListener failed', key, e?.message || e);
    }
  }, [db]);

  const detachMembersListener = React.useCallback((clubId) => {
    const key = String(clubId);
    const map = membersUnsubsRef.current;
    if (!map.has(key)) return;
    try {
      const unsub = map.get(key);
      if (typeof unsub === 'function') unsub();
    } catch {}
    map.delete(key);
  }, []);

  const reconcileMemberListeners = React.useCallback((visibleIds) => {
    const want = new Set(visibleIds.map(String));
    const map = membersUnsubsRef.current;
    // Detach listeners for clubs no longer visible
    for (const [clubId, unsub] of map.entries()) {
      if (!want.has(clubId)) {
        try { if (typeof unsub === 'function') unsub(); } catch {}
        map.delete(clubId);
      }
    }
    // Attach listeners for new clubs
    visibleIds.forEach((id) => attachMembersListener(id));
  }, [attachMembersListener]);
  const auth = getAuth(app)
  const [subscriptionPlan, setSubscriptionPlan] = React.useState('free')

  // ---------- NEW: Filters state (Location / Type / Tags) ----------
  const [selectedLocation, setSelectedLocation] = React.useState(null);  // string|null
  const [selectedType, setSelectedType] = React.useState(null);          // string|null
  const [selectedTags, setSelectedTags] = React.useState([]);            // string[]

  const [showLocationModal, setShowLocationModal] = React.useState(false);
  const [showTypeModal, setShowTypeModal] = React.useState(false);
  const [showTagModal, setShowTagModal] = React.useState(false);

  const [locationQuery, setLocationQuery] = React.useState('');
  const [typeQuery, setTypeQuery] = React.useState('');
  const [tagQuery, setTagQuery] = React.useState('');

  // Accent/case-insensitive normalization
  const norm = (s) => (s ?? '').toString().toLowerCase().normalize('NFD').replace(/\u0300-\u036f/g, '')

  // ---------- NEW: derive available filter options from current list ----------
  // For parity with ProfileSearch.js, build "bases" that respect current query/partial selections.
  const baseForTypes = React.useMemo(() => {
    // Respect searchText and selectedLocation (but not selectedType yet)
    const q = norm(searchText.trim())
    let list = clubsData;
    if (q) {
      list = list.filter((c) => {
        const fields = [
          c?.name, c?.location, c?.ownerName, c?.type, c?.privacy,
          ...(Array.isArray(c?.tags) ? c.tags.map(String) : []),
        ];
        return fields.some((f) => norm(f).includes(q));
      });
    }
    if (selectedLocation) {
      list = list.filter(c => (c.location || '') === selectedLocation);
    }
    return list;
  }, [clubsData, searchText, selectedLocation]);

  const availableTypes = React.useMemo(() => {
    const set = new Set();
    baseForTypes.forEach(c => {
      const t = c?.type;
      if (Array.isArray(t)) t.forEach(x => x && set.add(String(x)));
      else if (t) set.add(String(t));
    });
    return Array.from(set).sort((a,b) => a.localeCompare(b));
  }, [baseForTypes]);

  const filteredTypes = React.useMemo(() => {
    if (!typeQuery.trim()) return availableTypes;
    const q = norm(typeQuery);
    return availableTypes.filter(t => norm(t).includes(q));
  }, [availableTypes, typeQuery]);

  // Locations list
  const availableLocations = React.useMemo(() => {
    const set = new Set((clubsData || []).map(c => (c.location || '').trim()).filter(Boolean));
    return Array.from(set).sort((a,b) => a.localeCompare(b));
  }, [clubsData]);

  const filteredLocations = React.useMemo(() => {
    if (!locationQuery.trim()) return availableLocations;
    const q = norm(locationQuery);
    return availableLocations.filter(loc => norm(loc).includes(q));
  }, [availableLocations, locationQuery]);

  // Tags list (respect searchText, location, type selections for better UX)
  const baseForTags = React.useMemo(() => {
    let list = baseForTypes;
    if (selectedType) {
      list = list.filter(club => {
        const t = club?.type;
        return Array.isArray(t) ? t.includes(selectedType) : (t || '') === selectedType;
      });
    }
    return list;
  }, [baseForTypes, selectedType]);

  const availableTags = React.useMemo(() => {
    const set = new Set();
    baseForTags.forEach(c => {
      if (Array.isArray(c?.tags)) c.tags.forEach(tag => tag && set.add(String(tag)));
    });
    return Array.from(set).sort((a,b) => a.localeCompare(b));
  }, [baseForTags]);

  const filteredTags = React.useMemo(() => {
    if (!tagQuery.trim()) return availableTags;
    const q = norm(tagQuery);
    return availableTags.filter(t => norm(t).includes(q));
  }, [availableTags, tagQuery]);

  // ---------- EXISTING: filtered list (now with filters applied) ----------
  const filteredClubs = React.useMemo(() => {
    const q = norm(searchText.trim())
    let list = clubsData
    if (q) {
      list = list.filter((c) => {
        const fields = [
          c?.name,
          c?.location,
          c?.ownerName,
          c?.type,
          c?.privacy,
          ...(Array.isArray(c?.tags) ? c.tags.map(String) : []),
        ]
        return fields.some((f) => norm(f).includes(q))
      })
    }
    if (selectedLocation) {
      list = list.filter(c => (c.location || '') === selectedLocation)
    }
    if (selectedType) {
      list = list.filter(c => {
        const t = c?.type
        return Array.isArray(t) ? t.includes(selectedType) : (t || '') === selectedType
      })
    }
    if (selectedTags && selectedTags.length > 0) {
      // Match if club has ANY of the selected tags
      list = list.filter(c => {
        if (!Array.isArray(c?.tags) || c.tags.length === 0) return false
        const set = new Set(c.tags.map(String))
        return selectedTags.some(tag => set.has(String(tag)))
      })
    }
    return list
  }, [clubsData, searchText, selectedLocation, selectedType, selectedTags])

  React.useEffect(() => {
    let unsub = null
    try {
      const q = query(collection(db, 'clubs'), limit(12));
      unsub = onSnapshot(q, async (snap) => {
        // Basic docs
        const raw = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        // Ensure the example club id is present (if it exists) by fetching it and merging it in
        const exampleId = 'y1olNAWz5krAbqCqECoH';
        const hasExample = raw.some(c => c.id === exampleId);
        let merged = raw;
        if (!hasExample) {
          try {
            const exSnap = await getDoc(doc(db, 'clubs', exampleId));
            if (exSnap.exists()) merged = [{ id: exSnap.id, ...exSnap.data() }, ...raw];
          } catch {}
        }
        // Shuffle client-side for variety, cap at 12
        const shuffled = [...merged].sort(() => Math.random() - 0.5).slice(0, 12);

        // Attach/detach realtime listeners for members on the visible set
        reconcileMemberListeners(shuffled.map(c => c.id));

        // Seed list with any known counts; these will auto-update via memberCounts effect below
        const seeded = shuffled.map((c) => ({
          ...c,
          membersCount: typeof memberCounts[c.id] === 'number' ? memberCounts[c.id] : (typeof c.membersCount === 'number' ? c.membersCount : 0),
        }));
        setClubsData(seeded);
      });
    } catch (e) {
      // fallback: no listener
    }
    return () => { try { unsub && unsub() } catch {} }
  }, [db, memberCounts, reconcileMemberListeners]);

  // When memberCounts change, merge them into clubsData so the UI updates instantly
  React.useEffect(() => {
    if (!clubsData || clubsData.length === 0) return;
    setClubsData((prev) => prev.map((c) => ({
      ...c,
      membersCount: typeof memberCounts[c.id] === 'number' ? memberCounts[c.id] : (c.membersCount || 0),
    })));
  }, [memberCounts]);

  const formatCreatedAt = (ts) => {
    try {
      const d = ts?.toDate ? ts.toDate() : (typeof ts === 'string' ? new Date(ts) : ts);
      if (!d || isNaN(d.getTime())) return '';
      return d.toLocaleDateString();
    } catch {
      return '';
    }
  };

  React.useEffect(() => {
    const u = auth.currentUser
    if (!u) return
    const userRef = doc(db, 'users', u.uid)
    const unsub = onSnapshot(userRef, (snap) => {
      const data = snap.exists() ? snap.data() : null
      const plan = (data && typeof data.subscriptionPlan === 'string') ? data.subscriptionPlan : 'free'
      setSubscriptionPlan(plan)
    }, (err) => {
      console.warn('user plan listen error', err)
      setSubscriptionPlan('free')
    })
    return () => { try { unsub && unsub() } catch {} }
  }, [auth, db])

  const anyFilterActive = !!(selectedLocation || selectedType || (selectedTags && selectedTags.length));

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Title */}
        <View style={styles.titleRow}>
          <Image source={require('../img/logo.png')} style={styles.titleLogo} />
          <Text style={[styles.screenTitle, { color: theme.text }]}>Vitola Clubs</Text>
        </View>
        {/* Search bar */}
        <View style={[styles.searchBar, { borderColor: theme.primary, backgroundColor: theme.accent }]}>
          <Ionicons name="search" size={18} color={theme.placeholder} style={{ marginRight: 8 }} />
          <TextInput
            style={{ flex: 1, color: theme.text }}
            placeholder="Search clubs..."
            placeholderTextColor={theme.placeholder}
            value={searchText}
            onChangeText={setSearchText}
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => setSearchText('')}>
              <Ionicons name="close-circle" size={18} color="red" />
            </TouchableOpacity>
          )}
        </View>

        {/* Create Club section */}
        <View style={styles.divider} />
        <View style={styles.createRow}>
          <Text style={[styles.createText, { color: theme.text }]}>Create your own Vitola club</Text>
          <TouchableOpacity
            style={[styles.createButton, { backgroundColor: theme.primary, opacity: 1 }]}
            onPress={() => {
              if (subscriptionPlan === 'paid') {
                navigation.navigate('ClubAdditions')
              } else {
                navigation.navigate('Upgrade')
              }
            }}
          >
            <Text style={[styles.createButtonText, { color: theme.iconOnPrimary }]}>Create Club</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.divider} />

        {/* ---------- NEW: Filters (Location / Type / Tags) ---------- */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, marginBottom: 8 }}>
          {/* Location Filter (compact chip) */}
          <TouchableOpacity
            onPress={() => setShowLocationModal(true)}
            activeOpacity={0.8}
            style={{
              flex: 1,
              marginRight: 6,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: theme.primary,
              paddingVertical: 6,
              paddingHorizontal: 8,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="location-outline" size={16} color={theme.primary} style={{ marginRight: 4 }} />
              <Text
                style={{ color: theme.primary, fontWeight: '500', fontSize: 12, maxWidth: '95%' }}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {selectedLocation ? selectedLocation : 'Location'}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Club Type Filter (compact chip) */}
          <TouchableOpacity
            onPress={() => setShowTypeModal(true)}
            activeOpacity={0.8}
            style={{
              flex: 1,
              marginHorizontal: 6,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: theme.primary,
              paddingVertical: 6,
              paddingHorizontal: 8,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text
              style={{ color: theme.primary, fontWeight: '500', fontSize: 12 }}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {selectedType ? selectedType : 'Club Type'}
            </Text>
          </TouchableOpacity>

          {/* Tags Filter (compact chip) */}
          <TouchableOpacity
            onPress={() => setShowTagModal(true)}
            activeOpacity={0.8}
            style={{
              flex: 1,
              marginLeft: 6,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: theme.primary,
              paddingVertical: 6,
              paddingHorizontal: 8,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="pricetags-outline" size={16} color={theme.primary} style={{ marginRight: 4 }} />
              <Text style={{ color: theme.primary, fontWeight: '500', fontSize: 12 }} numberOfLines={1} ellipsizeMode="tail">
                {selectedTags.length > 0 ? `${selectedTags.length} tag${selectedTags.length > 1 ? 's' : ''}` : 'Tags'}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Clear all (small icon) */}
          {anyFilterActive && (
            <TouchableOpacity
              onPress={() => {
                setSelectedLocation(null);
                setSelectedType(null);
                setSelectedTags([]);
                setLocationQuery('');
                setTypeQuery('');
                setTagQuery('');
              }}
              style={{ marginLeft: 6, paddingHorizontal: 2, justifyContent: 'center', alignItems: 'center' }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="Clear filters"
            >
              <Ionicons name="close-circle" size={20} color="#d32f2f" />
            </TouchableOpacity>
          )}
        </View>

        {/* Thin divider like ProfileSearch */}
        <View style={{ height: 0.47, backgroundColor: theme.primary, alignSelf: 'stretch', marginBottom: 6 }} />

        {/* Location Picker Modal */}
        <Modal visible={showLocationModal} transparent animationType="slide" onRequestClose={() => setShowLocationModal(false)}>
          <TouchableWithoutFeedback onPress={() => setShowLocationModal(false)}>
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
              {/* Stop propagation inside sheet */}
              <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={0}
                style={{ width: '100%' }}
              >
                <TouchableWithoutFeedback onPress={() => {}}>
                  <View style={{ backgroundColor: theme.background, maxHeight: '100%', borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 20 }}>
                  <View style={{ alignItems: 'center', paddingVertical: 6 }}>
                    <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: theme.border }} />
                  </View>
                  <Text style={{ color: theme.text, fontSize: 16, fontWeight: '600', marginBottom: 10 }}>Choose Location</Text>

                  {/* Search bar */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: theme.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 10 }}>
                    <Ionicons name="search" size={18} color={theme.text} style={{ marginRight: 6 }} />
                    <TextInput
                      value={locationQuery}
                      onChangeText={setLocationQuery}
                      placeholder="Search location..."
                      placeholderTextColor={theme.placeholder}
                      style={{ flex: 1, color: theme.text, fontSize: 15 }}
                      returnKeyType="search"
                    />
                    {locationQuery.length > 0 && (
                      <TouchableOpacity onPress={() => setLocationQuery('')}>
                        <Ionicons name="close-circle" size={18} color={theme.text} />
                      </TouchableOpacity>
                    )}
                  </View>

                  <FlatList
                    data={[...(selectedLocation ? ['Clear location'] : []), ...filteredLocations]}
                    keyExtractor={(item, idx) => item + idx}
                    keyboardShouldPersistTaps="handled"
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        onPress={() => {
                          if (item === 'Clear location') setSelectedLocation(null); else setSelectedLocation(item);
                          setShowLocationModal(false);
                          setLocationQuery('');
                        }}
                        style={{ paddingVertical: 12 }}
                      >
                        <Text style={{ color: item === 'Clear location' ? '#d32f2f' : theme.text, fontSize: 16 }}>{item}</Text>
                      </TouchableOpacity>
                    )}
                  />
                  </View>
                </TouchableWithoutFeedback>
              </KeyboardAvoidingView>
            </View>
          </TouchableWithoutFeedback>
        </Modal>

        {/* Club Type Picker Modal */}
        <Modal visible={showTypeModal} transparent animationType="slide" onRequestClose={() => setShowTypeModal(false)}>
          <TouchableWithoutFeedback onPress={() => setShowTypeModal(false)}>
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
              <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={0}
                style={{ width: '100%' }}
              >
                <TouchableWithoutFeedback onPress={() => {}}>
                  <View style={{ backgroundColor: theme.background, maxHeight: '100%', borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 20 }}>
                  <View style={{ alignItems: 'center', paddingVertical: 6 }}>
                    <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: theme.border }} />
                  </View>
                  <Text style={{ color: theme.text, fontSize: 16, fontWeight: '600', marginBottom: 10 }}>Choose Club Type</Text>

                  {/* Search bar for types */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: theme.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 10 }}>
                    <Ionicons name="search" size={18} color={theme.text} style={{ marginRight: 6 }} />
                    <TextInput
                      value={typeQuery}
                      onChangeText={setTypeQuery}
                      placeholder="Search club type..."
                      placeholderTextColor={theme.placeholder}
                      style={{ flex: 1, color: theme.text, fontSize: 15 }}
                      returnKeyType="search"
                    />
                    {typeQuery.length > 0 && (
                      <TouchableOpacity onPress={() => setTypeQuery('')}>
                        <Ionicons name="close-circle" size={18} color={theme.text} />
                      </TouchableOpacity>
                    )}
                  </View>

                  <FlatList
                    data={[...(selectedType ? ['Clear type'] : []), ...filteredTypes]}
                    keyExtractor={(item, idx) => item + idx}
                    ListEmptyComponent={() => (
                      <Text style={{ color: theme.placeholder, textAlign: 'center', paddingVertical: 16 }}>No types found</Text>
                    )}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        onPress={() => {
                          if (item === 'Clear type') setSelectedType(null); else setSelectedType(item);
                          setShowTypeModal(false);
                          setTypeQuery('');
                        }}
                        style={{ paddingVertical: 12 }}
                      >
                        <Text style={{ color: item === 'Clear type' ? '#d32f2f' : theme.text, fontSize: 16 }}>{item}</Text>
                      </TouchableOpacity>
                    )}
                  />
                  </View>
                </TouchableWithoutFeedback>
              </KeyboardAvoidingView>
            </View>
          </TouchableWithoutFeedback>
        </Modal>

        {/* Tags Picker Modal (multi-select) */}
        <Modal visible={showTagModal} transparent animationType="slide" onRequestClose={() => setShowTagModal(false)}>
          <TouchableWithoutFeedback onPress={() => setShowTagModal(false)}>
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
              <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={0}
                style={{ width: '100%' }}
              >
                <TouchableWithoutFeedback onPress={() => {}}>
                  <View style={{ backgroundColor: theme.background, maxHeight: '100%', borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 20 }}>
                  <View style={{ alignItems: 'center', paddingVertical: 6 }}>
                    <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: theme.border }} />
                  </View>
                  <Text style={{ color: theme.text, fontSize: 16, fontWeight: '600', marginBottom: 10 }}>Choose Tags</Text>

                  {/* Search bar for tags */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: theme.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 10 }}>
                    <Ionicons name="search" size={18} color={theme.text} style={{ marginRight: 6 }} />
                    <TextInput
                      value={tagQuery}
                      onChangeText={setTagQuery}
                      placeholder="Search tags..."
                      placeholderTextColor={theme.placeholder}
                      style={{ flex: 1, color: theme.text, fontSize: 15 }}
                      returnKeyType="search"
                    />
                    {tagQuery.length > 0 && (
                      <TouchableOpacity onPress={() => setTagQuery('')}>
                        <Ionicons name="close-circle" size={18} color={theme.text} />
                      </TouchableOpacity>
                    )}
                  </View>

                  <FlatList
                    data={[...(selectedTags.length ? ['Clear tags'] : []), ...filteredTags]}
                    keyExtractor={(item, idx) => item + idx}
                    renderItem={({ item }) => {
                      const isClear = item === 'Clear tags';
                      const checked = selectedTags.includes(item);
                      return (
                        <TouchableOpacity
                          onPress={() => {
                            if (isClear) {
                              setSelectedTags([]);
                            } else {
                              setSelectedTags((prev) => (
                                prev.includes(item) ? prev.filter(t => t !== item) : [...prev, item]
                              ));
                            }
                          }}
                          style={{ paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                        >
                          <Text style={{ color: isClear ? '#d32f2f' : theme.text, fontSize: 16 }}>{item}</Text>
                          {!isClear && (
                            <Ionicons
                              name={checked ? 'checkbox' : 'square-outline'}
                              size={20}
                              color={checked ? theme.primary : theme.text}
                            />
                          )}
                        </TouchableOpacity>
                      );
                    }}
                    ListEmptyComponent={() => (
                      <Text style={{ color: theme.placeholder, textAlign: 'center', paddingVertical: 16 }}>No tags found</Text>
                    )}
                  />

                  {/* Done button */}
                  <TouchableOpacity
                    onPress={() => setShowTagModal(false)}
                    style={{ marginTop: 8, alignSelf: 'flex-end', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 6, backgroundColor: theme.primary }}
                  >
                    <Text style={{ color: theme.iconOnPrimary, fontWeight: '600' }}>Done</Text>
                  </TouchableOpacity>
                  </View>
                </TouchableWithoutFeedback>
              </KeyboardAvoidingView>
            </View>
          </TouchableWithoutFeedback>
        </Modal>

        {/* Clubs list */}
        <FlatList
          data={filteredClubs}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                const createdAtISO = item?.createdAt?.toDate ? item.createdAt.toDate().toISOString() : (typeof item?.createdAt === 'string' ? item.createdAt : null)
                navigation.navigate('ClubDetails', {
                  clubId: item.id,
                  club: {
                    id: item.id,
                    name: item.name || 'Untitled Club',
                    image: item.image || null,
                    ownerName: item.ownerName || null,
                    ownerId: item.ownerId || null,
                    membersCount: typeof item.membersCount === 'number' ? item.membersCount : 0,
                    location: item.location || null,
                    privacy: item.privacy || null,
                    type: item.type || null,
                    tags: Array.isArray(item.tags) ? item.tags : [],
                    description: item.description || null,
                    createdAtISO,
                  },
                })
              }}
            >
              <View style={[styles.clubItemRow, { borderBottomColor: theme.border }]}> 
                {item.image ? (
                  <Image source={{ uri: item.image }} style={styles.clubAvatar} />
                ) : null}

                <View style={{ flex: 1 }}>
                  {/* Title */}
                  <View style={styles.clubTitleRow}>
                    <Text style={[styles.clubName, { color: theme.text }]} numberOfLines={1}>
                      {item.name || 'Untitled Club'}
                    </Text>
                    {item.privacy && (
                      <Ionicons
                        name={item.privacy === 'public' ? 'globe-outline' : 'lock-closed-outline'}
                        size={16}
                        color={theme.text}
                        style={{ marginLeft: 6 }}
                      />
                    )}
                  </View>

                  {/* Members */}
                  <View style={styles.metaRow}>
                    <Ionicons name="people-outline" size={14} color={theme.text} style={{ marginRight: 4 }} />
                    <Text style={[styles.metaText, { color: theme.text }]}> 
                      {typeof item.membersCount === 'number' ? `${item.membersCount} members` : '— members'}
                    </Text>
                  </View>

                  {/* Location */}
                  {item.location ? (
                    <View style={styles.metaRow}>
                      <Ionicons name="location-outline" size={14} color={theme.text} style={{ marginRight: 4 }} />
                      <Text style={[styles.metaText, { color: theme.text }]}> 
                        {item.location}
                      </Text>
                    </View>
                  ) : null}

                  {/* Tags */}
                  {Array.isArray(item.tags) && item.tags.length > 0 ? (
                    <View style={styles.tagRow}>
                      {item.tags.map((tag) => (
                        <View key={String(tag)} style={[styles.tagPill, { borderColor: theme.border, backgroundColor: theme.background }]}> 
                          <Text style={[styles.tagText, { color: theme.text }]}>{String(tag)}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>

                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={theme.text}
                  style={{ alignSelf: 'center' }}
                />
              </View>
            </TouchableOpacity>
          )}
        />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    padding: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginBottom: 10, 
  },
  createRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 0,
  },
  createText: {
    fontSize: 16,
    fontWeight: '400',
  },
  createButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  createButtonText: {
    fontWeight: '600',
  },
  clubItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  clubTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  clubName: {
    fontSize: 16,
    marginRight: 4,
  },
  divider: {
    height: 1,
    backgroundColor: '#ccc',
    marginVertical: 10,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: '400',
  },
  clubItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  clubAvatar: {
    width: 70,
    height: 70,
    borderRadius: 8,
    marginRight: 16,
    backgroundColor: '#e6e6e6',
  },
  clubMeta: {
    marginTop: 6,
    fontSize: 13,
    opacity: 0.8,
  },
  metaText: {
    fontSize: 13,
    opacity: 0.8,
    lineHeight: 16,
    marginTop: 0,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  tagPill: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  tagText: {
    fontSize: 12,
  },
  clubDesc: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    marginBottom: 7,
    marginTop: -10,
  },
  titleLogo: {
    width: 55,
    height: 55,
    resizeMode: 'contain',
  },
})