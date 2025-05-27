// 拡張機能のアイコンがクリックされたときの処理
chrome.action.onClicked.addListener((tab) => {
  if (tab.url.includes("dropbox.com/replay")) {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: () => {
        const count = document.querySelectorAll(
          '[data-testid="unresolved-badge"]'
        ).length;
        alert(`現在の未解決コメント数: ${count}`);
      },
    });
  }
});
