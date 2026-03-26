# OLEIN Tools Hub

`OLEIN Tools Hub` は、デザイン・開発向けの小さなユーティリティをまとめた Web アプリです。
現在は、複数の制作・実装補助ツールを提供しています。

## 主な機能

- Fluid Typography の `clamp()` 生成
- Before / After スクリーンショットの差分比較
- 複数プリセットの同時管理と一括出力
- 生成した CSS 変数のクリップボードコピー
- 入力値バリデーション（`zod`）
- `localStorage` による設定・プリセット保持
- ページ単位の SEO メタタグ設定（`react-helmet-async`）

## 画面構成

- `/` : ツール一覧ページ
- `/fluid-typography` : Fluid Typography 計算ページ
- `/visual-regression` : 簡易ビジュアルリグレッションテストページ

## 技術スタック

- React 18
- TypeScript
- Vite 5
- React Router 6
- Tailwind CSS 3
- zod
- pixelmatch

## セットアップ

```bash
npm install
```

## 開発サーバー起動

```bash
npm run dev
```

## ビルド

```bash
npm run build
```

## ビルド結果のプレビュー

```bash
npm run preview
```

## 環境変数

SEO の canonical / OGP の絶対 URL を安定させる場合は、以下を設定してください。

- `VITE_SITE_URL`（例: `https://example.com`）

未設定時は、実行中の `window.location.origin` を使用します。

## ディレクトリ構成（主要）

```text
.
├── public/
│   ├── favicon.png
│   └── ogp-default-image.png
├── src/
│   ├── pages/
│   │   ├── HomePage.tsx
│   │   ├── FluidTypographyPage.tsx
│   │   ├── IntegrityPlusConverterPage.tsx
│   │   └── VisualRegressionPage.tsx
│   ├── seo/
│   │   ├── Seo.tsx
│   │   └── meta.ts
│   ├── App.tsx
│   ├── index.css
│   └── main.tsx
├── tailwind.config.ts
├── vite.config.ts
└── package.json
```

## 補足

このリポジトリはツールハブ形式のため、今後 `src/pages/` に新しいツールページを追加し、`src/pages/HomePage.tsx` と `src/App.tsx` に登録することで拡張できます。

## 今後追加予定のツールアイデア

- Flex/Gridカラム計算ツール
- CSS 変数スケールジェネレーター
- theme.json ジェネレーター
- WordPress 納品チェックツール
- SVGアイコン簡易ジェネレーター
- OGP画像テンプレジェネレーター
- JSON->CSV変換
- 画像リサイズ設計保護
