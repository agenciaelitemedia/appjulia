
# Plano de Correcao: Exibir cod_agent e is_closer ao criar Novo Cliente

## Problema
Quando o usuario escolhe criar um novo cliente no wizard de criacao de agentes, os campos `cod_agent` (Codigo do Agente) e `is_closer` (E Closer?) **nao aparecem** apos o formulario de cadastro do cliente. Esses campos aparecem apenas quando um cliente existente e selecionado.

Alem disso, o codigo do agente nao esta sendo gerado automaticamente ao clicar em "Novo Cliente".

## Solucao
Adicionar os campos `cod_agent` e `is_closer` ao final do formulario de "Novo Cliente", apos os campos de endereco, e disparar a geracao automatica do codigo ao entrar no modo de novo cliente.

---

## Arquivo a Modificar

### `src/pages/agents/components/wizard-steps/ClientStep.tsx`

#### Mudanca 1: Gerar codigo automaticamente ao clicar em "Novo Cliente"

Na funcao `handleNewClient()` (linhas 86-91), adicionar a chamada para gerar o codigo:

```typescript
const handleNewClient = async () => {
  setValue('new_client', true);
  setValue('selected_client', null);
  setValue('client_id', null);
  setViewState('new');
  
  // Gerar codigo do agente automaticamente
  const generatedCode = await generateCode();
  if (!generatedCode) {
    toast.error('Erro ao gerar codigo do agente');
  }
};
```

#### Mudanca 2: Adicionar campos cod_agent e is_closer ao formulario de Novo Cliente

Apos o campo "Estado" (linha 573), antes de fechar o `</div>`, adicionar:

1. Um `<Separator />` para separar visualmente
2. Uma secao "Dados do Agente" com titulo
3. O campo `cod_agent` (readonly, igual ao do cliente selecionado)
4. O switch `is_closer` (igual ao do cliente selecionado)

```typescript
      </div>

      <Separator className="my-6" />

      {/* Dados do Agente */}
      <div>
        <h4 className="text-base font-medium text-foreground mb-4">Dados do Agente</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={control}
            name="cod_agent"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Codigo do Agente</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input 
                      {...field} 
                      readOnly 
                      className="bg-muted pr-10"
                    />
                    {isLoadingCode && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin" />
                    )}
                  </div>
                </FormControl>
                <FormDescription>
                  Gerado automaticamente
                </FormDescription>
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name="is_closer"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel className="text-base">E Closer?</FormLabel>
                  <FormDescription>
                    Define se o agente atua como closer
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </div>
      </div>
    </div>
  );
```

#### Mudanca 3: Limpar codigo ao cancelar novo cliente

Na funcao `handleCancelNewClient()` (linhas 93-109), adicionar a limpeza do codigo gerado:

```typescript
const handleCancelNewClient = () => {
  setValue('new_client', false);
  setValue('cod_agent', ''); // Limpar codigo
  clearCode(); // Limpar estado do hook
  // ... resto dos campos
  setViewState('search');
};
```

---

## Resultado Esperado

Apos a correcao:

```text
+----------------------------------------------------------+
| Novo Cliente                              [X Cancelar]    |
+----------------------------------------------------------+
|                                                           |
| Nome: [________________]  Escritorio: [________________]  |
| CPF/CNPJ: [___________]  Email: [_____________________]   |
| Telefone: [___________]  CEP: [________________________]  |
| Logradouro: [__________________________________________]  |
| Numero: [____]  Complemento: [________________________]   |
| Bairro: [_____________]  Cidade: [_____________________]  |
| Estado: [__]                                              |
|                                                           |
| --------------------------------------------------------- |
|                                                           |
| DADOS DO AGENTE                                           |
| Codigo: [202601008] (readonly)  [Switch] E Closer?        |
|                                                           |
+----------------------------------------------------------+
```

---

## Teste

| Cenario | Esperado |
|---------|----------|
| Clicar em "Novo Cliente" | Codigo gerado automaticamente, campos cod_agent e is_closer visiveis |
| Cancelar novo cliente | Codigo limpo, volta para busca |
| Selecionar cliente existente | Codigo gerado, campos cod_agent e is_closer visiveis (ja funcionava) |
| Salvar agente com novo cliente | cod_agent enviado corretamente para o backend |
