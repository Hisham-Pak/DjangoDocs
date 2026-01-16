import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, Alert } from "react-native";
import { WebView } from "react-native-webview";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../App";
import { findSearchHtml, versionRootDir } from "../services/download";
import RNFS from "react-native-fs";

type Props = NativeStackScreenProps<RootStackParamList, "Reader">;

function toFileUrl(absPath: string) {
  return `file://${absPath}`;
}

export default function ReaderScreen({ route, navigation }: Props) {
  const { versionSlug, indexPath } = route.params;
  const [currentUrl, setCurrentUrl] = useState(toFileUrl(indexPath));
  const [searchPath, setSearchPath] = useState<string | null>(null);

  useEffect(() => {
    navigation.setOptions({ title: `Django ${versionSlug}` });

    (async () => {
      try {
        const root = versionRootDir(versionSlug);
        const sp = await findSearchHtml(root);
        setSearchPath(sp);
      } catch {
        setSearchPath(null);
      }
    })();
  }, [versionSlug, navigation]);

  function openSearch() {
    if (!searchPath) {
      Alert.alert("Search not found", "This offline package did not include search.html.");
      return;
    }
    setCurrentUrl(toFileUrl(searchPath));
  }

  function openHome() {
    setCurrentUrl(toFileUrl(indexPath));
  }

  return (
    <View style={{ flex: 1 }}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          padding: 10,
          borderBottomWidth: 1,
          borderBottomColor: "#eee",
        }}
      >
        <TouchableOpacity onPress={openHome} style={{ padding: 8, backgroundColor: "#e8f0fe", borderRadius: 8 }}>
          <Text>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={openSearch} style={{ padding: 8, backgroundColor: "#fff7ed", borderRadius: 8 }}>
          <Text>Search</Text>
        </TouchableOpacity>
      </View>

      <WebView
        source={{ uri: currentUrl }}
        originWhitelist={["*"]}
        allowFileAccess
        allowUniversalAccessFromFileURLs
        javaScriptEnabled
        domStorageEnabled
      />
    </View>
  );
}
