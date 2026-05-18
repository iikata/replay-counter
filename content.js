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

// Temporarily switches to "すべて" tab, reads all thread resolved states via React fiber,
// then restores the original active tab.
// Returns Promise<{ total: number, unresolved: number }>
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
      activeTab?.click();
      resolve({ total: 0, unresolved: 0 });
      return;
    }

    setTimeout(() => {
      let total = 0;
      let unresolved = 0;
      try {
        const containers = document.querySelectorAll('[data-testid="comment-thread-container"]');
        containers.forEach((el) => {
          const isResolved = readIsResolved(el);
          if (isResolved === null) return;
          total++;
          if (!isResolved) unresolved++;
        });
      } finally {
        activeTab?.click();
        resolve({ total, unresolved });
      }
    }, 200);
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

// Sets counter to loading state ("--").
function resetBadge() {
  const counter = document.getElementById(COUNTER_ID);
  if (counter) counter.innerHTML = `
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

// Starts a MutationObserver that calls onUpdate when comments change or URL changes.
function observe(onUpdate) {
  const debouncedUpdate = debounce(onUpdate, 800);

  const mo = new MutationObserver((mutations) => {
    if (location.href !== currentUrl) {
      currentUrl = location.href;
      onUpdate();
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

// Initializes the extension: waits for the tab list, fetches counts, renders badge, starts observer.
async function init() {
  const tabList = await waitForTabList();
  if (!tabList) return;
  if (!document.querySelector('[data-testid="all-comments-section"]')) return;

  resetBadge();

  const update = async () => {
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

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setTimeout(init, 1500));
} else {
  setTimeout(init, 1500);
}
