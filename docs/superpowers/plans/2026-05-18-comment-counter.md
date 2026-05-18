# Replay Comment Counter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dropbox Replayのコメントパネル上部に「合計コメント数 / 未解決コメント数」をリアルタイム表示するChrome拡張機能を全面書き直しで実装する。

**Architecture:** content.jsのみで完結。ページロード時に「すべて」タブへ一時切り替えし、Reactファイバー（`thread.isResolved`）から合計・未解決数を取得。タブリスト（`UL.dig-Tabs-group`）の直前にカウンターDOMを挿入し、MutationObserver（800msデバウンス）で自動更新する。

**Tech Stack:** Chrome Extension Manifest V3、Vanilla JS（フレームワークなし）、Reactファイバー読み取り（内部API）

---

## ファイルマップ

| ファイル | 変更内容 |
|---|---|
| `manifest.json` | `background.service_worker` フィールドを削除 |
| `background.js` | **削除** |
| `content.js` | **全面書き直し** |

---

### Task 1: manifest.json の更新と background.js の削除

**Files:**
- Modify: `manifest.json`
- Delete: `background.js`

- [ ] **Step 1: manifest.json から background フィールドを削除する**

`manifest.json` を以下の内容に書き換える：

```json
{
  "manifest_version": 3,
  "name": "Replay Comment Counter",
  "version": "2.0",
  "description": "Dropbox Replay のコメント総数と未解決数をパネル上部に表示する拡張",
  "permissions": ["activeTab", "scripting"],
  "action": {
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    },
    "default_title": "Replay Comment Counter"
  },
  "content_scripts": [
    {
      "matches": ["https://replay.dropbox.com/*"],
      "js": ["content.js"]
    }
  ],
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

- [ ] **Step 2: background.js を削除する**

```bash
rm "/Users/myhome/Replay Counter /background.js"
```

- [ ] **Step 3: 拡張機能をChromeに再読み込みして構文エラーがないことを確認する**

1. `chrome://extensions/` を開く
2. 「Replay Comment Counter」の「再読み込み」ボタンをクリック
3. エラーバッジが出ないことを確認

- [ ] **Step 4: コミット**

```bash
cd "/Users/myhome/Replay Counter "
git add manifest.json
git rm background.js
git commit -m "chore: remove background worker, bump version to 2.0"
```

---

### Task 2: Reactファイバー読み取り関数の実装

**Files:**
- Create: `content.js`（空ファイルから開始）

- [ ] **Step 1: content.js を新規作成し、Reactファイバー読み取り関数を書く**

```js
// 1要素のthread.isResolvedをReactファイバー経由で取得する
// 読めなければ null を返す
function readIsResolved(el) {
  const reactKey = Object.keys(el).find(k => k.startsWith('__reactFiber'));
  if (!reactKey) return null;
  let fiber = el[reactKey];
  for (let i = 0; i < 10; i++) {
    if (fiber?.memoizedProps?.thread) {
      return fiber.memoizedProps.thread.isResolved === true;
    }
    fiber = fiber?.return;
  }
  return null;
}
```

- [ ] **Step 2: Chromeコンソールで動作確認する**

Dropbox Replayのページを開き、DevTools Console で以下を実行：

```js
// content.jsはまだ読み込まれていないため直接貼り付けて確認
function readIsResolved(el) {
  const reactKey = Object.keys(el).find(k => k.startsWith('__reactFiber'));
  if (!reactKey) return null;
  let fiber = el[reactKey];
  for (let i = 0; i < 10; i++) {
    if (fiber?.memoizedProps?.thread) {
      return fiber.memoizedProps.thread.isResolved === true;
    }
    fiber = fiber?.return;
  }
  return null;
}
// 「すべて」タブをクリック後
document.querySelector('[data-testid="all-comments-section"]').click();
setTimeout(() => {
  const els = document.querySelectorAll('[data-testid="comment-thread-container"]');
  console.log('total:', els.length);
  console.log('sample isResolved:', readIsResolved(els[0]));
}, 300);
```

期待結果: `total: 23`（実際の件数）、`sample isResolved: false`

---

### Task 3: fetchCounts 関数の実装

**Files:**
- Modify: `content.js`

- [ ] **Step 1: fetchCounts 関数を追加する**

`content.js` に以下を追記：

