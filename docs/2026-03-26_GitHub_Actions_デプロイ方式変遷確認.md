# GitHub Actions デプロイ方式変遷確認

## 結論

以前の GitHub Actions によるデプロイは `SSH` ではなく `FTP` ベースだった。途中で `FTPS` 指定に調整されており、現在は `SSH + rsync` に切り替わっている。

## 確認結果

### 初期の workflow

コミット `df4178d` で `.github/workflows/deploy.yml` が追加されており、`SamKirkland/FTP-Deploy-Action@v4.3.5` を使ってデプロイしていた。

関連ソース:

- [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml)

当時の設定で使われていた secret は以下。

- `FTP_SERVER`
- `FTP_USERNAME`
- `FTP_PASSWORD`
- `FTP_SERVER_DIR`

### FTP から FTPS への調整

コミット `22606a4` では、同じ `FTP-Deploy-Action` を使いながら以下が追加されていた。

- `protocol: ftps`
- `port: 21`
- `log-level: verbose`

このため、少なくともこの時点では「単純な FTP」というより「FTPS 指定でのアップロード」に調整されていたと判断できる。

### 現在の workflow

現在の [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) では、以下の処理に変わっている。

- `XSERVER_PRIVATE_KEY` を使って SSH 鍵を設定
- `ssh-keyscan` で `known_hosts` を作成
- `ssh` でリモートディレクトリを作成
- `rsync` を `ssh` 経由で実行して `dist/` を配置

使っている secret も以下へ変更されている。

- `XSERVER_HOST`
- `XSERVER_PORT`
- `XSERVER_USERNAME`
- `XSERVER_DEPLOY_PATH`
- `XSERVER_PRIVATE_KEY`

## 変遷の流れ

`git log --reverse --oneline -- .github/workflows/deploy.yml` の結果は以下の順だった。

1. `df4178d` `Add GitHub Actions workflow for FTP deploy`
2. `22606a4` `Adjust FTP deploy settings for XSERVER`
3. `c1a2a80` `Add deploy marker file for FTP path verification`
4. `e186968` `簡易ビジュアルリグレッションツールを追加`

このため、認識としては「以前は GitHub Actions から FTP 系でアップロードしており、現在は SSH ベースへ移行済み」で問題ない。

## 補足

- 現在の SSH ベース設定については [GitHub_Actions_デプロイ設定確認.md](./2026-03-26_GitHub_Actions_デプロイ設定確認.md) も参照。
- secret 名が `FTP_*` から `XSERVER_*` に変わっているため、昔の設定を見返す場合は名前の違いに注意する。
