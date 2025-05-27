// 未解決コメント数を抽出する関数
function extractUnresolvedCount() {
  // 未解決タブ内のコメントを探す
  const unresolvedComments = document.querySelectorAll(".sc-jsvCbA");
  let unresolvedCount = 0;

  console.log("検出されたコメント要素:", unresolvedComments.length);

  unresolvedComments.forEach((comment) => {
    // 解決済みボタンが存在するか確認
    const resolveButton = comment.querySelector(
      'button[aria-label="コメント スレッドを解決済みにする"]'
    );
    if (resolveButton) {
      unresolvedCount++;
    }
  });

  console.log("未解決コメント数:", unresolvedCount);
  return unresolvedCount;
}

// バッジを表示する関数
function showBadge(count) {
  const existing = document.getElementById("replay-unresolved-badge");
  if (existing) existing.remove();

  const badge = document.createElement("div");
  badge.id = "replay-unresolved-badge";
  badge.style.position = "fixed";
  badge.style.top = "10px";
  badge.style.right = "10px";
  badge.style.background = "red";
  badge.style.color = "white";
  badge.style.padding = "5px 10px";
  badge.style.zIndex = "9999";
  badge.style.borderRadius = "10px";
  badge.style.fontFamily = "Arial, sans-serif";
  badge.style.fontSize = "14px";
  badge.style.fontWeight = "bold";
  badge.style.boxShadow = "0 2px 4px rgba(0,0,0,0.2)";
  badge.textContent = `未解決: ${count}`;

  document.body.appendChild(badge);
}

// メイン処理
function main() {
  const count = extractUnresolvedCount();
  showBadge(count);
}

// ページの読み込み完了を待ってから処理を開始
function initialize() {
  // 初回実行（少し遅延を入れてDOMの構築を待つ）
  setTimeout(main, 1000);

  // DOMの変更を監視
  const observer = new MutationObserver((mutations) => {
    // コメント関連の変更があった場合のみ再カウント
    const shouldRecount = mutations.some((mutation) => {
      const target = mutation.target;
      return (
        target.closest(".sc-jsvCbA") || // コメント要素
        target.closest('button[aria-label="コメント スレッドを解決済みにする"]')
      ); // 解決ボタン
    });

    if (shouldRecount) {
      // パフォーマンスのために少し遅延させる
      setTimeout(main, 100);
    }
  });

  // 監視の開始
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    characterData: true,
  });
}

// ページの読み込み完了を待つ
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initialize);
} else {
  initialize();
}
