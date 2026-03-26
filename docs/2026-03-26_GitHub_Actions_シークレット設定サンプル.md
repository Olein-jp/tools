# GitHub Actions シークレット設定サンプル

## 概要

GitHub Actions でエックスサーバーへデプロイするために必要な `Secrets` のサンプルをまとめる。

対象 workflow:

- [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml)

## 設定する secret 一覧

現在の workflow では、以下の 4 つを GitHub の `Settings > Secrets and variables > Actions` に登録する。

- `FTP_SERVER`
- `FTP_USERNAME`
- `FTP_PASSWORD`
- `FTP_SERVER_DIR`

## サンプル

### `FTP_SERVER`

```text
sv12345.xserver.jp
```

- FTP または FTPS 接続先のホスト名を入れる
- 契約サーバー情報に記載されている `sv*****.xserver.jp` 形式の値を使う

### `FTP_USERNAME`

```text
olein-example
```

- FTP 接続用のユーザー名を入れる
- エックスサーバーで利用している FTP アカウント情報を確認する

### `FTP_PASSWORD`

```text
your-ftp-password
```

- FTP 接続用のパスワードを入れる
- GitHub Secrets 上で管理し、平文でリポジトリに置かない

### `FTP_SERVER_DIR`

```text
/example.com/public_html/tools/
```

- `dist/` の内容を配置したいサーバー上のディレクトリを入れる
- FTP デプロイアクションでは `server-dir` にアップロード先ディレクトリを指定する
- エックスサーバーの公開ディレクトリ構成に合わせて設定する
- 末尾スラッシュは付けておくと意図が分かりやすい

## コピペ用サンプル一覧

```text
FTP_SERVER=sv12345.xserver.jp
FTP_USERNAME=olein-example
FTP_PASSWORD=your-ftp-password
FTP_SERVER_DIR=/example.com/public_html/tools/
```

## 登録時の注意

- workflow 側では `protocol: ftps` `port: 21` を使用している
- `FTP_SERVER_DIR` はアップロード先ディレクトリを正しく指すように設定する
- `.github/` やソース一式ではなく `dist/` の内容だけがアップロードされる
- GitHub Environment を使う場合は、workflow 側で Environment 指定がないと secret が渡らない

## どの値を確認すればよいか

- ホスト名: エックスサーバーのサーバー情報
- ユーザー名とパスワード: FTP アカウント情報
- 配置先パス: 公開ディレクトリ構成

## 関連ドキュメント

- [2026-03-26_GitHub_Actions_デプロイ方式変遷確認.md](./2026-03-26_GitHub_Actions_デプロイ方式変遷確認.md)
- [2026-03-26_GitHub_Actions_FTPS復帰対応.md](./2026-03-26_GitHub_Actions_FTPS復帰対応.md)