```js
// 「すべて」タブに一時切り替えしてコメント数を取得する
// 戻り値: Promise<{ total: number, unresolved: number }>
function fetchCounts() {
  return new Promise((resolve) => {
    const allTab = document.querySelector('[data-testid="all-comments-section"]');
    if (!allTab) {
      resolve({ total: 0, unresolved: 0 });
      return;
    }

    const activeTab = document.querySelector('[role="tab"][aria-selected="true"]');

    try {
      allTab.click();
    } catch (_) {
      resolve({ total: 0, unresolved: 0 });
      return;
    }

    setTimeout(() => {
      try {
        const containers = document.querySelectorAll('[data-testid="comment-thread-container"]');
        let total = 0;
        let unresolved = 0;
        containers.forEach((el) => {
          const isResolved = readIsResolved(el);
          if (isResolved === null) return; // 読めない要素はスキップ
          total++;
          if (!isResolved) unresolved++;
        });
        resolve({ total, unresolved });
      } finally {
        // 元タブに必ず戻す
        activeTab?.click();
      }
    }, 200);
  });
}
```

- [ ] **Step 2: Chromeコンソールで動作確認する**

拡張機能を再読み込み後、DevTools Console で：

```js
// fetchCountsはcontent.jsのスコープ内なので、content.jsに以下を一時追記してテスト
// ファイル末尾に: fetchCounts().then(r => console.log('counts:', r));
```

`content.js` 末尾に一時追記：

```js
fetchCounts().then(r => console.log('counts:', r));
```

Chromeで再読み込みしてConsoleを確認。  
期待結果: `counts: {total: 23, unresolved: 23}`（実際の件数）

一時追記を削除する。

---

### Task 4: renderBadge 関数の実装（UI挿入）

**Files:**
- Modify: `content.js`

- [ ] **Step 1: renderBadge 関数を追加する**

`content.js` に以下を追記：

```js
const COUNTER_ID = 'rpc-counter';

// カウンターDOMをタブリスト直前に挿入 or 更新する
function renderBadge(total, unresolved) {
  const tabList = document.querySelector('ul.dig-Tabs-group');
  if (!tabList) return;

  let counter = document.getElementById(COUNTER_ID);

  // 初回挿入
  if (!counter) {
    counter = document.createElement('div');
    counter.id = COUNTER_ID;
    counter.style.cssText = [
      'display: flex',
      'gap: 8px',
      'padding: 6px 12px 4px',
      'font-size: 12px',
      'font-family: inherit',
      'align-items: center',
    ].join(';');
    tabList.parentElement.insertBefore(counter, tabList);
  }

  const unresolvedColor = unresolved > 0 ? '#f5a623' : '#888';
  counter.innerHTML = `
    <span style="color:#555;">💬 合計: <strong>${total}</strong> 件</span>
    <span style="color:#ccc;">|</span>
    <span style="color:${unresolvedColor};">⚠️ 未解決: <strong>${unresolved}</strong> 件</span>
  `;
}

// カウンターを「取得中」表示にリセットする
function resetBadge() {
  const counter = document.getElementById(COUNTER_ID);
  if (counter) counter.innerHTML = `
    <span style="color:#aaa;">💬 合計: -- 件</span>
    <span style="color:#ccc;">|</span>
    <span style="color:#aaa;">⚠️ 未解決: -- 件</span>
  `;
}
```

- [ ] **Step 2: content.js 末尾に一時テストコードを追記して動作確認する**

```js
// 一時テスト（確認後削除）
(async () => {
  renderBadge(0, 0); // まず -- 表示
  // tabListが存在する場合のみ動作するため、ページがSPAで遅れる場合がある
  // → waitForTabListで解決（Task 5）
})();
```

1. 拡張機能を再読み込み
2. `https://replay.dropbox.com/` の動画ページを開く
3. タブリスト（未解決/解決済み/すべて）の上に `💬 合計: 0 件 | ⚠️ 未解決: 0 件` が表示されることを確認

一時テストコードを削除する。

---

### Task 5: waitForTabList 関数の実装

**Files:**
- Modify: `content.js`

- [ ] **Step 1: waitForTabList 関数を追加する**

```js
// タブリストが描画されるまで最大10秒ポーリングする
// 戻り値: Promise<Element | null>
function waitForTabList(timeoutMs = 10000) {
  return new Promise((resolve) => {
    const found = document.querySelector('ul.dig-Tabs-group');
    if (found) { resolve(found); return; }

    const start = Date.now();
    const interval = setInterval(() => {
      const el = document.querySelector('ul.dig-Tabs-group');
      if (el) {
        clearInterval(interval);
        resolve(el);
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(interval);
        resolve(null); // タイムアウト
      }
    }, 300);
  });
}
```

---

### Task 6: MutationObserver・デバウンス・URL変化検知の実装

**Files:**
- Modify: `content.js`

- [ ] **Step 1: デバウンス関数を追加する**

```js
// fn を delay ms 後に実行する。連続呼び出しはリセット。
function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
```

- [ ] **Step 2: observe 関数（MutationObserver起動）を追加する**

