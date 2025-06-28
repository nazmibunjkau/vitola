import React, { useState } from 'react'
import { useNavigation } from "@react-navigation/native"
import { View, SafeAreaView, StyleSheet, TouchableOpacity, Image, Text, TextInput, Keyboard, TouchableWithoutFeedback } from "react-native"
import { ArrowLeftIcon, CheckIcon } from "react-native-heroicons/solid"
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import { auth } from '../config/firebase';

const db = getFirestore();

const capitalizeName = (text) => {
  return text
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

export default function Register({}) {
    const navigation = useNavigation()
    const [agreed, setAgreed] = useState(false)
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [name, setName] = useState('')
    
    const handleSubmit = async () => {
        if (name && email && password) {
            try {
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                await updateProfile(userCredential.user, { displayName: name });
                await auth.currentUser.reload();

                try {
                    await setDoc(doc(db, 'users', userCredential.user.uid), {
                    email: userCredential.user.email,
                    name: name,
                    createdAt: new Date(),
                    });
                    console.log("User document successfully written!");
                } catch (firestoreError) {
                    console.error("Firestore write error:", firestoreError);
                    alert(`User created but failed to save profile data: ${firestoreError.message}`);
                }
            }  catch (error) {
                console.error("Authentication or profile update error:", error);
                alert(`Registration failed: ${error.message}`);
            }
        } else {
            alert("Please fill all fields.");
        }; 
    };
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
                        <Text style={styles.title}>Create Your Account</Text>
                    </View>
                    <View style={styles.inputContainer}>
                        <Text style={styles.name}>Full Name</Text>
                        <TextInput 
                            style={styles.input} 
                            value={name}
                            onChangeText={value => setName(capitalizeName(value))}
                            placeholder="Enter Name" 
                            placeholderTextColor='#999'>
                        </TextInput>
                    </View>
                    <View style={styles.inputContainer}>
                        <Text style={styles.email}>Email Address</Text>
                        <TextInput 
                            style={styles.input} 
                            value={email}
                            onChangeText={value => setEmail(value)}
                            placeholder="Enter Email" 
                            placeholderTextColor='#999'>
                        </TextInput>
                    </View>
                    <View style={styles.inputContainer}>
                        <Text style={styles.password}>Password</Text>
                        <TextInput 
                            style={styles.input} 
                            value={password}
                            onChangeText={value => setPassword(value)}
                            placeholder="Enter Password" 
                            placeholderTextColor='#999'
                            secureTextEntry>
                        </TextInput>
                        <TouchableOpacity style={styles.registerButton}
                            onPress={() => {
                                if (agreed) {
                                    handleSubmit();
                                }
                                else {
                                    alert('You must agree to the Terms & Conditions')
                                }
                            }}
                        >
                            <Text style={styles.registerButtonText}>Register</Text>
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
                    <View style={styles.loginContainer}>
                        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                            <Text style={styles.loginText}>Already have an account? Log in</Text>
                        </TouchableOpacity>
                    </View>
                    <View style={styles.termsContainer}>
                        <TouchableOpacity 
                            onPress={() => setAgreed(!agreed)}
                            style={styles.checkbox}
                        >
                            <View style={[styles.checkboxBox, agreed && styles.checkboxChecked]}>
                            {agreed && <CheckIcon color="#fff" size={16} />}
                            </View> 
                        </TouchableOpacity>
                        <Text style={styles.termsText}>
                            I agree to the{' '}
                            <Text style={styles.linkText}
                                onPress={() => navigation.navigate('TermsAndConditions')}
                            >
                                Terms & Conditions
                            </Text>
                        </Text>
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
        marginTop: -150
    },
    image: {
        width: '50%',
        height: '50%',
    },
    titleContainer: {
        marginTop: -150
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
    name: {
        fontSize: 14,
        marginBottom: 10,
        color: '#4b382a'
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
    registerButton: {
        backgroundColor: '#4b382a',
        paddingVertical: 10,
        borderRadius: 16,
        marginTop: 20,
        paddingHorizontal: 16
    },
    registerButtonText: {
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
    loginContainer: {
        flex: 1,
        justifyContent: 'center',
        marginTop: 10
    },
    loginText: {
        color: '#4b382a',
        fontWeight: '400',
        fontFamily: 'Avenir, Montserrat, Corbel, URW Gothic, source-sans-pro, sans-serif',
        textAlign: 'center'
    },
    termsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 20,
        paddingHorizontal: 20,
    },
    checkbox: {
        marginRight: 12,
    },
    checkboxBox: {
        width: 20,
        height: 20,
        borderWidth: 1,
        borderColor: '#4b382a',
        borderRadius: 4,
        justifyContent: 'center',
        alignItems: 'center'
    },
    checkboxChecked: {
        backgroundColor: '#4b382a',
    },
    termsText: {
        color: '#4b382a',
        fontSize: 12
    },
    linkText: {
        color: '#4b382a',
        fontWeight: 'bold',
        textDecorationLine: 'underline',
    }
})