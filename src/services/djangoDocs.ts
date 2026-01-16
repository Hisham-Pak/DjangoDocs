export type DjangoVersion = {
  slug: string;       // "dev", "6.0", "5.2", ...
  pageUrl: string;    // https://docs.djangoproject.com/en/<slug>/
};

const DOCS_HOME = "https://docs.djangoproject.com/";

function uniq<T>(arr: T[]) {
  return Array.from(new Set(arr));
}

export async function fetchAvailableVersions(): Promise<DjangoVersion[]> {
  const res = await fetch(DOCS_HOME, { redirect: "follow" } as any);
  const html = await res.text();

  // Find all /en/<slug>/ occurrences
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
  const pageUrl = `https://docs.djangoproject.com/en/${versionSlug}/`;
  const res = await fetch(pageUrl);
  const html = await res.text();

  // Prefer explicit zip link from page HTML
  const m = html.match(/https:\/\/media\.djangoproject\.com\/docs\/[^"]+?\.zip/);
  if (m?.[0]) return m[0];

  // Fallback for numeric versions
  if (/^\d+\.\d+$/.test(versionSlug)) {
    return `https://media.djangoproject.com/docs/django-docs-${versionSlug}-en.zip`;
  }

  // dev may not have an offline zip
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
