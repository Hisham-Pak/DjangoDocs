export type DjangoVersion = {
  slug: string;       // "dev", "6.0", "5.2", ...
  pageUrl: string;    // https://docs.djangoproject.com/en/<slug>/
  zipUrl?: string;    // direct zip url (from your manifest)
  sha?: string;       // commit SHA used to build (for update detection)
  ref?: string;       // "main" for dev, or tag like "5.2.3"
};

type Manifest = {
  generatedAt: string;
  releaseTag: string;
  manifestUrl?: string;
  versions: DjangoVersion[];
};

// ✅ configure these for your repo
const GH_OWNER = "Hisham-Pak";
const GH_REPO = "DjangoDocs";
const GH_TAG = "offline-docs";

// GitHub Release asset download URL for manifest.json
const MANIFEST_URL = `https://github.com/${GH_OWNER}/${GH_REPO}/releases/download/${GH_TAG}/manifest.json`;

// Optional fallback (if manifest is unavailable)
const DOCS_HOME = "https://docs.djangoproject.com/";

function uniq<T>(arr: T[]) {
  return Array.from(new Set(arr));
}

/**
 * Now: versions come from your backendless manifest.json (preferred).
 * Fallback: scrape docs.djangoproject.com for slugs (no zipUrl info).
 */
export async function fetchAvailableVersions(): Promise<DjangoVersion[]> {
  // 1) Prefer manifest (authoritative + includes zipUrl, dev, etc.)
  try {
    const res = await fetch(MANIFEST_URL);
    if (res.ok) {
      const m = (await res.json()) as Manifest;
      if (Array.isArray(m?.versions) && m.versions.length) {
        return m.versions;
      }
    }
  } catch {
    // ignore; fallback below
  }

  // 2) Fallback: scrape homepage for available slugs
  const res = await fetch(DOCS_HOME, { redirect: "follow" } as any);
  const html = await res.text();

  const matches = html.matchAll(/\/en\/([a-z0-9.\-]+)\//gi);

  const slugs = uniq(Array.from(matches, (m) => (m[1] || "").toLowerCase()))
    .filter((s) => s === "dev" || /^\d+\.\d+$/.test(s))
    .sort((a, b) => {
      if (a === "dev") return -1;
      if (b === "dev") return 1;
      const [amaj, amin] = a.split(".").map(Number);
      const [bmaj, bmin] = b.split(".").map(Number);
      if (amaj !== bmaj) return bmaj - amaj;
      return bmin - amin;
    });

  return slugs.map((slug) => ({
    slug,
    pageUrl: `https://docs.djangoproject.com/en/${slug}/`,
  }));
}

export async function fetchOfflineZipUrl(versionSlug: string): Promise<string | null> {
  // Try manifest first
  try {
    const res = await fetch(MANIFEST_URL);
    if (res.ok) {
      const m = (await res.json()) as Manifest;
      const found = m?.versions?.find((v) => v.slug === versionSlug);
      if (found?.zipUrl) return found.zipUrl;
    }
  } catch {
    // ignore
  }

  // Fallback behavior (older approach)
  const pageUrl = `https://docs.djangoproject.com/en/${versionSlug}/`;
  const res = await fetch(pageUrl);
  const html = await res.text();

  const m = html.match(/https:\/\/media\.djangoproject\.com\/docs\/[^"]+?\.zip/);
  if (m?.[0]) return m[0];

  if (/^\d+\.\d+$/.test(versionSlug)) {
    return `https://media.djangoproject.com/docs/django-docs-${versionSlug}-en.zip`;
  }

  return null;
}

export type RemoteZipMeta = {
  etag?: string;
  lastModified?: string;
};

export async function headZipMeta(zipUrl: string): Promise<RemoteZipMeta> {
  const res = await fetch(zipUrl, { method: "HEAD" });
  if (!res.ok) throw new Error(`HEAD failed (${res.status})`);

  return {
    etag: res.headers.get("etag") ?? undefined,
    lastModified: res.headers.get("last-modified") ?? undefined,
  };
}
