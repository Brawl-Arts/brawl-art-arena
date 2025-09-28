-- Fix foreign key constraint for artworks table
-- Remove the existing foreign key if it exists and recreate it to reference profiles
ALTER TABLE public.artworks DROP CONSTRAINT IF EXISTS artworks_user_id_fkey;

-- Add foreign key constraint to reference profiles table instead of auth.users
ALTER TABLE public.artworks ADD CONSTRAINT artworks_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;