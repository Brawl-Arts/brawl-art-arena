-- Create function to update user points
CREATE OR REPLACE FUNCTION public.update_user_points(
  p_user_id uuid,
  p_event_id uuid,
  p_artwork_points integer DEFAULT 0,
  p_like_points integer DEFAULT 0,
  p_attack_points integer DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert or update user points for the event
  INSERT INTO public.user_points (user_id, event_id, artwork_points, like_points, attack_points, points_total)
  VALUES (
    p_user_id, 
    p_event_id, 
    p_artwork_points, 
    p_like_points, 
    p_attack_points,
    p_artwork_points + p_like_points + p_attack_points
  )
  ON CONFLICT (user_id, event_id) 
  DO UPDATE SET
    artwork_points = user_points.artwork_points + p_artwork_points,
    like_points = user_points.like_points + p_like_points,
    attack_points = user_points.attack_points + p_attack_points,
    points_total = user_points.artwork_points + user_points.like_points + user_points.attack_points + p_artwork_points + p_like_points + p_attack_points,
    updated_at = now();
END;
$$;

-- Add unique constraint to user_points if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'user_points_user_id_event_id_key'
  ) THEN
    ALTER TABLE public.user_points 
    ADD CONSTRAINT user_points_user_id_event_id_key 
    UNIQUE (user_id, event_id);
  END IF;
END $$;

-- Create triggers to update artwork counts when interactions are added
CREATE OR REPLACE FUNCTION public.update_artwork_counts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.interaction_type = 'like' THEN
      UPDATE public.artworks 
      SET likes_count = likes_count + 1 
      WHERE id = NEW.artwork_id;
    ELSIF NEW.interaction_type = 'attack' THEN
      UPDATE public.artworks 
      SET attacks_count = attacks_count + 1 
      WHERE id = NEW.artwork_id;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

-- Create trigger for artwork interactions
DROP TRIGGER IF EXISTS trigger_update_artwork_counts ON public.artwork_interactions;
CREATE TRIGGER trigger_update_artwork_counts
  AFTER INSERT ON public.artwork_interactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_artwork_counts();

-- Update event status based on time
CREATE OR REPLACE FUNCTION public.update_event_status()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update events to ongoing if start time has passed
  UPDATE public.events 
  SET status = 'ongoing'
  WHERE status = 'upcoming' 
    AND start_time <= now();
  
  -- Update events to ended if end time has passed
  UPDATE public.events 
  SET status = 'ended'
  WHERE status = 'ongoing' 
    AND end_time <= now();
END;
$$;