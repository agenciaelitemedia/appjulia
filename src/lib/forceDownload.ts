export async function forceDownload(url: string, fileName?: string | null): Promise<void> {
  if (!url) return;
  const inferredName = (() => {
    if (fileName) return fileName;
    try {
      const u = new URL(url, window.location.href);
      const last = u.pathname.split('/').filter(Boolean).pop();
      return last || 'download';
    } catch {
      return 'download';
    }
  })();

  try {
    const res = await fetch(url, { credentials: 'omit' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = inferredName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  } catch (err) {
    console.warn('[forceDownload] fallback to new tab:', err);
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.download = inferredName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
}