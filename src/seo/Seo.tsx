import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';
import { type PageSeo, SITE_SEO } from './meta';

type SeoProps = {
  meta: PageSeo;
};

function resolveOrigin(): string | null {
  if (SITE_SEO.siteUrl) {
    return SITE_SEO.siteUrl;
  }

  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  return null;
}

function toAbsoluteUrl(origin: string | null, path: string): string | null {
  if (!origin) {
    return null;
  }

  try {
    return new URL(path, origin).toString();
  } catch {
    return null;
  }
}

export function Seo({ meta }: SeoProps) {
  const location = useLocation();

  const pagePath = meta.path ?? location.pathname;
  const origin = resolveOrigin();
  const canonical = toAbsoluteUrl(origin, pagePath);
  const imagePath = meta.image ?? SITE_SEO.defaultImagePath;
  const imageUrl = toAbsoluteUrl(origin, imagePath);
  const pageTitle = meta.title.includes(SITE_SEO.siteName) ? meta.title : `${meta.title} | ${SITE_SEO.siteName}`;
  const robots = meta.noindex ? 'noindex,nofollow' : 'index,follow';

  return (
    <Helmet>
      <html lang="ja" />
      <title>{pageTitle}</title>
      <meta name="description" content={meta.description} />
      <meta name="robots" content={robots} />

      {canonical ? <link rel="canonical" href={canonical} /> : null}

      <meta property="og:site_name" content={SITE_SEO.siteName} />
      <meta property="og:locale" content={SITE_SEO.locale} />
      <meta property="og:type" content={meta.type ?? SITE_SEO.defaultType} />
      <meta property="og:title" content={pageTitle} />
      <meta property="og:description" content={meta.description} />
      {canonical ? <meta property="og:url" content={canonical} /> : null}
      {imageUrl ? <meta property="og:image" content={imageUrl} /> : null}

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={pageTitle} />
      <meta name="twitter:description" content={meta.description} />
      {imageUrl ? <meta name="twitter:image" content={imageUrl} /> : null}
    </Helmet>
  );
}
