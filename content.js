// Reads thread.isResolved from the React fiber of a comment-thread-container element.
// Returns true (resolved), false (unresolved), or null (fiber unreadable — skip this element).
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

const TAB_SWITCH_DELAY_MS = 200;

// True while fetchCounts is switching tabs — suppresses observer re-entrancy.
let isFetching = false;

// Reads counts from the DOM when already on "すべて" tab.
function readCountsFromDOM() {
  const containers = document.querySelectorAll('[data-testid="comment-thread-container"]');
  let total = 0;
  let unresolved = 0;
  containers.forEach((el) => {
    const isResolved = readIsResolved(el);
    if (isResolved === null) return;
    total++;
    if (!isResolved) unresolved++;
  });
  return { total, unresolved };
}

// Reads counts from whichever tab is currently visible — no tab switching.
// Uses cachedTotal for the total count (obtained from the initial full fetch).
function readCountsFromCurrentTab(cachedTotal) {
  const activeTestId = document.querySelector('[role="tab"][aria-selected="true"]')
    ?.getAttribute('data-testid');
  const containers = document.querySelectorAll('[data-testid="comment-thread-container"]');
  const visibleCount = containers.length;

  if (activeTestId === 'all-comments-section') {
    let total = 0, unresolved = 0;
    containers.forEach((el) => {
      const isResolved = readIsResolved(el);
      if (isResolved === null) return;
      total++;
      if (!isResolved) unresolved++;
    });
    return { total, unresolved };
  }

  if (activeTestId === 'unresolved-comments-section') {
    return { total: Math.max(cachedTotal, visibleCount), unresolved: visibleCount };
  }

  if (activeTestId === 'resolved-comments-section') {
    return { total: cachedTotal, unresolved: Math.max(0, cachedTotal - visibleCount) };
  }

  return { total: cachedTotal, unresolved: 0 };
}

// Switches to "すべて" tab once to get accurate total + unresolved, then restores.
// Called only on initial load and SPA navigation. Returns Promise<{ total, unresolved }>.
function fetchCounts() {
  return new Promise((resolve) => {
    const allTab = document.querySelector('[data-testid="all-comments-section"]');
    if (!allTab) {
      resolve({ total: 0, unresolved: 0 });
      return;
    }

    const activeTab = document.querySelector('[role="tab"][aria-selected="true"]');

    // Already on "すべて" tab — read directly without switching.
    if (activeTab?.getAttribute('data-testid') === 'all-comments-section') {
      resolve(readCountsFromDOM());
      return;
    }

    isFetching = true;
    try {
      allTab.click();
    } catch (_) {
      isFetching = false;
      activeTab?.click();
      resolve({ total: 0, unresolved: 0 });
      return;
    }

    setTimeout(() => {
      let counts = { total: 0, unresolved: 0 };
      try {
        counts = readCountsFromDOM();
      } finally {
        activeTab?.click();
        resolve(counts);
        // Reset after a tick so the tab-restore mutation is ignored by the observer.
        setTimeout(() => { isFetching = false; }, 0);
      }
    }, TAB_SWITCH_DELAY_MS);
  });
}

const COUNTER_ID = 'rpc-counter';

// Inserts or updates the counter DOM element just before the tab list.
function renderBadge(total, unresolved) {
  const tabList = document.querySelector('ul.dig-Tabs-group');
  if (!tabList) return;

  let counter = document.getElementById(COUNTER_ID);

  if (!counter) {
    counter = document.createElement('div');
    counter.id = COUNTER_ID;
    counter.style.cssText = [
      'display:flex',
      'gap:8px',
      'padding:6px 12px 4px',
      'font-size:12px',
      'font-family:inherit',
      'align-items:center',
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

// Sets counter to loading state ("--"). Creates the element if it doesn't exist yet.
function resetBadge() {
  const tabList = document.querySelector('ul.dig-Tabs-group');
  if (!tabList) return;

  let counter = document.getElementById(COUNTER_ID);
  if (!counter) {
    counter = document.createElement('div');
    counter.id = COUNTER_ID;
    counter.style.cssText = [
      'display:flex',
      'gap:8px',
      'padding:6px 12px 4px',
      'font-size:12px',
      'font-family:inherit',
      'align-items:center',
    ].join(';');
    tabList.parentElement.insertBefore(counter, tabList);
  }

  counter.innerHTML = `
    <span style="color:#aaa;">💬 合計: -- 件</span>
    <span style="color:#ccc;">|</span>
    <span style="color:#aaa;">⚠️ 未解決: -- 件</span>
  `;
}

// Polls until ul.dig-Tabs-group appears in the DOM (SPA rendering delay).
// Resolves with the element, or null on timeout.
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
        resolve(null);
      }
    }, 300);
  });
}

// Returns a debounced version of fn that fires after delay ms of silence.
function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

let currentUrl = location.href;

// Starts a MutationObserver.
// onUrlChange: called immediately on SPA navigation (triggers a full re-fetch).
// onCommentChange: debounced, called when comment threads appear or disappear.
function observe(onUrlChange, onCommentChange) {
  const debouncedCommentChange = debounce(onCommentChange, 800);

  const mo = new MutationObserver((mutations) => {
    if (isFetching) return;

    if (location.href !== currentUrl) {
      currentUrl = location.href;
      onUrlChange();
      return;
    }

    const relevant = mutations.some((m) => {
      if (m.type === 'childList') {
        return [...m.addedNodes, ...m.removedNodes].some(
          (n) => n.nodeType === 1 &&
            (n.dataset?.testid === 'comment-thread-container' ||
             n.querySelector?.('[data-testid="comment-thread-container"]'))
        );
      }
      return false;
    });

    if (relevant) debouncedCommentChange();
  });

  mo.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

// Initializes the extension.
async function init() {
  const tabList = await waitForTabList();
  if (!tabList) return;
  if (!document.querySelector('[data-testid="all-comments-section"]')) return;

  resetBadge();

  // Initial fetch: switch to "すべて" tab once for accurate total + unresolved.
  const { total, unresolved } = await fetchCounts();
  renderBadge(total, unresolved);
  let cachedTotal = total;

  // On SPA navigation: full re-fetch to update cachedTotal.
  const onUrlChange = async () => {
    const tl = await waitForTabList();
    if (!tl) return;
    if (!document.querySelector('[data-testid="all-comments-section"]')) return;
    resetBadge();
    const { total: t, unresolved: u } = await fetchCounts();
    cachedTotal = t;
    renderBadge(t, u);
  };

  // On comment change: read from current tab — no tab switching.
  const onCommentChange = () => {
    if (!document.querySelector('[data-testid="all-comments-section"]')) return;
    const { total: t, unresolved: u } = readCountsFromCurrentTab(cachedTotal);
    cachedTotal = t;
    renderBadge(t, u);
  };

  observe(onUrlChange, onCommentChange);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setTimeout(init, 1500));
} else {
  setTimeout(init, 1500);
}
