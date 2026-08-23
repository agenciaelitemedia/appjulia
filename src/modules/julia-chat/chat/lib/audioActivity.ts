// Sinaliza globalmente quando o usuário está gravando ou enviando áudio no chat.
// Usado pelo alerta sonoro de novas mensagens para se silenciar nesse intervalo.

let activeCount = 0;

export function setAudioActivity(active: boolean): void {
  if (active) {
    activeCount += 1;
  } else {
    activeCount = Math.max(0, activeCount - 1);
  }
}

export function isAudioActive(): boolean {
  return activeCount > 0;
}