/**
 * extend/queues — filas acessíveis ao usuário, reaproveitadas do sistema.
 * Mesma fonte usada pela lista do /chat (filas ativas + vínculo do usuário),
 * para que o JulIA Chat tenha exatamente o mesmo escopo de dados.
 */
export { useAccessibleQueues } from '@/pages/agente/filas/hooks/useQueues';
export { isOwnerUser } from '@/lib/auth/isOwner';
export { useQueueConnectionStatusesBatch } from '@/hooks/useQueueConnectionStatusesBatch';
export { useAgentQueueLimits } from '@/pages/agente/filas/hooks/useAgentQueueLimits';
