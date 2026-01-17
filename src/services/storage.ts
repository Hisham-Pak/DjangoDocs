import AsyncStorage from "@react-native-async-storage/async-storage";
import type { DjangoVersion } from "./djangoDocs";

// bumped keys because cached versions now include zipUrl/sha/ref
const DOWNLOADED_KEY = "downloaded_versions_v2";
const VERSIONS_CACHE_KEY = "versions_cache_v2";

export type DownloadedMap = Record<
  string,
  {
    indexPath: string;
    downloadedAt: number;
    zipUrl?: string;
    etag?: string;
    lastModified?: string;

    // optional: store build identity (useful for "Update available")
    sha?: string;
    ref?: string;
  }
>;

export type CachedVersions = {
  savedAt: number;
  versions: DjangoVersion[];
};

export async function getDownloadedMap(): Promise<DownloadedMap> {
  const raw = await AsyncStorage.getItem(DOWNLOADED_KEY);
  return raw ? JSON.parse(raw) : {};
}

export async function setDownloadedMap(map: DownloadedMap) {
  await AsyncStorage.setItem(DOWNLOADED_KEY, JSON.stringify(map));
}

export async function getCachedVersions(): Promise<CachedVersions | null> {
  const raw = await AsyncStorage.getItem(VERSIONS_CACHE_KEY);
  return raw ? JSON.parse(raw) : null;
}

export async function setCachedVersions(versions: DjangoVersion[]) {
  const payload: CachedVersions = { savedAt: Date.now(), versions };
  await AsyncStorage.setItem(VERSIONS_CACHE_KEY, JSON.stringify(payload));
}
