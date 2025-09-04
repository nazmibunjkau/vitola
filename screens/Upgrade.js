import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Platform, Alert, ActivityIndicator } from 'react-native'
import React from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import LottieView from 'lottie-react-native';
import Constants from 'expo-constants';

export default function Upgrade() {
  const navigation = useNavigation();
  const [selectedPlan, setSelectedPlan] = React.useState('Annually');
  const { theme } = useTheme();
  const dynamicStyles = getStyles(theme);

  // --- IAP wiring (safe for Expo Go via dynamic import) ---
  const PRODUCT_IDS = {
    Monthly: 'premium_monthly',
    Annually: 'premium_annual',
  };

  const [processing, setProcessing] = React.useState(false);
  const [iapAvailable, setIapAvailable] = React.useState(false);
  const [products, setProducts] = React.useState([]);
  const RNIapRef = React.useRef(null);

  React.useEffect(() => {
    let purchaseUpdateSub;
    let purchaseErrorSub;

    const init = async () => {
      // Dynamically import so Expo Go (no native IAP) doesn't crash
      let RNIap;
      try {
        if (Constants?.appOwnership === 'expo') {
          console.warn('[IAP] Skipping IAP setup in Expo Go');
          setIapAvailable(false);
          return;
        }
        RNIap = await import('react-native-iap');
        RNIapRef.current = RNIap;
        setIapAvailable(true);
      } catch (e) {
        console.warn('[IAP] react-native-iap not installed in this build; running without IAP');
        setIapAvailable(false);
        return; // Skip listener wiring
      }

      try {
        await RNIap.initConnection();
        try { await RNIap.flushFailedPurchasesCachedAsPendingAndroid?.(); } catch {}
        const list = await RNIap.getSubscriptions(Object.values(PRODUCT_IDS));
        setProducts(list || []);
      } catch (e) {
        console.warn('[IAP] init/getSubscriptions failed:', e?.message || String(e));
      }

      purchaseUpdateSub = RNIap.purchaseUpdatedListener?.(async (purchase) => {
        try {
          const payload = {
            platform: Platform.OS,
            productId: purchase?.productId,
            transactionId: purchase?.transactionId || purchase?.transactionIdIOS || purchase?.purchaseToken,
            receipt: purchase?.transactionReceipt || purchase?.originalJson || null,
            // If you have Firebase web auth available here, include:
            // uid: auth?.currentUser?.uid || null,
          };

          // Forward to your backend for validation (replace with your deployed URL)
          try {
            await fetch('http://localhost:8080/iap/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            });
          } catch (netErr) {
            console.warn('[IAP] verify POST failed:', netErr?.message || String(netErr));
          }

          try {
            if (Platform.OS === 'ios') {
              await RNIap.finishTransaction?.(purchase, true);
            } else {
              await RNIap.acknowledgePurchaseAndroid?.(purchase.purchaseToken);
              await RNIap.finishTransaction?.(purchase, false);
            }
          } catch (finErr) {
            console.warn('[IAP] finishTransaction failed:', finErr?.message || String(finErr));
          }

          Alert.alert('Success', 'Thanks for upgrading!');
        } catch (err) {
          console.warn('[IAP] purchaseUpdated handler error:', err?.message || String(err));
        } finally {
          setProcessing(false);
        }
      });

      purchaseErrorSub = RNIap.purchaseErrorListener?.((err) => {
        console.warn('[IAP] purchase error:', err?.message || String(err));
        setProcessing(false);
      });
    };

    init();

    return () => {
      try { purchaseUpdateSub?.remove?.(); } catch {}
      try { purchaseErrorSub?.remove?.(); } catch {}
      try { RNIapRef.current?.endConnection?.(); } catch {}
    };
  }, []);

  const handleSubscribe = async (plan) => {
    const RNIap = RNIapRef.current;
    const sku = PRODUCT_IDS[plan];

    if (!sku) {
      Alert.alert('Unavailable', 'Plan not available.');
      return;
    }
    if (!iapAvailable || !RNIap) {
      Alert.alert('Store unavailable', 'In-app purchases are not enabled in this build. Build a custom dev client to enable purchases.');
      return;
    }

    // Optional: ensure product was returned by store
    if (!(products || []).some(p => p.productId === sku)) {
      console.warn('[IAP] Product not returned by store yet; proceeding anyway:', sku);
    }

    try {
      setProcessing(true);
      await RNIap.requestSubscription?.({ sku, andDangerouslyFinishTransactionAutomaticallyIOS: false });
    } catch (e) {
      console.warn('[IAP] requestSubscription failed:', e?.message || String(e));
      setProcessing(false);
      Alert.alert('Purchase failed', e?.message || 'Please try again.');
    }
  };

  return (
    <SafeAreaView style={dynamicStyles.container}>
      <LottieView
        source={require('../assets/home_splash_2.json')}
        autoPlay
        loop
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      />
      <ScrollView contentContainerStyle={{ paddingBottom: 160 }}>
        <TouchableOpacity
          style={dynamicStyles.closeButtonContainer}
          onPress={() => navigation.goBack()}
        >
          <Text style={dynamicStyles.closeButton}>✕</Text>
        </TouchableOpacity>
        <Text style={dynamicStyles.title}>Unlock the full potential</Text>
        <Text style={dynamicStyles.subtext}>
            Enjoy unlimited scans, grow your cigar humidor, and connect with a thriving community.
        </Text>
        <Text style={dynamicStyles.planHeader}>Choose your plan:</Text>
        <View style={{ flexDirection: 'row', alignSelf: 'flex-end', marginBottom: 4, marginRight: 16 }}>
          <Ionicons name="flame-outline" size={14} color="red" style={{ marginRight: 4 }} />
          <Text style={{
            color: 'red',
            fontSize: 12,
            fontWeight: '600',
            textAlign: 'center',
            borderWidth: 1,
            borderColor: 'red',
            borderRadius: 6,
            paddingHorizontal: 6,
            paddingVertical: 2,
          }}>Most popular</Text>
        </View>
        <TouchableOpacity
          style={[
            dynamicStyles.planBox,
            selectedPlan === 'Annually' && dynamicStyles.planBoxSelected,
            dynamicStyles.planRow
          ]}
          onPress={() => setSelectedPlan('Annually')}
        >
          <View>
            <Text style={[
              dynamicStyles.planText,
              selectedPlan === 'Annually' && dynamicStyles.planTextSelected,
              { fontWeight: '700' }
            ]}>Annually</Text>
            <Text style={[
              dynamicStyles.planText,
              selectedPlan === 'Annually' && dynamicStyles.planTextSelected,
              { fontSize: 14, marginTop: 4 }
            ]}>$50/year</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={[
              dynamicStyles.planText,
              selectedPlan === 'Annually' && dynamicStyles.planTextSelected,
              { textDecorationLine: 'line-through', marginRight: 6 }
            ]}>$5.99</Text>
            <Text style={[
              dynamicStyles.planText,
              selectedPlan === 'Annually' && dynamicStyles.planTextSelected,
              { fontWeight: '700' }
            ]}>$4.17/month</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            dynamicStyles.planBox,
            selectedPlan === 'Monthly' && dynamicStyles.planBoxSelected,
            dynamicStyles.planRow
          ]}
          onPress={() => setSelectedPlan('Monthly')}
        >
          <Text style={[
            dynamicStyles.planText,
            selectedPlan === 'Monthly' && dynamicStyles.planTextSelected,
            { fontWeight: '700' }
          ]}>Monthly</Text>
          <Text style={[
            dynamicStyles.planText,
            selectedPlan === 'Monthly' && dynamicStyles.planTextSelected
          ]}>$5.99/month</Text>
        </TouchableOpacity>
        <Text style={dynamicStyles.secondaryTitle}>Your complete cigar companion</Text>
        <View style={dynamicStyles.benefitsList}>
          <View style={dynamicStyles.benefitItem}>
            <Ionicons name="infinite-outline" size={20} color="#fff" style={{ marginRight: 10 }} />
            <Text style={dynamicStyles.benefitText}>Unlimited scans, searches, and humidors</Text>
          </View>
          <View style={dynamicStyles.benefitItem}>
            <Ionicons name="people-outline" size={20} color="#fff" style={{ marginRight: 10 }} />
            <Text style={dynamicStyles.benefitText}>Connect and create with cigar communities</Text>
          </View>
          <View style={dynamicStyles.benefitItem}>
            <Ionicons name="add-circle-outline" size={20} color="#fff" style={{ marginRight: 10 }} />
            <Text style={dynamicStyles.benefitText}>Unlimited cigar additions</Text>
          </View>
          <View style={dynamicStyles.benefitItem}>
            <Ionicons name="shield-checkmark-outline" size={20} color="#fff" style={{ marginRight: 10 }} />
            <Text style={dynamicStyles.benefitText}>Become a verified user</Text>
          </View>
        </View>
      </ScrollView>
      <View style={dynamicStyles.bottomSection}>
        <TouchableOpacity
          onPress={() => handleSubscribe(selectedPlan)}
          disabled={processing}
          style={dynamicStyles.subscribeButton}
          activeOpacity={0.8}
        >
          {processing ? (
            <ActivityIndicator />
          ) : (
            <Text style={dynamicStyles.subscribeButtonText}>
              Subscribe {selectedPlan}
            </Text>
          )}
        </TouchableOpacity>
        <Text style={dynamicStyles.altText}>Recurring billing. Cancel anytime</Text>
      </View>
    </SafeAreaView>
  )
}


