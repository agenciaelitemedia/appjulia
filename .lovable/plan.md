

# Corrigir criação de ramal — usar endpoints corretos da Api4Com

## Problema
O código atual chama `POST /extensions/next-available` que **não existe** na API da Api4Com. Os endpoints reais são:
- `POST /extensions` — cria um ramal com `ramal`, `senha`, `first_name`, `last_name`, `email_address`, `gravar_audio`
- `POST /users` — cria um usuário da organização com `name`, `email`, `password`, `phone`, `role`

## Solução

### `api4com-proxy/index.ts` — action `create_extension`

Fluxo correto em 2 passos:

1. **Criar usuário** via `POST /users`:
   ```json
   { "name": "Nome Sobrenome", "email": "email@...", "password": "...", "phone": "", "role": "USER" }
   ```

2. **Criar ramal** via `POST /extensions`:
   ```json
   { "ramal": "1001", "senha": "...", "first_name": "Nome", "last_name": "Sobrenome", "email_address": "email@...", "gravar_audio": 1 }
   ```
   - Se o usuário não informou número de ramal, listar ramais existentes via `GET /extensions` e calcular o próximo disponível
   - A resposta retorna `id`, `domain`, `ramal`, `senha`

3. Persistir tudo no banco (como já faz), adicionando também o `user_id` da Api4Com

Rollback: se falhar no passo 2 ou no banco, deletar o que foi criado.

### Aceitar `extensionNumber` opcional
- Se fornecido pelo frontend: usar esse número no campo `ramal` do `POST /extensions`
- Se não fornecido: buscar ramais existentes e calcular próximo (ex: max + 1)

## Arquivo alterado
- `supabase/functions/api4com-proxy/index.ts` — reescrever case `create_extension`

