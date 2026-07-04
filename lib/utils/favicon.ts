/**
 * Build a Google favicon URL for any http(s) URL.
 * Returns an empty string when the URL cannot be parsed.
 */
export function getFaviconUrl(url: string, size = 128): string {
  try {
    const hostname = new URL(url).hostname
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=${size}`
  } catch {
    return ''
  }
}
