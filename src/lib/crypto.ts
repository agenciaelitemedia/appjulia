/**
 * Gera uma senha segura usando crypto.getRandomValues() (CSPRNG).
 * Formato: Julia@XXXX onde X pode ser letra maiúscula, minúscula ou dígito.
 */
export function generateSecurePassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const array = new Uint8Array(4);
  crypto.getRandomValues(array);
  const suffix = Array.from(array)
    .map((byte) => chars[byte % chars.length])
    .join('');
  return `Julia@${suffix}`;
}
