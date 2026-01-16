import React, { useEffect, useMemo, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Alert, RefreshControl } from "react-native";
import RNFS from "react-native-fs";
import NetInfo from "@react-native-community/netinfo";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../App";
import { fetchAvailableVersions, fetchOfflineZipUrl } from "../services/djangoDocs";
import { getDownloadedMap, setDownloadedMap, DownloadedMap, getCachedVersions, setCachedVersions } from "../services/storage";
import { downloadZip, findIndexHtml, unzipDocs, versionRootDir, ensureDir, docsRoot } from "../services/download";

type Props = NativeStackScreenProps<RootStackParamList, "Library">;

export default function LibraryScreen({ navigation }: Props) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [versions, setVersions] = useState<{ slug: string; pageUrl: string }[]>([]);
  const [downloaded, setDownloaded] = useState<DownloadedMap>({});

  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);

  const data = useMemo(() => versions, [versions]);

  async function loadOfflineFirst() {
    // Always load downloaded docs map (works offline)
    const dl = await getDownloadedMap();
    setDownloaded(dl);

    // Load cached versions list (works offline)
    const cached = await getCachedVersions();
    if (cached?.versions?.length) {
      setVersions(cached.versions);
      return { hadCache: true };
    }

    // No cache yet: only then try network (first-run requirement)
    const net = await NetInfo.fetch();
    const online = !!net.isConnected && !!net.isInternetReachable;

    if (!online) {
      // Offline + no cache: still show downloaded items if any
      if (Object.keys(dl).length > 0) {
        // Show a minimal list from downloaded versions so user can open them
        const fallback = Object.keys(dl).map((slug) => ({
          slug,
          pageUrl: `https://docs.djangoproject.com/en/${slug}/`,
        }));
        setVersions(fallback);
      } else {
        setVersions([]);
      }
      return { hadCache: false, needsInternet: true };
    }

    // Online first run: fetch versions once and cache them
    const v = await fetchAvailableVersions();
    setVersions(v);
    await setCachedVersions(v);
    return { hadCache: false, needsInternet: false };
  }

  useEffect(() => {
    (async () => {
      try {
        const res = await loadOfflineFirst();
        if (res.needsInternet) {
          Alert.alert(
            "First run needs internet",
            "Connect to the internet once to load available Django versions and download docs. After you download a version, it works fully offline."
          );
        }
      } catch (e: any) {
        Alert.alert("Error", e?.message ?? "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function open(slug: string) {
    const info = downloaded[slug];
    if (!info) return;
    navigation.navigate("Reader", { versionSlug: slug, indexPath: info.indexPath });
  }

  async function download(slug: string) {
    try {
      // Internet is required for downloads (by definition)
      const net = await NetInfo.fetch();
      const online = !!net.isConnected && !!net.isInternetReachable;
      if (!online) {
        Alert.alert("Offline", "You’re offline. Connect to the internet to download this version.");
        return;
      }

      setBusySlug(slug);
      setProgress(0);

      const zipUrl = await fetchOfflineZipUrl(slug);
      if (!zipUrl) {
        Alert.alert("Not available", `No offline zip found for "${slug}". (Dev may be online-only.)`);
        return;
      }

      await ensureDir(docsRoot());
      const root = versionRootDir(slug);
      await ensureDir(root);

      const zipPath = `${root}/docs.zip`;
      await downloadZip(zipUrl, zipPath, setProgress);
      await unzipDocs(zipPath, root);

      try { await RNFS.unlink(zipPath); } catch {}

      const indexPath = await findIndexHtml(root);

      const next: DownloadedMap = {
        ...downloaded,
        [slug]: { indexPath, downloadedAt: Date.now(), zipUrl },
      };

      setDownloaded(next);
      await setDownloadedMap(next);

      navigation.navigate("Reader", { versionSlug: slug, indexPath });
    } catch (e: any) {
      Alert.alert("Download error", e?.message ?? "Failed");
    } finally {
      setBusySlug(null);
    }
  }

  async function onRefresh() {
    // IMPORTANT: since you want “internet only on first run”:
    // we do NOT fetch network versions here.
    // Refresh just reloads local storage/cached versions.
    setRefreshing(true);
    try {
      const dl = await getDownloadedMap();
      setDownloaded(dl);

      const cached = await getCachedVersions();
      if (cached?.versions?.length) {
        setVersions(cached.versions);
      } else {
        // If cache was wiped, refresh behaves like first run:
        await loadOfflineFirst();
      }
    } finally {
      setRefreshing(false);
    }
  }

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
        <Text style={{ marginTop: 8 }}>Loading…</Text>
      </View>
    );
  }

  // If no versions and no downloaded docs, show a friendly empty state
  if (data.length === 0 && Object.keys(downloaded).length === 0) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
        <Text style={{ fontSize: 18, fontWeight: "600" }}>No docs yet</Text>
        <Text style={{ marginTop: 10, textAlign: "center", color: "#666" }}>
          Connect to the internet once to load versions and download a Django docs set.
          After downloading, everything works offline.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={data}
        keyExtractor={(i) => i.slug}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: "#eeeeeeff" }} />}
        renderItem={({ item }) => {
          const isDownloaded = !!downloaded[item.slug];
          const isBusy = busySlug === item.slug;

          return (
            <View style={{ padding: 14, backgroundColor: "" }}>
              <Text style={{ fontSize: 18, fontWeight: "600" }}>{item.slug}</Text>
              <Text style={{ color: "#666", marginTop: 4 }}>
                {isDownloaded ? "Downloaded" : "Not downloaded"}
              </Text>

              <View style={{ flexDirection: "row", gap: 12, marginTop: 10 }}>
                {isDownloaded && (
                  <TouchableOpacity
                    onPress={() => open(item.slug)}
                    style={{ padding: 10, backgroundColor: "#d1fae5", borderRadius: 8 }}
                  >
                    <Text>Open</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  disabled={!!busySlug}
                  onPress={() => download(item.slug)}
                  style={{
                    padding: 10,
                    backgroundColor: isBusy ? "#ddd" : "#fff7ed",
                    borderRadius: 8,
                    opacity: !!busySlug && !isBusy ? 0.5 : 1,
                  }}
                >
                  <Text>{isBusy ? "Downloading…" : isDownloaded ? "Re-download" : "Download"}</Text>
                </TouchableOpacity>
              </View>

              {isBusy && (
                <Text style={{ marginTop: 8, color: "#444" }}>
                  {Math.round(progress * 100)}%
                </Text>
              )}
            </View>
          );
        }}
      />
    </View>
  );
}
