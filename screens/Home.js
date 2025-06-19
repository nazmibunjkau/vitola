import React, { useEffect, useState } from "react"
import { StyleSheet, SafeAreaView, Text, View, TouchableOpacity } from "react-native"
import { auth } from "../config/firebase"
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../context/ThemeContext';

export default function Home({ navigation }) {
    const { theme } = useTheme();
    const [firstName, setFirstName] = useState("")

    useEffect(() => {
        const fetchUser = async () => {
            const user = auth.currentUser;
            if (user) {
                await user.reload();
                const name = user.displayName || "User";
                const first = name.split(" ")[0];
                setFirstName(first);
            }
        };
        fetchUser();
    }, []);
    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={styles.headerRow}>
                <View style={styles.textBlock}>
                    <Text style={[styles.greeting, { color: theme.text }]}>Hi, {firstName}</Text>
                    <Text style={[styles.subtext, { color: theme.text }]}>Welcome Back!</Text>
                </View>
                <TouchableOpacity style={styles.bellButton} onPress={() => navigation.navigate('NotificationScreen')}>
                    <Ionicons name="notifications-outline" size={28} color={theme.primary} />
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    )
} 

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingTop: 80,
        paddingHorizontal: 30,
        backgroundColor: '#fff'
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginRight: 10,
    },
    textBlock: {
        marginLeft: 24,
    },
    greeting: {
        fontSize: 34,
        fontWeight: '300',
        fontFamily: 'Avenir, Montserrat, Corbel, URW Gothic, source-sans-pro, sans-serif',
        color: '#4b382a',
        marginTop: 20,
        marginBottom: 6,
    },
    subtext: {
        fontSize: 16,
        fontWeight: '400',
        fontFamily: 'Avenir, Montserrat, Corbel, URW Gothic, source-sans-pro, sans-serif',
        color: '#7a5e47',
        marginTop: 12,
    },
    bellButton: {
        padding: 10,
        marginRight: 20,
    }
})