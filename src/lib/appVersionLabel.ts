// Rótulo único da versão do Painel, derivado do __APP_VERSION__ gerado no build
// (package.json / public/version.json + vite-plugin-auto-version).
// Usado no menu do perfil (Header) e no badge do JulIA Chat.

declare const __APP_VERSION__: string;

export const APP_VERSION_LABEL = (() => {
  const raw = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '';
  return raw ? `v${raw}` : 'dev';
})();
