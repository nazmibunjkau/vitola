import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, FlatList, TouchableOpacity, Image, ActivityIndicator, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { query, collection, getDocs, orderBy, startAt, endAt, where, getDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useNavigation } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons, FontAwesome } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRoute } from '@react-navigation/native';

export default function Search() {
  const [searchQuery, setSearchQuery] = useState('');
  const [allCigars, setAllCigars] = useState([]);
  const [recentSearches, setRecentSearches] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation();
  const route = useRoute();
  const { humidorId, humidorTitle } = route.params || {};

  const topSearches = ['Arturo Fuente', 'Padron', 'Montecristo', 'Oliva', 'Rocky Patel'];

  useEffect(() => {
    const fetchFilteredCigars = async () => {
      if (searchQuery.trim().length === 0) {
        setAllCigars([]);
        return;
      }

      setLoading(true);
      const cigarsCol = collection(db, 'cigars');
      const q = query(
        cigarsCol,
        orderBy('name_insensitive'),
        startAt(searchQuery.toLowerCase()),
        endAt(searchQuery.toLowerCase() + '\uf8ff')
      );

      const cigarsSnapshot = await getDocs(q);
      const cigarsList = cigarsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAllCigars(cigarsList);
      setLoading(false);
    };

    fetchFilteredCigars();
  }, [searchQuery]);

  useEffect(() => {
    const loadRecent = async () => {
      const stored = await AsyncStorage.getItem('recentSearches');
      if (stored) {
        setRecentSearches(JSON.parse(stored));
      }
    };
    loadRecent();
  }, []);

  useEffect(() => {
    const checkSearchLimit = async () => {
      const userId = 'WrwfP03AmIZss7hMwFWyX4J16my1'; // You can replace this with dynamic user ID logic if needed
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const userData = userSnap.data();
        const subscription = userData.subscriptionPlan || 'free';

        if (subscription === 'free') {
          const now = new Date();
          const lastReset = userData.searchReset?.toDate?.() || now;
          const count = userData.searchCount || 0;
          const diff = (now - lastReset) / (1000 * 60 * 60); // in hours

          if (diff >= 24) {
            await updateDoc(userRef, {
              searchCount: 0,
              searchReset: new Date(),
            });
          } else if (count >= 15) {
            alert("You've reached your daily search limit. Please come back tomorrow or upgrade for unlimited searches.");
            setSearchQuery('');
            return;
          }
        }
      }
    };

    checkSearchLimit();
  }, [searchQuery]);

  const handleSelectCigar = async (cigar) => {
    let fullCigar = cigar;

    // If only the name is passed, fetch full cigar data
    if (!cigar.image_url || !cigar.brand) {
      const cigarsCol = collection(db, 'cigars');
      const q = query(cigarsCol, where('name_insensitive', '==', cigar.name.toLowerCase()));
      const cigarsSnapshot = await getDocs(q);
      if (cigarsSnapshot.empty) return;
      const match = cigarsSnapshot.docs[0].data();
      fullCigar = match;
    }

    const updated = [fullCigar.name, ...recentSearches.filter(t => t !== fullCigar.name)].slice(0, 5);
    setRecentSearches(updated);
    await AsyncStorage.setItem('recentSearches', JSON.stringify(updated));

    const userId = 'WrwfP03AmIZss7hMwFWyX4J16my1';
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      const userData = userSnap.data();
      if (userData.subscriptionPlan === 'free') {
        const currentCount = userData.searchCount || 0;
        await updateDoc(userRef, { searchCount: currentCount + 1 });
      }
    }

    navigation.navigate('CigarDetails', { cigar: fullCigar, humidorId, humidorTitle });
  };

  const renderCigar = ({ item }) => (
    <TouchableOpacity style={styles.item} onPress={() => handleSelectCigar(item)}>
      <Image source={{ uri: item.image_url }} style={styles.image} />
      <View style={styles.textContainer}>
        <Text style={styles.title}>{item.name}</Text>
        <Text style={styles.subtitle}>{item.brand}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={styles.container}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={30} color="#3e3024" />
        </TouchableOpacity>
        <View style={styles.searchInputWrapper}>
          <Ionicons name="search" size={20} color="#7a6e63" style={styles.searchIcon} />
          <TextInput
            style={styles.input}
            placeholder="Search for a cigar..."
            onChangeText={setSearchQuery}
            value={searchQuery}
            onSubmitEditing={() => Keyboard.dismiss()}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearIcon}>
              <Ionicons name="close-circle" size={20} color="#B71C1C" />
            </TouchableOpacity>
          )}
        </View>

        {searchQuery.trim().length === 0 && allCigars.length === 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Top Searches</Text>
            {topSearches.map((brand, idx) => (
              <View style={styles.searchRow} key={idx}>
                <MaterialCommunityIcons name="fire" size={24} color="#e25822" style={{ marginRight: 8 }} />
                <Text style={[styles.subtitle, { fontSize: 16 }]}>{brand}</Text>
              </View>
            ))}
          </View>
        )}

        {searchQuery.trim().length === 0 && allCigars.length === 0 && recentSearches.length > 0 && (
          <View style={styles.section}>
            <View style={styles.recentHeader}>
              <Text style={styles.sectionTitle}>Recent</Text>
              <TouchableOpacity
                onPress={async () => {
                  await AsyncStorage.removeItem('recentSearches');
                  setRecentSearches([]);
                }}
              >
                <Text style={styles.clearText}>CLEAR</Text>
              </TouchableOpacity>
            </View>
            {recentSearches.map((term, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.searchRow}
                onPress={() => handleSelectCigar({ name: term })}
              >
                <FontAwesome name="history" size={22} color="#7a6e63" style={{ marginRight: 8 }} />
                <Text style={[styles.subtitle, { fontSize: 16 }]}>{term}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {loading && (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 20 }}>
            <ActivityIndicator size="large" color="#7a6e63" />
          </View>
        )}

        <FlatList
          data={allCigars}
          keyExtractor={(item) => item.id}
          renderItem={renderCigar}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={() => Keyboard.dismiss()}
        />
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f9f6f1',
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 16,
    zIndex: 1,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderColor: '#b09e88',
    borderWidth: 1,
    borderRadius: 8,
    marginTop: 100,
    marginBottom: 20,
    backgroundColor: '#fff',
    paddingRight: 8,
  },
  input: {
    height: 50,
    flex: 1,
    paddingHorizontal: 12,
    paddingLeft: 0,
  },
  clearIcon: {
    paddingHorizontal: 4,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    marginBottom: 8,
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  image: {
    width: 50,
    height: 50,
    borderRadius: 6,
    marginRight: 10,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#3e3024',
  },
  subtitle: {
    fontSize: 14,
    color: '#7a6e63',
  },
  section: {
    marginTop: 20,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3e3024',
    marginBottom: 8,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingLeft: 6,
    paddingVertical: 6, // Added for better spacing
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  clearText: {
    color: '#a94442',
    fontSize: 14,
    marginRight: 8,
  },
  searchIcon: {
    marginLeft: 10,
    marginRight: 6,
  },
});