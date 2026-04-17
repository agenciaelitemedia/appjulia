
User clarifies: remove the 3-day window filter entirely. Do NOT load any historical messages by default. Only when a NEW conversation arrives AND has no message history locally, attempt to fetch history from UaZapi API as fallback.

So:
1. Remove 3-day filter from WhatsAppDataContext (load all that exists in DB, which now starts empty after reset)
2. Remove 3-day filter from webhook ingestion (accept all incoming new messages)
3. Add new logic: when a new contact/conversation appears via webhook with zero local messages, trigger a one-time backfill from UaZapi API for that specific chat
4. Keep webhook events default config (that part is good)

Need to check if there's an existing function to fetch chat history from UaZapi.
