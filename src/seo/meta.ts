export type PageSeo = {
  title: string;
  description: string;
  path?: string;
  type?: 'website' | 'article';
  image?: string;
  noindex?: boolean;
};

export const SITE_SEO = {
  siteName: 'オレインツール',
  siteUrl: import.meta.env.VITE_SITE_URL as string | undefined,
  defaultImagePath: '/ogp-default-image.png',
  defaultType: 'website' as const,
  locale: 'ja_JP'
};

export const PAGE_SEO = {
  home: {
    title: 'オレインツール',
    description:
      '開発や政策を通して自分が欲しいと思ったツールを作って公開しています。',
    path: '/'
  },
  fluidTypography: {
    title: 'Fluid Typography (clamp) Calculator',
    description:
      '最小・最大フォントサイズとビューポート幅から clamp() を生成できる Fluid Typography 計算ツール。',
    path: '/fluid-typography'
  },
  integrityPlusConverter: {
    title: 'Integrity Plus Converter',
    description:
      'Integrity Plus の XML / CSV テキストを、Googleスプレッドシート貼り付け向けの TSV へ変換するツール。',
    path: '/integrity-plus-converter'
  }
} satisfies Record<string, PageSeo>;
