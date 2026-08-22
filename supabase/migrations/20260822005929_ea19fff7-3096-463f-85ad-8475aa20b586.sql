REVOKE ALL ON FUNCTION public.xj_pick_due_followups(smallint, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.xj_release_stale_followups(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.xj_pick_due_followups(smallint, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.xj_release_stale_followups(integer) TO service_role;