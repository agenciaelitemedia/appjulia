
-- Reset completo das tabelas operacionais de /chat (preserva configurações)
TRUNCATE TABLE
  public.chat_messages,
  public.chat_message_reactions,
  public.chat_mentions,
  public.chat_conversation_history,
  public.chat_conversation_participants,
  public.chat_conversation_presence,
  public.chat_conversation_tags,
  public.chat_conversations,
  public.chat_contacts,
  public.chat_crm_links,
  public.chat_scheduled_messages,
  public.chat_csat_responses,
  public.chat_bot_flow_runs,
  public.chat_ai_autoreply_logs,
  public.chat_ai_classifications,
  public.chat_automation_logs,
  public.chat_campaign_recipients,
  public.chat_campaign_variants,
  public.chat_campaign_schedules,
  public.chat_campaigns,
  public.chat_call_logs,
  public.chat_audit_log,
  public.chat_lgpd_requests,
  public.chat_analytics_daily,
  public.chat_webhook_deliveries
RESTART IDENTITY CASCADE;
