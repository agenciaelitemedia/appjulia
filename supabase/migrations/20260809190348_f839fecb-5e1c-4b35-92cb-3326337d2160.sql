ALTER TABLE public.xj_legal_cases
  ADD COLUMN IF NOT EXISTS contract_fields jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE public.xj_legal_cases
SET contract_fields = '[
  {"key":"nome_completo","label":"Nome Completo","validation":"texto"},
  {"key":"seu_cpf","label":"Seu CPF","validation":"cpf"},
  {"key":"sua_identidade","label":"Número da sua Identidade (RG)","validation":"texto"},
  {"key":"seu_endereco","label":"Seu endereço completo (Rua/Avenida e Número)","validation":"texto"},
  {"key":"seu_bairro","label":"Seu Bairro","validation":"texto"},
  {"key":"sua_cidade","label":"Sua Cidade","validation":"texto"},
  {"key":"seu_estado","label":"Seu Estado (UF)","validation":"uf"},
  {"key":"seu_cep","label":"Seu CEP","validation":"cep"},
  {"key":"nome_filho","label":"Nome do Filho","validation":"texto"},
  {"key":"cpf_filho","label":"CPF do Filho","validation":"cpf"},
  {"key":"nascimento_filho","label":"Data de Nascimento do Filho","validation":"data"}
]'::jsonb
WHERE id = '1391a571-8c64-4914-9080-5e44fdcd40ae';