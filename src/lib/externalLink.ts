/**
 * Utility for handling external links through a redirect page
 * to avoid browser/firewall blocking
 */

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
 * Opens an external link using the redirect page
 * @param url - The external URL to open
 */
export function openExternalLink(url: string): void {
  if (!url) return;
  window.open(getExternalLink(url), '_blank', 'noopener,noreferrer');
}
