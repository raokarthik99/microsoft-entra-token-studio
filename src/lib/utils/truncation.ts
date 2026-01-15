/**
 * Truncation detection utility for Svelte.
 * Provides a function to check if an element's content is truncated.
 */

/**
 * Checks if an element's text content is truncated (overflowing).
 * Works for both horizontal and vertical truncation.
 */
export function checkTruncation(element: HTMLElement): boolean {
  return element.scrollWidth > element.clientWidth || element.scrollHeight > element.clientHeight;
}

/**
 * Svelte action that monitors an element for truncation and calls
 * the callback whenever the truncation state changes.
 * 
 * Usage:
 * ```svelte
 * <span use:watchTruncation={(isTruncated) => truncated = isTruncated}>
 *   Long text that might be truncated...
 * </span>
 * ```
 */
export function watchTruncation(
  node: HTMLElement,
  callback: (isTruncated: boolean) => void
): { destroy: () => void } {
  let lastState: boolean | null = null;

  const check = () => {
    const isTruncated = checkTruncation(node);
    if (isTruncated !== lastState) {
      lastState = isTruncated;
      callback(isTruncated);
    }
  };

  // Initial check after a frame to ensure layout is complete
  requestAnimationFrame(check);

  // Monitor for size changes
  const resizeObserver = new ResizeObserver(() => {
    requestAnimationFrame(check);
  });
  resizeObserver.observe(node);

  // Also check on window resize (for viewport-relative sizing)
  window.addEventListener('resize', check);

  return {
    destroy() {
      resizeObserver.disconnect();
      window.removeEventListener('resize', check);
    }
  };
}
