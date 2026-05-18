# Replay Comment Counter — 設計ドキュメント

**作成日:** 2026-05-18  
**対象リポジトリ:** Replay Counter (`/Users/myhome/Replay Counter /`)  
**方針:** ゼロから全面書き直し

---

## 概要

Dropbox Replay のコメントパネル上部に「合計コメント数」と「未解決コメント数」をカウント表示するChrome拡張機能。既存UIに溶け込む形でタブリストの直前に挿入する。

---

## アーキテクチャ

### ファイル構成

| ファイル | 変更 |
|---|---|
| `manifest.json` | permissions維持、content_scripts維持 |
| `content.js` | **全面書き直し**（メインロジック） |
| `background.js` | **削除** |
| `icons/` | **流用** |

### 処理フロー

```
初期化（DOMContentLoaded + 1500ms待機）
 └─ waitForTabList()     タブ一覧（.dig-Tabs-group）が描画されるまでポーリング
     └─ fetchCounts()    カウント取得
         └─ renderBadge() カウンターDOMをタブ上部に挿入・更新
             └─ observe()  MutationObserverで変化を監視・再実行
```

---

## データ取得ロジック

### カウント取得手順（fetchCounts）

1. 現在アクティブなタブ（`[role="tab"][aria-selected="true"]`）を記録
2. `[data-testid="all-comments-section"]` をクリック（「すべて」タブに切り替え）
3. 200ms待機（DOMレンダリング完了待ち）
4. `[data-testid="comment-thread-container"]` を全取得
5. 各要素の `__reactFiber*` キーから `memoizedProps.thread.isResolved` を読む
6. Reactファイバーが読めない要素はスキップ
7. 元のタブをクリックして復帰
8. 合計数・未解決数を算出してUIを更新

### Reactファイバー読み取り

```js
const reactKey = Object.keys(el).find(k => k.startsWith('__reactFiber'));
let fiber = el[reactKey];
for (let i = 0; i < 10; i++) {
  if (fiber?.memoizedProps?.thread) {
    return fiber.memoizedProps.thread.isResolved;
  }
  fiber = fiber?.return;
}
```

**採用理由:** Dropbox は Styled Components を使用しており、CSSクラス名（例: `sc-cOlMuv`）はビルドごとに変わる可能性がある。`data-testid` と Reactファイバーは内部仕様として安定している。

---

## UI設計

### 挿入位置

`UL.dig-Tabs-group`（タブリスト）の**直前**の親要素に `insertBefore` で挿入。

```
┌──────────────────────────────────────┐
│  コメントパネル                       │
│                                      │
│  💬 合計: 23件  |  ⚠️ 未解決: 23件   │ ← 挿入
│ ──────────────────────────────────── │
│  [ 未解決 ] [ 解決済み ] [ すべて ]   │
└──────────────────────────────────────┘
```

### HTML構造

```html
<div id="rpc-counter">
  <span id="rpc-total">💬 合計: -- 件</span>
  <span id="rpc-sep"> | </span>
  <span id="rpc-unresolved">⚠️ 未解決: -- 件</span>
</div>
```

### スタイル

- 背景・ボーダーなし（パネルに溶け込む）
- フォント: 12px、Dropboxのデフォルトフォント継承
- 未解決 = 0件: グレー表示
- 未解決 ≥ 1件: 未解決数をオレンジ（`#f5a623`）でハイライト
- 取得中: `--` 表示

---

## 更新タイミング

### MutationObserver設定

```
監視対象: document.body
オプション: { childList: true, subtree: true }
デバウンス: 800ms
```

### 再実行トリガー

- `comment-thread-container` の増減（コメント追加・削除）
- タブの `aria-selected` 変化（解決操作の検知）

---

## エッジケース対処

| ケース | 対処 |
|---|---|
| 「すべて」タブが存在しない | カウンター非表示（Replayページ以外への誤適用防止） |
| Reactファイバーが読めない要素 | その要素をスキップ（カウント除外） |
| ページ遷移（別動画） | URLの変化をMutationObserverで検知して再初期化 |
| 元タブへの復帰失敗 | 200ms後に必ずクリック（try/finallyで保証） |

---

## manifest.json の変更点

- `background.service_worker` を削除
- permissions: `activeTab`, `scripting` を維持
- content_scripts: `https://replay.dropbox.com/*` を維持
