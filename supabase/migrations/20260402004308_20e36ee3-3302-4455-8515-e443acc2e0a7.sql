UPDATE phone_config 
SET sip_domain = NULL, threecplus_ws_url = NULL 
WHERE cod_agent = '202601003' AND provider = '3cplus' AND is_active = true;

UPDATE phone_extensions 
SET threecplus_sip_domain = NULL 
WHERE cod_agent = '202601003' AND provider = '3cplus' AND is_active = true;