import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Modal } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Keyboard,
  TextInput,
  Switch,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../context/ThemeContext';

// Reusable labeled row
const FieldLabel = ({ label, required }) => {
  const { theme } = useTheme();
  return (
    <View style={styles.labelRow}>
      <Text style={[styles.labelText, { color: theme.text }]}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>
    </View>
  );
};

// Reusable themed input
const ThemedInput = ({
  value,
  onChangeText,
  placeholder,
  multiline = false,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  style,
}) => {
  const { theme, isDark } = useTheme();
  const inputStyle = useMemo(
    () => [
      styles.input,
      {
        borderColor: theme.border,
        backgroundColor: theme.inputBackground,
        color: theme.searchPlaceholder,
      },
      multiline && styles.inputMultiline,
      style,
    ],
    [theme, multiline, style]
  );

  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={theme.searchPlaceholder}
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize}
      multiline={multiline}
      style={inputStyle}
      cursorColor={theme.placeholder}
      selectionColor={theme.border}
      returnKeyType="done"
    />
  );
};

// Attachment row (UI only for this pass)
const AttachmentRow = ({ icon, title, subtitle, count = 0, onPress }) => {
  const { theme } = useTheme();
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={[styles.attachmentRow, { borderColor: theme.border, backgroundColor: theme.card }]}
    >
      <View style={styles.attachmentLeft}>
        <MaterialCommunityIcons name={icon} size={22} color={theme.primary} />
        <View style={styles.attachmentTextWrap}>
          <Text style={[styles.attachmentTitle, { color: theme.text }]}>{title}</Text>
          <Text style={[styles.attachmentSubtitle, { color: theme.placeholder }]}>
            {subtitle}
            {count ? ` • ${count} selected` : ''}
          </Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.placeholder} />
    </TouchableOpacity>
  );
};

