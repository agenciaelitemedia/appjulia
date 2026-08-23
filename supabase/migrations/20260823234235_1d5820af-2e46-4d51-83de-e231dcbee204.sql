ALTER TABLE public.mvp_chat_legacy_cache RENAME TO chat_legacy_cache;
ALTER FUNCTION public.mvp_chat_legacy_cache_touch() RENAME TO chat_legacy_cache_touch;
ALTER TRIGGER trg_mvp_chat_legacy_cache_touch ON public.chat_legacy_cache RENAME TO trg_chat_legacy_cache_touch;
ALTER FUNCTION public.mvp_chat_list_feed(text, uuid[], text, text, text, boolean, text, timestamp with time zone, timestamp with time zone, uuid[], text, boolean, boolean, text, integer, integer, text[], text[], boolean, text[]) RENAME TO chat_list_feed;