const getStyles = (theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      padding: 24,
      backgroundColor: '#fff',
    },
    closeButtonContainer: {
      position: 'absolute',
      top: 3,
      right: 8,
      backgroundColor: '#fff',
      borderRadius: 24,
      width: 44,
      height: 44,
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 10,
    },
    closeButton: {
      fontSize: 28,
      textAlign: 'center',
      color: '#000',
    },
    title: {
      fontSize: 28,
      fontWeight: 'bold',
      marginTop: 80,
      marginBottom: 12,
      textAlign: 'center',
      color: '#fff',
    },
    subtext: {
      fontSize: 16,
      color: 'rgba(255,255,255,0.8)',
      textAlign: 'center',
      marginBottom: 32,
      paddingHorizontal: 12,
    },
    planHeader: {
      fontSize: 18,
      fontWeight: '600',
      marginBottom: 12,
      color: '#fff',
    },
    planBox: {
      padding: 16,
      borderWidth: 1,
      borderColor: '#ccc',
      borderRadius: 8,
      marginBottom: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#888',
    },
    planBoxSelected: {
      backgroundColor: '#fff',
      borderColor: 'red',
    },
    planText: {
      fontSize: 16,
      textAlign: 'center',
      color: '#fff',
    },
    planTextSelected: {
      color: '#000',
    },
    secondaryTitle: {
      fontSize: 18,
      fontWeight: '600',
      marginTop: 24,
      marginBottom: 12,
      textAlign: 'center',
      color: '#fff',
    },
    benefitsList: {
      marginBottom: 24,
      marginTop: 12,
      alignItems: 'center',
      width: '100%',
    },
    benefitItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
      marginBottom: 30,
      width: '80%',
      alignSelf: 'center',
    },
    benefitIcon: {
      fontSize: 18,
      marginRight: 10,
      color: '#333',
    },
    benefitText: {
      fontSize: 15,
      color: '#fff',
      flexShrink: 1,
    },
    subscribeButton: {
      backgroundColor: '#fff',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      borderRadius: 8,
      marginBottom: 8,
      overflow: 'hidden',
    },
    subscribeButtonText: {
      color: '#000',
      textAlign: 'center',
      fontSize: 16,
      fontWeight: '600',
    },
    altText: {
      fontSize: 13,
      textAlign: 'center',
      color: '#ccc',
    },
    bottomSection: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: '#4b382a',
      paddingHorizontal: 24,
      paddingTop: 16,
      paddingBottom: 32,
      borderTopWidth: 1,
      borderTopColor: theme.placeholder || '#ccc',
    },
    planRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
  });