export default function AficionadoApplication({ navigation }) {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  // Form state (UI only this pass)
  const [isEligible, setIsEligible] = useState(false);

  const [businessName, setBusinessName] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [years, setYears] = useState('');

  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [stateProv, setStateProv] = useState('');
  const [country, setCountry] = useState('');

  const [description, setDescription] = useState('');
  const [instagram, setInstagram] = useState('');
  const [facebook, setFacebook] = useState('');

  const [agree, setAgree] = useState(false);

  // Attachments (URIs) + action sheet state
  const [storefrontURIs, setStorefrontURIs] = useState([]);
  const [licenseURIs, setLicenseURIs] = useState([]);
  const [registrationURIs, setRegistrationURIs] = useState([]);

  const [sheetVisible, setSheetVisible] = useState(false);
  const [activeAttachment, setActiveAttachment] = useState(null); // 'storefront' | 'license' | 'registration'

  // Submit flow (UI-only): modal + staged messages
  const [submitModalVisible, setSubmitModalVisible] = useState(false);
  const [submitStage, setSubmitStage] = useState('idle'); // 'idle' | 'loading' | 'sent'
  const submitTimersRef = useRef([]);

  const limits = { storefront: 9, license: 3, registration: 5 };

  const getCountFor = (kind) => {
    if (kind === 'storefront') return storefrontURIs.length;
    if (kind === 'license') return licenseURIs.length;
    if (kind === 'registration') return registrationURIs.length;
    return 0;
  };

  const setURIsFor = (kind, updater) => {
    if (kind === 'storefront') setStorefrontURIs(updater);
    if (kind === 'license') setLicenseURIs(updater);
    if (kind === 'registration') setRegistrationURIs(updater);
  };

  const startSubmitUI = () => {
    if (!canSubmitUI || submitModalVisible) return;
    // Open modal and show "Submitting application..."
    setSubmitModalVisible(true);
    setSubmitStage('loading');

    // clear any previous timers
    submitTimersRef.current.forEach(t => clearTimeout(t));
    submitTimersRef.current = [];

    // after ~2s, show "Sent" state
    const t1 = setTimeout(() => {
      setSubmitStage('sent');
    }, 2000);

    // after another ~2s, dismiss and navigate to Settings
    const t2 = setTimeout(() => {
      setSubmitModalVisible(false);
      setSubmitStage('idle');
      // navigate to Settings screen
      navigation?.navigate?.('Settings');
    }, 4000);

    submitTimersRef.current.push(t1, t2);
  };

  useEffect(() => {
    return () => {
      submitTimersRef.current.forEach(t => clearTimeout(t));
      submitTimersRef.current = [];
    };
  }, []);

  const ensurePermissions = async (source) => {
    try {
      if (source === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission required', 'Camera access is needed to take a photo.');
          return false;
        }
      }
      const { status: libStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (libStatus !== 'granted') {
        Alert.alert('Permission required', 'Photo library access is needed to pick a photo.');
        return false;
      }
      return true;
    } catch (e) {
      console.warn('[Aficionado][permissions]', e);
      return false;
    }
  };

  const handlePick = async (source) => {
    if (!activeAttachment) return;
    // respect max limits
    const current = getCountFor(activeAttachment);
    const max = limits[activeAttachment];
    if (current >= max) {
      Alert.alert('Limit reached', `You can attach up to ${max} ${activeAttachment === 'storefront' ? 'storefront photos' : activeAttachment === 'license' ? 'licenses' : 'documents'}.`);
      setSheetVisible(false);
      return;
    }
    const ok = await ensurePermissions(source);
    if (!ok) return;

    try {
      let result;
      if (source === 'camera') {
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: false,
          quality: 0.8,
        });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsMultipleSelection: false,
          quality: 0.8,
        });
      }

      if (result.canceled) {
        setSheetVisible(false);
        return;
      }
      const uri = result.assets?.[0]?.uri;
      if (!uri) {
        setSheetVisible(false);
        return;
      }

      setURIsFor(activeAttachment, (prev) => {
        const next = [...prev, uri].slice(0, limits[activeAttachment]);
        return next;
      });
    } catch (e) {
      console.warn('[Aficionado][picker]', e);
      Alert.alert('Photo error', 'We could not get the photo. Please try again.');
    } finally {
      setSheetVisible(false);
    }
  };

  const canSubmitUI =
    isEligible &&
    agree &&
    businessName.trim().length > 1 &&
    contactName.trim().length > 1 &&
    email.trim().length > 3 &&
    address.trim().length > 3 &&
    country.trim().length > 1 &&
    description.trim().length > 10 &&
    storefrontURIs.length > 0 &&
    licenseURIs.length > 0 &&
    registrationURIs.length > 0;

  const onClearUI = () => {
    setIsEligible(false);
    setBusinessName('');
    setContactName('');
    setEmail('');
    setPhone('');
    setWebsite('');
    setYears('');
    setAddress('');
    setCity('');
    setStateProv('');
    setCountry('');
    setDescription('');
    setInstagram('');
    setFacebook('');
    setAgree(false);
    setStorefrontURIs([]);
    setLicenseURIs([]);
    setRegistrationURIs([]);
    setActiveAttachment(null);
    setSheetVisible(false);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 72 : 0}
    >
      {/* Header */}
      <SafeAreaView style={{ backgroundColor: theme.background }}>
        <View
          style={[
            styles.header,
            {
              paddingTop: Platform.OS === 'android' ? 0 : 0, // flush to the very top; SafeArea handles iOS notch
              borderBottomColor: theme.border,
              backgroundColor: theme.background,
            },
          ]}
        >
          <TouchableOpacity
            onPress={() => navigation?.goBack?.()}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Aficionado Application</Text>
          <View style={{ width: 24 }} />
        </View>
      </SafeAreaView>

      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 32 }]}
          keyboardShouldPersistTaps="handled"
        >
          {/* Intro / eligibility */}
          <View style={[styles.section, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="shield-star" size={20} color={theme.primary} />
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Eligibility
              </Text>
            </View>
            <Text style={[styles.sectionHelp, { color: theme.placeholder }]}>
              This badge is for verified cigar shops and vendors only. Applications that do not include valid proof of business will be rejected.
            </Text>
            <View style={styles.switchRow}>
              <Text style={[styles.switchLabel, { color: theme.text }]}>
                I am a cigar shop / vendor
              </Text>
              <Switch value={isEligible} onValueChange={setIsEligible} thumbColor={isDark ? theme.primary : undefined} />
            </View>
          </View>

          {/* Business details */}
          <View style={[styles.section, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="storefront-outline" size={20} color={theme.primary} />
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Business Details
              </Text>
            </View>

            <FieldLabel label="Business Name" required />
            <ThemedInput value={businessName} onChangeText={setBusinessName} placeholder="e.g., Henry’s Humidors" autoCapitalize="words" />

            <FieldLabel label="Contact Name" required />
            <ThemedInput value={contactName} onChangeText={setContactName} placeholder="e.g., John Doe" autoCapitalize="words" />

            <FieldLabel label="Email" required />
            <ThemedInput value={email} onChangeText={setEmail} placeholder="name@business.com" keyboardType="email-address" autoCapitalize="none" />

            <FieldLabel label="Phone" />
            <ThemedInput value={phone} onChangeText={setPhone} placeholder="+1 (555) 555-5555" keyboardType="phone-pad" autoCapitalize="none" />

            <FieldLabel label="Website" />
            <ThemedInput value={website} onChangeText={setWebsite} placeholder="https://yourbusiness.com" autoCapitalize="none" />

            <FieldLabel label="Years in Business" />
            <ThemedInput value={years} onChangeText={setYears} placeholder="e.g., 5" keyboardType="number-pad" />
          </View>

          {/* Location */}
          <View style={[styles.section, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.sectionHeader}>
              <Ionicons name="location-outline" size={20} color={theme.primary} />
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Location
              </Text>
            </View>

            <FieldLabel label="Street Address" required />
            <ThemedInput value={address} onChangeText={setAddress} placeholder="123 Main St, Suite 100" autoCapitalize="words" />

            <FieldLabel label="City" />
            <ThemedInput value={city} onChangeText={setCity} placeholder="City" autoCapitalize="words" />

            <FieldLabel label="State / Province" />
            <ThemedInput value={stateProv} onChangeText={setStateProv} placeholder="State / Province" autoCapitalize="words" />

            <FieldLabel label="Country" required />
            <ThemedInput value={country} onChangeText={setCountry} placeholder="Country" autoCapitalize="words" />
          </View>

          {/* About */}
          <View style={[styles.section, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="text-long" size={20} color={theme.primary} />
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                About Your Business
              </Text>
            </View>

            <FieldLabel label="Description" required />
            <ThemedInput
              value={description}
              onChangeText={setDescription}
              placeholder="Tell us about your business, customer base, brands carried, etc."
              multiline
            />

            <FieldLabel label="Instagram" />
            <ThemedInput value={instagram} onChangeText={setInstagram} placeholder="@yourhandle" autoCapitalize="none" />

            <FieldLabel label="Facebook" />
            <ThemedInput value={facebook} onChangeText={setFacebook} placeholder="facebook.com/yourpage" autoCapitalize="none" />
          </View>

          {/* Proof */}
          <View style={[styles.section, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="file-check-outline" size={20} color={theme.primary} />
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Required Proof
              </Text>
            </View>

            <AttachmentRow
              icon="image-multiple-outline"
              title="Storefront Photos"
              subtitle="Exterior & interior"
              count={storefrontURIs.length}
              onPress={() => { setActiveAttachment('storefront'); setSheetVisible(true); }}
            />
            <AttachmentRow
              icon="certificate-outline"
              title="Business License"
              subtitle="Current & valid"
              count={licenseURIs.length}
              onPress={() => { setActiveAttachment('license'); setSheetVisible(true); }}
            />
            <AttachmentRow
              icon="file-document-outline"
              title="Registration / Articles"
              subtitle="LLC/Corp docs"
              count={registrationURIs.length}
              onPress={() => { setActiveAttachment('registration'); setSheetVisible(true); }}
            />
          </View>

          {/* Agreements */}
          <View style={[styles.section, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.switchRow}>
              <View style={styles.agreementTextWrap}>
                <Text style={[styles.switchLabel, { color: theme.text }]}>
                  I agree that Vitola may verify my documents and contact me for additional proof if necessary.
                </Text>
              </View>
              <Switch
                value={agree}
                onValueChange={setAgree}
                thumbColor={isDark ? theme.primary : undefined}
                style={{ marginLeft: 12 }}
              />
            </View>
          </View>

          {/* Actions (UI only) */}
          <View style={styles.actionsRow}>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={onClearUI}
              style={[styles.secondaryBtn, { borderColor: theme.border, backgroundColor: theme.card }]}
            >
              <Text style={[styles.secondaryText, { color: theme.text }]}>Clear</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={startSubmitUI}
              disabled={!canSubmitUI || submitModalVisible}
              style={[
                styles.primaryBtn,
                {
                  backgroundColor: canSubmitUI && !submitModalVisible ? theme.primary : theme.border,
                },
              ]}
            >
              <MaterialCommunityIcons
                name="check-decagram"
                size={18}
                color={canSubmitUI && !submitModalVisible ? theme.background : theme.placeholder}
                style={{ marginRight: 8 }}
              />
              <Text style={[styles.primaryText, { color: canSubmitUI && !submitModalVisible ? theme.background : theme.placeholder }]}>
                Submit Application
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </TouchableWithoutFeedback>
      {/* Submit flow modal (UI-only) */}
      <Modal
        visible={submitModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => {}}
      >
        <View style={styles.submitBackdrop}>
          <View style={[styles.submitCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            {submitStage === 'loading' ? (
              <>
                <Ionicons name="cloud-upload-outline" size={32} color={theme.primary} style={{ marginBottom: 12 }} />
                <Text style={[styles.submitTitle, { color: theme.text }]}>Submitting application…</Text>
                <Text style={[styles.submitSubtitle, { color: theme.placeholder }]}>Please wait a moment</Text>
              </>
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={36} color={theme.primary} style={{ marginBottom: 12 }} />
                <Text style={[styles.submitTitle, { color: theme.text }]}>Sent</Text>
              </>
            )}
          </View>
        </View>
      </Modal>
      {/* Camera / Library picker sheet */}
      <Modal
        visible={sheetVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setSheetVisible(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={styles.sheetBackdrop}
          onPress={() => setSheetVisible(false)}
        />
        <View style={[styles.sheetContainer, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
          <Text style={[styles.sheetTitle, { color: theme.text }]}>
            {activeAttachment === 'storefront' ? 'Add Storefront Photo' :
             activeAttachment === 'license' ? 'Add Business License' :
             activeAttachment === 'registration' ? 'Add Registration / Articles' : 'Add Photo'}
          </Text>
          <TouchableOpacity
            style={[styles.sheetBtn, { borderColor: theme.border }]}
            onPress={() => handlePick('camera')}
          >
            <Ionicons name="camera-outline" size={18} color={theme.text} style={{ marginRight: 8 }} />
            <Text style={[styles.sheetBtnText, { color: theme.text }]}>Take Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sheetBtn, { borderColor: theme.border }]}
            onPress={() => handlePick('library')}
          >
            <Ionicons name="images-outline" size={18} color={theme.text} style={{ marginRight: 8 }} />
            <Text style={[styles.sheetBtnText, { color: theme.text }]}>Choose from Library</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sheetCancel, { backgroundColor: theme.background, borderColor: theme.border }]}
            onPress={() => setSheetVisible(false)}
          >
            <Text style={[styles.sheetCancelText, { color: theme.text }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    minHeight: 52,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 17, fontWeight: '600' },
  scrollContent: { padding: 16, paddingTop: 0, gap: 16 },

  section: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  sectionTitle: { fontSize: 16, fontWeight: '600' },
  sectionHelp: { fontSize: 13, lineHeight: 18, marginTop: 6 },

  labelRow: { marginTop: 10, marginBottom: 6 },
  labelText: { fontSize: 13, fontWeight: '600' },
  required: { color: '#EF4444' },

  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 15,
  },
  inputMultiline: {
    minHeight: 90,
    textAlignVertical: 'top',
  },

  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 12,
  },
  switchLabel: { fontSize: 14, lineHeight: 20, flexShrink: 1, flexWrap: 'wrap' },
  agreementTextWrap: { flex: 1, paddingRight: 16, minWidth: 0 },

  attachmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    marginTop: 8,
    justifyContent: 'space-between',
  },
  attachmentLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  attachmentTextWrap: { justifyContent: 'center' },
  attachmentTitle: { fontSize: 14, fontWeight: '600' },
  attachmentSubtitle: { fontSize: 12, marginTop: 2 },

  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  secondaryBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: { fontSize: 15, fontWeight: '600' },

  primaryBtn: {
    flex: 1.2,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  primaryText: { fontSize: 15, fontWeight: '700' },
  sheetBackdrop: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheetContainer: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  sheetTitle: { fontSize: 15, fontWeight: '700', marginBottom: 8 },
  sheetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginTop: 10,
  },
  sheetBtnText: { fontSize: 15, fontWeight: '600' },
  sheetCancel: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetCancelText: { fontSize: 15, fontWeight: '600' },
  submitBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  submitCard: {
    width: '86%',
    maxWidth: 420,
    borderRadius: 14,
    paddingVertical: 22,
    paddingHorizontal: 18,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  submitTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4, textAlign: 'center' },
  submitSubtitle: { fontSize: 13, textAlign: 'center' },
});