import { useUaZapiContext, type UaZapiContextType } from '@/contexts/UaZapiContext';

/**
 * Hook to access UaZapi API endpoints
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { instance, message, isConfigured } = useUaZapi();
 * 
 *   const handleSendMessage = async () => {
 *     if (!isConfigured) {
 *       toast.error('API não configurada');
 *       return;
 *     }
 * 
 *     await message.sendText({
 *       number: '5511999999999',
 *       text: 'Olá!'
 *     });
 *   };
 * 
 *   const checkStatus = async () => {
 *     const { status } = await instance.getStatus();
 *     console.log('Status:', status);
 *   };
 * }
 * ```
 */
export function useUaZapi(): UaZapiContextType {
  return useUaZapiContext();
}

export default useUaZapi;
