-- Add started_at and cancelled_at columns to tasks table
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE;