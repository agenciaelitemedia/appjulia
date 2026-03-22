

# Formatação automática de números para Api4Com

## Regras de telefonia brasileira para Api4Com

A Api4Com espera números no formato: `0 + DDD + número` (ex: `034999999999`).

### Regras de detecção celular vs fixo
- **Celular**: DDD + 9 dígitos (começa com 9). Ex: `34 9 9999-9999`
- **Fixo**: DDD + 8 dígitos (começa com 2-5). Ex: `34 3333-9999`
- **Nono dígito**: Se o número tem DDD + 8 dígitos e o primeiro dígito do número local é 6, 7, 8 ou 9, é celular sem o nono dígito → adicionar `9` automaticamente

### Lógica de formatação
```text
Entrada do usuário     → Limpa dígitos → Detecta → Formata para Api4Com
(34) 99999-9999        → 34999999999   → celular  → 034999999999
(34) 9999-9999         → 3499999999    → cel s/9°  → 034999999999 (adiciona 9)
(34) 3333-9999         → 3433339999    → fixo      → 03433339999
+55 34 99999-9999      → 5534999999999 → remove 55 → 034999999999
34999999999             → já ok         → celular   → 034999999999
```

## Alterações

### 1. `src/lib/phoneFormat.ts` — novo arquivo
Função `formatPhoneForDialing(raw: string): { formatted: string; type: 'mobile' | 'landline' | 'unknown'; ninthAdded: boolean }`:
- Remove `+55`, parênteses, traços, espaços
- Se começa com `0`, mantém
- Se tem 10 dígitos (DDD + 8): verifica se primeiro dígito local é 6-9 → adiciona nono dígito `9`
- Se tem 11 dígitos (DDD + 9): celular OK
- Adiciona `0` na frente se não tem
- Retorna número formatado + metadados (tipo, se adicionou 9°)

### 2. `DiscadorTab.tsx` — formatar antes de discar
- No `handleDial`, aplicar `formatPhoneForDialing(number)` antes de enviar
- Mostrar indicador visual abaixo do input: "Celular: 034999999999 (9° dígito adicionado)" ou "Fixo: 03433339999"

### 3. `PhoneCallDialog.tsx` — formatar `whatsappNumber`
- Antes de discar (SIP ou REST), aplicar `formatPhoneForDialing(whatsappNumber)`
- Exibir número formatado no display

### 4. `DiscadorPad.tsx` — máscara visual no input
- Aplicar `maskPhone` do `inputMasks.ts` no display enquanto digita
- Enviar número limpo para o pai

## Arquivos
- Criar: `src/lib/phoneFormat.ts`
- Editar: `DiscadorTab.tsx`, `PhoneCallDialog.tsx`, `DiscadorPad.tsx`

