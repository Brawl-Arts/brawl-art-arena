-- Add RLS policies for events table to allow admin operations
CREATE POLICY "Authenticated users can create events" 
ON public.events 
FOR INSERT 
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update events" 
ON public.events 
FOR UPDATE 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete events" 
ON public.events 
FOR DELETE 
TO authenticated
USING (true);