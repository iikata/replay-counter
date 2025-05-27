// 未解決コメント数を抽出する関数
function extractUnresolvedCount() {
  const elements = document.querySelectorAll('[data-testid="comment-icon"]');
  let unresolvedCount = 0;

  elements.forEach((el) => {
    const badge = el.querySelector('[data-testid="unresolved-badge"]');
    if (badge) unresolvedCount++;
  });

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
  console.log(`未解決コメント数: ${count}`);
  showBadge(count);
}

// ページ読み込み完了時に実行
document.addEventListener("DOMContentLoaded", main);

// DOMの変更を監視して再カウント
// const observer = new MutationObserver(() => {
//   main();
// });

// observer.observe(document.body, {
//   childList: true,
//   subtree: true
// });
