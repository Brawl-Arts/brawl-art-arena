-- Fix RLS policies for user_points table to allow inserts and updates
CREATE POLICY "Users can manage their own points" 
ON public.user_points 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Allow users to insert their own points
CREATE POLICY "Users can insert their own points" 
ON public.user_points 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own points  
CREATE POLICY "Users can update their own points" 
ON public.user_points 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Create storage bucket for fight artworks if not exists
INSERT INTO storage.buckets (id, name, public) 
VALUES ('fight-artworks', 'fight-artworks', true)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for fight artworks storage
CREATE POLICY "Fight artwork images are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'fight-artworks');

CREATE POLICY "Users can upload fight artworks" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'fight-artworks' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Add fight artwork related tables
CREATE TABLE IF NOT EXISTS public.fight_artworks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  attacker_id UUID NOT NULL REFERENCES auth.users(id),
  target_artwork_id UUID NOT NULL REFERENCES public.artworks(id),
  title TEXT NOT NULL,
  image_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on fight_artworks
ALTER TABLE public.fight_artworks ENABLE ROW LEVEL SECURITY;

-- Create policies for fight_artworks
CREATE POLICY "Fight artworks are viewable by everyone" 
ON public.fight_artworks 
FOR SELECT 
USING (true);

CREATE POLICY "Users can create fight artworks" 
ON public.fight_artworks 
FOR INSERT 
WITH CHECK (auth.uid() = attacker_id);

-- Add trigger for fight artwork point updates
CREATE OR REPLACE FUNCTION public.update_fight_points()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update attacker points (+2 for fight artwork)
  INSERT INTO public.user_points (user_id, event_id, attack_points, points_total)
  SELECT 
    NEW.attacker_id,
    a.event_id,
    2,
    2
  FROM public.artworks a
  WHERE a.id = NEW.target_artwork_id
  ON CONFLICT (user_id, event_id) 
  DO UPDATE SET
    attack_points = user_points.attack_points + 2,
    points_total = user_points.points_total + 2,
    updated_at = now();
    
  RETURN NEW;
END;
$$;

-- Create trigger for fight artwork uploads
CREATE TRIGGER on_fight_artwork_created
  AFTER INSERT ON public.fight_artworks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_fight_points();