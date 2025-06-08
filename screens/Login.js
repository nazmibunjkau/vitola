import { StyleSheet } from "react-native"
import { View, TouchableOpacity, Text } from "react-native"

export default function Login({navigation}) {
    return (
        <View styles={styles.container}>
            <TouchableOpacity style={styles.forgotPasswordContainer}>
                <Text style={styles.forgotPassword}>Forgot Password?</Text>
            </TouchableOpacity>
        </View>
    )
} 

const styles = StyleSheet.create({
    forgotPasswordContainer: {
        alignItems: 'flex-end',
        marginTop: 10,
        paddingHorizontal: 20
    },
    forgotPassword: {
        color: '#4b4b4b',
        fontSize: 12
    },
})