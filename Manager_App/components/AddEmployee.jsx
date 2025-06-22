import React, { useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Alert, Keyboard } from "react-native";
import axios from "axios";
import { useNavigation, useRoute } from "@react-navigation/native";
import { SERVER_URL } from "@env";

const AddEmployee = () =>{
    const [fullName, setFullName] = useState(null);
    return (
        <View>
            <TextInput
               placeholder="Full Name"
               value={fullName}
               onChangeText={(text) => setFullName(text)}
            />
            <TextInput
               placeholder="Full Name"
               value={fullName}
               onChangeText={(text) => setFullName(text)}
            />
        </View>
    )
}

export default AddEmployee;