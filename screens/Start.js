import LottieView from 'lottie-react-native';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';

export default function Home({ navigation }) {
  return (
    <View style={styles.container} >
      <Image source={require('../img/logo.png')} style={styles.logo}/>
      <LottieView
        source={require('../assets/home_splash_2.json')}
        autoPlay
        loop
        style={styles.background}
        resizeMode='cover'
      />
      <View style={styles.overlay}>
        <Text style={styles.title}>Welcome to Vitola</Text>
        <Text style={styles.subtitle}>Your personal cigar companion — track your humidor, scan or search cigars, log smoke sessions, and explore the full cigar experience.</Text>
        <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('MainApp')}>
          <Text style={styles.buttonText}>Get Started</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
          <Text style={styles.loginText}>Already have an account? Log in</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingBottom: 60
  },
  title: {
    fontSize: 70,
    fontWeight: '300',
    fontFamily: 'Avenir, Montserrat, Corbel, URW Gothic, source-sans-pro, sans-serif',
    color: '#fff',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15.7,
    fontWeight: '400',
    fontFamily: 'Avenir, Montserrat, Corbel, URW Gothic, source-sans-pro, sans-serif',
    color: '#ddd',
    marginBottom: 40,
    textAlign: 'left',
  },
  button: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    width: '100%',
    borderRadius: 25,
    marginBottom: 20,
    alignItems: 'center'
  },
  buttonText: {
    color: '#000',
    fontWeight: '400',
    fontFamily: 'Avenir, Montserrat, Corbel, URW Gothic, source-sans-pro, sans-serif',
    fontSize: 16,
  },
  logo: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '30%',
    height: '30%',
    resizeMode: 'contain',
    zIndex: 10,
  },
  loginText: {
    color: '#fff',
    fontWeight: '400',
    fontFamily: 'Avenir, Montserrat, Corbel, URW Gothic, source-sans-pro, sans-serif',
  },
});