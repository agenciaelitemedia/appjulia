REVOKE ALL ON FUNCTION public.dsp_pick_queue_items(text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.dsp_release_stale_locks() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dsp_pick_queue_items(text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.dsp_release_stale_locks() TO service_role;