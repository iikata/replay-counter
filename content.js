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
