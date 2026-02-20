# Power Apps Formula Floater

Power Apps Studio の「式入力」エリア（フォーミュラバー）を切り離して、ドラッグ移動・リサイズ可能なフローティングパネルとして表示する Chrome 拡張機能です。
React + TypeScript + Vite + CRXJS を利用してモダンなアーキテクチャで構築されています。

## 対応ブラウザ
Chrome / Edge (Manifest V3)

## インストールとビルド

1. 依存関係のインストール
   ```bash
   npm install
   ```
2. ビルド
   ```bash
   npm run build
   ```
3. 拡張機能の読み込み
   - Chrome/Edge の拡張機能ページで「デベロッパーモード」を有効化
   - 「パッケージ化されていない拡張機能を読み込む」で、生成された `dist` フォルダを選択

## 主な機能

- **フォーミュラの切り離し**: `Alt+Shift+F` または拡張機能アイコンのクリックでフォーミュラバーを切り離し。
- **ドラッグ＆リサイズ**: フローティングパネルとして自由に移動・サイズ変更が可能。
- **プロパティのタブ化**: Advancedタブやプロパティのコンボボックスから一覧を抽出し、ワンクリックでプロパティを切り替え。
- **ピン留め (Pins)**: 
  - プロパティ名の横にあるピンアイコンをクリックすると、プロパティをピン留めできます。
  - **永続化**: ピン留め状態はアプリごとに `chrome.storage.sync` に保存され、ページをリロードしても保持されます。
  - **リネーム追跡**: コントロールの名前が変更されても内部IDで追跡し、ピンの名前を自動更新します。
- **パネルスナップ**: 
  - `Alt+Shift+A` : 左端にスナップ
  - `Alt+Shift+D` : 右端にスナップ
  - `Alt+Shift+W` : 上端にスナップ
  - `Alt+Shift+S` : 下端にスナップ
- **不要エリアの非表示**: 新しいCopilotボタンエリアの空白を自動で検知して折りたたみ、エディタを広く使えます。

## 技術スタック
- **React 19** / **TypeScript**
- **Vite** / **@crxjs/vite-plugin** (HMR対応の拡張機能開発)
- **react-rnd** (ドラッグ＆リサイズ)

## ファイル構成
- `src/background/` : Service Worker (コマンドリスナー等のバックグラウンド処理)
- `src/content/` : Content Script (Power Apps StudioのDOM操作とReact UIの注入)
  - `components/` : Reactコンポーネント (`FloaterContainer`, `PinBar`, `PropertyTabs` 等)
  - `hooks/` : 状態管理カスタムフック (`usePins`, `useFloaterState`, `useControlName`)
  - `services/` : DOM操作やストレージのロジック分離 (`DomService`, `PowerAppsService`, `StorageService`)
- `src/content/styles/floater.css` : パネルやUIのスタイル定義
