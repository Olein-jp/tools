# GitHub Actions FTPS復帰対応

## 概要

GitHub Actions のデプロイ方式を、`SSH + rsync` から以前使っていた `FTPS` ベースの構成へ戻した。

対象 workflow:

- [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml)

## 変更内容

- `XSERVER_*` 系の secret を参照する構成を削除した
- SSH 鍵設定、`ssh-keyscan`、`ssh`、`rsync` の各ステップを削除した
- `SamKirkland/FTP-Deploy-Action@v4.3.5` を使う `FTPS` デプロイへ戻した
- `dist/__deploy_check.txt` を生成する deploy marker は維持した

## 現在の deploy 設定

現在の workflow では以下の設定でアップロードする。

- アクション: `SamKirkland/FTP-Deploy-Action@v4.3.5`
- protocol: `ftps`
- port: `21`
- local-dir: `./dist/`
- server-dir: `${{ secrets.FTP_SERVER_DIR }}`

## 必要な secret

- `FTP_SERVER`
- `FTP_USERNAME`
- `FTP_PASSWORD`
- `FTP_SERVER_DIR`

具体例は [2026-03-26_GitHub_Actions_シークレット設定サンプル.md](./2026-03-26_GitHub_Actions_シークレット設定サンプル.md) を参照。

## 変更理由

- 以前の運用形態に合わせる依頼があったため
- リポジトリ履歴上でも、デプロイはもともと `FTP/FTPS` ベースで運用されていたため

## 補足

- `FTP_SERVER_DIR` が誤っていると、正しい公開ディレクトリに反映されない
- `FTPS` 接続可否や認証情報の正しさは、GitHub Actions 実行時のログで確認する
- 旧 `SSH + rsync` 構成の履歴確認は [2026-03-26_GitHub_Actions_デプロイ方式変遷確認.md](./2026-03-26_GitHub_Actions_デプロイ方式変遷確認.md) を参照