```js
let currentUrl = location.href;

// MutationObserverを起動してコメント変化・URL変化を監視する
function observe(onUpdate) {
  const debouncedUpdate = debounce(onUpdate, 800);

  const mo = new MutationObserver((mutations) => {
    // URL変化を検知（SPA遷移）
    if (location.href !== currentUrl) {
      currentUrl = location.href;
      onUpdate(); // 即時実行（デバウンスなし）
      return;
    }

    // comment-thread-container の増減 or aria-selected の変化を検知
    const relevant = mutations.some((m) => {
      if (m.type === 'childList') {
        return [...m.addedNodes, ...m.removedNodes].some(
          (n) => n.nodeType === 1 &&
            (n.dataset?.testid === 'comment-thread-container' ||
             n.querySelector?.('[data-testid="comment-thread-container"]'))
        );
      }
      if (m.type === 'attributes' && m.attributeName === 'aria-selected') {
        return true;
      }
      return false;
    });

    if (relevant) debouncedUpdate();
  });

  mo.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['aria-selected'],
  });
}
```

---

### Task 7: 初期化（init）関数で全体を接続する

**Files:**
- Modify: `content.js`

- [ ] **Step 1: init 関数を追加してすべてを接続する**

```js
async function init() {
  // SPA初期描画を待つ
  const tabList = await waitForTabList();
  if (!tabList) return; // Replayページでない場合は何もしない

  // 「すべて」タブがなければReplayの動画ページではない
  if (!document.querySelector('[data-testid="all-comments-section"]')) return;

  // 初回表示（取得中）
  resetBadge();

  // 更新処理をひとつの関数にまとめる
  const update = async () => {
    // URL変化の場合、タブリストが再描画されるまで待つ
    const tl = await waitForTabList();
    if (!tl) return;
    if (!document.querySelector('[data-testid="all-comments-section"]')) return;

    resetBadge();
    const { total, unresolved } = await fetchCounts();
    renderBadge(total, unresolved);
  };

  await update();
  observe(update);
}
```

- [ ] **Step 2: エントリーポイントを追加する**

```js
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setTimeout(init, 1500));
} else {
  setTimeout(init, 1500);
}
```

---

### Task 8: content.js の最終形を確認してコミット

**Files:**
- Modify: `content.js`

- [ ] **Step 1: content.js の全体を確認する**

`content.js` が以下の順序で関数を含んでいることを確認：

1. `readIsResolved(el)`
2. `fetchCounts()`
3. `COUNTER_ID` 定数
4. `renderBadge(total, unresolved)`
5. `resetBadge()`
6. `waitForTabList(timeoutMs)`
7. `debounce(fn, delay)`
8. `observe(onUpdate)`（`currentUrl` 変数を含む）
9. `init()`
10. エントリーポイント（`DOMContentLoaded` / `setTimeout`）

- [ ] **Step 2: 手動動作テストを行う**

1. `chrome://extensions/` で拡張機能を再読み込み
2. `https://replay.dropbox.com/` の動画ページを開く
3. 以下をすべて確認する：

| 確認項目 | 期待結果 |
|---|---|
| タブリスト（未解決/解決済み/すべて）の直前にカウンターが表示される | ✓ |
| `💬 合計: N件 \| ⚠️ 未解決: N件` が正しい数値を示している | ✓ |
| 未解決が1件以上のとき未解決数がオレンジ表示される | ✓ |
| 「すべて」タブをクリックしたとき元タブに自動で戻る（素早くて気づかないレベル） | ✓ |
| 既存のコメントを解決すると数値が更新される | ✓ |

- [ ] **Step 3: コミット**

```bash
cd "/Users/myhome/Replay Counter "
git add content.js
git commit -m "feat: rewrite content.js with React fiber-based comment counter"
```

---

## セルフレビュー結果

**Spec coverage:**
- ✅ Reactファイバー読み取り → Task 2
- ✅ fetchCounts（タブ切り替え + 復帰） → Task 3
- ✅ UI挿入（タブリスト直前） → Task 4
- ✅ waitForTabList → Task 5
- ✅ MutationObserver + デバウンス → Task 6
- ✅ URL変化検知（SPA遷移） → Task 6
- ✅ エッジケース（すべてタブなし、ファイバー読めない、復帰失敗） → Task 3・7
- ✅ manifest更新 + background.js削除 → Task 1
- ✅ スタイル（オレンジ/グレー/取得中）→ Task 4

**Placeholder scan:** TBD・TODO・「適切に」等の表現なし ✓

**Type consistency:** `fetchCounts` は `{ total, unresolved }` を返し、`renderBadge(total, unresolved)` で受け取る。`readIsResolved` は `boolean | null` を返し、`fetchCounts` 内で `null` チェックしている。一貫している ✓
