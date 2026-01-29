-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Service role has full access to video_call_records" ON public.video_call_records;

-- Create a more restrictive policy - only service role can access
-- Since we access this table only from edge functions with service role,
-- we can use a policy that denies all access for regular users
CREATE POLICY "Only service role can access video_call_records"
ON public.video_call_records
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);

-- Service role bypasses RLS automatically, so it can still access the table