ALTER TABLE crm_comercial_cards ADD COLUMN cod_agent text;
CREATE INDEX idx_crm_comercial_cards_cod_agent ON crm_comercial_cards(cod_agent);