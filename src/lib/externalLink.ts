/**
 * Utility for handling external links through a redirect page
 * to avoid browser/firewall blocking
 */

/**
 * Detects if the app is running inside an iframe
 */
export function isInIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true; // Cross-origin iframe
  }
}

/**
 * Generates a redirect URL for external links
 * @param url - The external URL to redirect to
 * @returns A local redirect URL that will safely redirect to the external URL
 */
export function getExternalLink(url: string): string {
  if (!url) return '#';
  return `/redirect?url=${encodeURIComponent(url)}`;
}

/**
 * Opens an external link, escaping iframe context if needed
 * @param url - The external URL to open
 */
export function openExternalLink(url: string): void {
  if (!url) return;
  
  try {
    // Try to open via window.top to escape iframe
    const targetWindow = window.top || window;
    targetWindow.open(url, '_blank', 'noopener,noreferrer');
  } catch {
    // Fallback: use redirect page
    window.open(getExternalLink(url), '_blank', 'noopener,noreferrer');
  }
}
