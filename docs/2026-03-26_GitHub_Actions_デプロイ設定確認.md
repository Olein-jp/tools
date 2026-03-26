# GitHub Actions デプロイ設定確認

## 注意

このドキュメントは、`SSH + rsync` 構成を使っていた時点の調査メモ。現在の workflow は `FTPS` ベースに戻しているため、現行設定の確認には別ドキュメントを参照すること。

関連ドキュメント:

- [2026-03-26_GitHub_Actions_FTPS復帰対応.md](./2026-03-26_GitHub_Actions_FTPS復帰対応.md)
- [2026-03-26_GitHub_Actions_シークレット設定サンプル.md](./2026-03-26_GitHub_Actions_シークレット設定サンプル.md)

## 発生していたエラー

GitHub Actions の deploy job で、以下のエラーが発生していた。

```text
Bad port ''
```

このエラーは、`.github/workflows/deploy.yml` 内の以下コマンド実行時に `DEPLOY_PORT` が空文字だったために起きる。

```bash
ssh-keyscan -p "${DEPLOY_PORT}" -H "${DEPLOY_HOST}" >> ~/.ssh/known_hosts
```

関連ソース:

- [.github/workflows/deploy.yml](.github/workflows/deploy.yml)

## 原因

`deploy.yml` では、GitHub Secrets から以下の値を環境変数へ渡している。

- `XSERVER_HOST`
- `XSERVER_PORT`
- `XSERVER_USERNAME`
- `XSERVER_DEPLOY_PATH`
- `XSERVER_PRIVATE_KEY`

今回のログでは `DEPLOY_HOST` `DEPLOY_PORT` `DEPLOY_USER` `DEPLOY_PATH` がすべて空だったため、主因は GitHub リポジトリまたは Environment 側で secrets が未設定、もしくは secret 名が workflow の参照名と一致していないことだと判断できる。

## 対応内容

`deploy.yml` に `Validate deploy secrets` ステップを追加し、必須 secret が空のときは SSH 処理に進む前に失敗させるようにした。

これにより、今後は `Bad port ''` ではなく、どの secret が未設定かを Actions のログ上で直接確認できる。

## 確認すべき項目

GitHub の `Settings > Secrets and variables > Actions` で、以下の secret が登録されているか確認する。

- `XSERVER_HOST`
  - 例: `sv***.xserver.jp`
- `XSERVER_PORT`
  - 通常は `10022` など、SSH 用ポート番号を数値で設定する
- `XSERVER_USERNAME`
  - SSH 接続に使うユーザー名
- `XSERVER_DEPLOY_PATH`
  - 配置先ディレクトリの絶対パスまたは契約環境に応じたパス
- `XSERVER_PRIVATE_KEY`
  - 改行を含めた秘密鍵全文

## 補足

- GitHub Environment を使っている場合は、リポジトリ secret ではなく Environment secret にだけ登録している可能性もある。その場合、workflow 側で対象 Environment を指定していないと値は渡されない。
- `XSERVER_PORT` は空文字だけでなく数値以外でも失敗するため、workflow 側で数値チェックも追加した。
