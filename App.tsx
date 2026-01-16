import "react-native-gesture-handler";
import * as React from "react";
import { enableScreens } from "react-native-screens";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import LibraryScreen from "./src/screens/LibraryScreen";
import ReaderScreen from "./src/screens/ReaderScreen";

enableScreens(true);

export type RootStackParamList = {
  Library: undefined;
  Reader: { versionSlug: string; indexPath: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen
          name="Library"
          component={LibraryScreen}
          options={{ title: "Django Docs" }}
        />
        <Stack.Screen name="Reader" component={ReaderScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
