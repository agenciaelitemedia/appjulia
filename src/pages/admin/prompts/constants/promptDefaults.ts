export const DEFAULT_AI_NAME = 'Julia';

export const DEFAULT_PRACTICE_AREAS = `  * Direito Previdenciário
  * Direito Trabalhista
  * Direito Bancário
  * Direito do Consumidor
  * Direito Familiar
  * Direito Cível
  * Direito Penal`;

export const DEFAULT_WORKING_HOURS = `  * Segunda a Sexta: 08h às 18h
  * Sábado, Domingo e Feriados: Fechado (atendimento automático)
  * Atendimento online 24h`;

export const DEFAULT_OFFICE_INFO = `  * Nome do Escritório:  Atende Julia (Advogados Associados) 
  * CNPJ: 01.742.571.0001-68 
  * Advogado(s):  Dra. Fulana Marque - OAB/DF: 120.139 
  * Nosso Instagram: @atendejulia`;

export const DEFAULT_WELCOME_MESSAGE = `Seja bem-vindo(a) ao escritório da Dra. Julia IA, sou a [NOME] 

Nossos Dados: \\n
CPF: 000.000.00-00
CNPJ: 00.00.00.0001-00 
OAB/SP: 00.000 
Nosso Instagram: @atendejulia

Somos 5 Estrelas no Google e REFERÊNCIA NACIONAL em benefícios  no INSS, e em especial em Salário-Maternidade!
Já ajudamos muitas pessoas a conseguirem o benefício, a próxima pode ser você. \\n\\nVamos iniciar o seu atendimento.`;

export const DEFAULT_ZAPSIGN_TOKEN = 'Bearer 1c34c87a-37d6-42c3-add9-b3ceaed8eb1d13d47d17-4386-407b-aee9-665af342b622';

export const DEFAULT_FEES_TEXT = `{nome_completo}, Pelo que você nos informou, você pode ter direito sim. Atuamos da seguinte forma.

Agora, vou te explicar como funciona a nossa contratação. É bem simples.
Não cobramos nada antecipado, você só paga se ganhar. Se não ganhar, não paga nada. 

O INSS paga um valor pelos atrasados e, quando ganhar, com o valor dos atrasados, você paga o escritório. 
O valor que o escritório cobra é de 30% do atrasados mais 6 benefícios. Nada mais.
E lembrando: *Se não ganhar, não paga nada..* Podemos prosseguir com a documentação para você assinar?`;

export interface ContractField {
  label: string;
  value: string;
  checked: boolean;
}

export const DEFAULT_CONTRACT_FIELDS: ContractField[] = [
  { label: 'Nome Completo', value: 'nome_completo', checked: true },
  { label: 'Seu CPF', value: 'seu_cpf', checked: true },
  { label: 'Número da sua Identidade (RG)', value: 'sua_identidade', checked: true },
  { label: 'Seu endereço completo (Rua/Avenida e Número)', value: 'seu_endereco', checked: true },
  { label: 'Seu Bairro', value: 'seu_bairro', checked: true },
  { label: 'Sua Cidade', value: 'sua_cidade', checked: true },
  { label: 'Seu Estado (UF)', value: 'seu_estado', checked: true },
  { label: 'Seu CEP', value: 'seu_cep', checked: true },
  { label: 'Sua Profissão', value: 'sua_profissao', checked: false },
  { label: 'Seu E-mail', value: 'seu_email', checked: false },
  { label: 'Nome do Filho', value: 'nome_filho', checked: false },
  { label: 'CPF do Filho', value: 'cpf_filho', checked: false },
  { label: 'Data de Nascimento do Filho', value: 'nascimento_filho', checked: false },
];

export function processNegotiationText(
  closingModelText: string,
  zapsignToken: string,
  zapsignDocToken: string,
  contractFields: ContractField[],
  feesText: string
): string {
  const checkedFields = contractFields.filter(f => f.checked);
  const dadosColetar = checkedFields
    .map((f, i) => `  ${i + 1}. **${f.label}** → **${f.value}**`)
    .join('\n');

  let result = closingModelText;
  result = result.replace(/\[\[\[TOKEN_ZAPSING\]\]\]/g, zapsignToken);
  result = result.replace(/\[\[\[TOKEN_ZAPSING_DOC_UUID\]\]\]/g, zapsignDocToken);
  result = result.replace(/\[\[\[DADOS_COLETAR\]\]\]/g, dadosColetar);
  result = result.replace(/\[\[\[HONORARIOS_CASO\]\]\]/g, feesText);

  return result;
}
