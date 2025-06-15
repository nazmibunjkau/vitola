import React, { useState } from 'react'
import { View, SafeAreaView, StyleSheet, TouchableOpacity, Image, Text, TextInput, Keyboard, TouchableWithoutFeedback } from "react-native"
import { ArrowLeftIcon } from "react-native-heroicons/solid"
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../config/firebase';

export default function Login({ navigation }) {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')

    const handleSubmit = async () => {
        if (email && password) {
            try { 
                await signInWithEmailAndPassword(auth, email, password);
            } catch (error) {
                console.error("Error during login:", error);
                alert(`Login failed: ${error.message}`);
            }
        }
    }
    return (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accesible={false}>
            <View style={styles.container}>
                <SafeAreaView className="flex">
                    <View className="flex-row justify-start">
                        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                            <ArrowLeftIcon {...styles.leftArrow}/>
                        </TouchableOpacity>
                    </View>
                    <View style={styles.logoContainer}>
                        <Image source={require("../img/logo.png")} style={styles.image}/>
                    </View>
                    <View style={styles.titleContainer}>
                        <Text style={styles.title}>Welcome Back!</Text>
                    </View>
                    <View style={styles.inputContainer}>
                        <Text style={styles.email}>Email Address</Text>
                        <TextInput 
                            style={styles.input} 
                            placeholder="Enter Email" 
                            value={email}
                            onChangeText={value => setEmail(value)}
                            placeholderTextColor='#999'>
                        </TextInput>
                    </View>
                    <View style={styles.inputContainer}>
                        <Text style={styles.password}>Password</Text>
                        <TextInput 
                            style={styles.input} 
                            placeholder="Enter Password"
                            value={password}
                            onChangeText={value => setPassword(value)} 
                            placeholderTextColor='#999'
                            secureTextEntry>
                        </TextInput>
                        <TouchableOpacity style={styles.forgotPasswordContainer}
                            onPress={() => {
                                navigation.navigate('Home')
                            }}
                        >
                            <Text style={styles.forgotPassword}>Forgot Password?</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.loginButton}
                            onPress={handleSubmit}
                        >
                            <Text style={styles.loginButtonText}>Login</Text>
                        </TouchableOpacity>
                    </View>
                    <View>
                        <Text style={styles.orText}>
                            Or
                        </Text>
                    </View>
                    <View style={styles.socialContainer}>
                        <TouchableOpacity style={styles.socialButton}>
                            <Image source={require('../img/google.png')} style={styles.socialIcon}/>
                        </TouchableOpacity> 
                        <TouchableOpacity style={styles.socialButton}>
                            <Image source={require('../img/apple_logo.png')} style={styles.socialIcon}/>
                        </TouchableOpacity> 
                        <TouchableOpacity style={styles.socialButton}>
                            <Image source={require('../img/facebook_logo.png')} style={styles.socialIcon}/>
                        </TouchableOpacity> 
                    </View>
                    <View style={styles.signInContainer}>
                        <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                            <Text style={styles.signInText}>Don't have an account? Sign Up</Text>
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
            </View>
        </TouchableWithoutFeedback>
    )
} 

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff'
    },
    backButton: {
        marginLeft: 16,
        marginTop: 10,
    },
    leftArrow: {
        width: 30,
        height: 30,
        color: "#4b382a"
    },
    logoContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: -100
    },
    image: {
        width: '50%',
        height: '50%',
    },
    titleContainer: {
        marginTop: -100
    }, 
    title: {
        fontSize: 24,
        fontWeight: '400',
        fontFamily: 'Avenir, Montserrat, Corbel, URW Gothic, source-sans-pro, sans-serif',
        color: '#4b382a',
        textAlign: 'center',
    },
    inputContainer: {
        marginTop: 20,
        paddingHorizontal: 20
    },
    input: {
        backgroundColor: '#f0f0f0',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 12,
        fontSize: 14,
        color: '#333'
    },
    email: {
        fontSize: 14,
        marginBottom: 10,
        color: '#4b382a'
    },
    password: {
        fontSize: 14,
        marginBottom: 10,
        color: '#4b382a'
    },
    forgotPasswordContainer: {
        alignItems: 'flex-end',
        marginTop: 10,
        paddingHorizontal: 20
    },
    forgotPassword: {
        color: '#4b4b4b',
        fontSize: 12
    },
    loginButton: {
        backgroundColor: '#4b382a',
        paddingVertical: 10,
        borderRadius: 16,
        marginTop: 20,
        paddingHorizontal: 16
    },
    loginButtonText: {
        fontSize: 16,
        fontWeight: '400',
        fontFamily: 'Avenir, Montserrat, Corbel, URW Gothic, source-sans-pro, sans-serif',
        textAlign: 'center',
        color: '#f0f0f0'
    },
    orText: {
        fontSize: 16,
        color: '#4b382a',
        fontWeight: '400',
        fontFamily: 'Avenir, Montserrat, Corbel, URW Gothic, source-sans-pro, sans-serif',
        textAlign: 'center',
        paddingVertical: 20
    },
    socialContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 10,
        alignItems: 'center',
        gap: 48
    },
    socialButton: {
        backgroundColor: '#f3f3f3',
        padding: 8,
        borderRadius: 16
    },
    socialIcon: {
        width: 32,
        height: 32,
        resizeMode: 'contain'   
    },
    signInContainer: {
        flex: 1,
        justifyContent: 'center',
        marginTop: 10
    },
    signInText: {
        color: '#4b382a',
        fontWeight: '400',
        fontFamily: 'Avenir, Montserrat, Corbel, URW Gothic, source-sans-pro, sans-serif',
        textAlign: 'center'
    }
})