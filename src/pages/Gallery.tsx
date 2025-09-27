import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Heart, Sword, User } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface Artwork {
  id: string;
  title: string;
  description: string | null;
  image_url: string;
  likes_count: number;
  attacks_count: number;
  created_at: string;
  user_id: string;
  event_id: string;
  profiles: {
    username: string;
    display_name: string;
  } | null;
  events: {
    title: string;
  } | null;
  event_participants: {
    team: 'A' | 'B';
  }[] | null;
}

interface Interaction {
  artwork_id: string;
  interaction_type: 'like' | 'attack';
}

export default function Gallery() {
  const { user } = useAuth();
  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchInteractions = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('artwork_interactions')
        .select('artwork_id, interaction_type')
        .eq('user_id', user.id);

      if (error) throw error;
      
      setInteractions((data || []) as Interaction[]);
    } catch (error) {
      console.error('Error fetching interactions:', error);
      toast({
        title: 'Error',
        description: 'Failed to load interactions',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    fetchArtworks();
    if (user) {
      fetchInteractions();
    }
  }, [user]);

  const fetchArtworks = async () => {
    try {
      setLoading(true);
      
      // First, fetch the artworks with user details only
      const { data: artworksData, error: artworksError } = await supabase
        .from('artworks')
        .select(`
          id,
          title,
          description,
          image_url,
          likes_count,
          attacks_count,
          created_at,
          user_id,
          event_id,
          profiles:user_id (username, display_name)
        `)
        .order('created_at', { ascending: false });

      if (artworksError) throw artworksError;

      // If no artworks found, set empty array and return
      if (!artworksData || artworksData.length === 0) {
        setArtworks([]);
        setLoading(false);
        return;
      }

      // Get unique event IDs to fetch event details
      const eventIds = [...new Set(artworksData.map(artwork => artwork.event_id))];
      
      // Fetch events in a single query
      const { data: eventsData, error: eventsError } = await supabase
        .from('events')
        .select('id, title')
        .in('id', eventIds);

      if (eventsError) throw eventsError;

      // Create a map of event_id to event data
      const eventsMap = new Map(eventsData?.map(event => [event.id, event]) || []);

      // Map artworks with their events
      const artworksWithEvents = artworksData.map(artwork => ({
        ...artwork,
        events: eventsMap.get(artwork.event_id) || null,
        // Initialize empty participants array, we'll handle this separately
        event_participants: []
      }));

      setArtworks(artworksWithEvents as unknown as Artwork[]);
    } catch (err) {
      const error = err as Error;
      console.error('Error in fetchArtworks:', error);
      toast({
        title: "Error fetching artworks",
        description: error.message || 'An unknown error occurred',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInteraction = async (artworkId: string, type: 'like' | 'attack') => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to interact with artworks",
        variant: "destructive",
      });
      return;
    }

    // Check if already interacted
    const existingInteraction = interactions.find(
      i => i.artwork_id === artworkId && i.interaction_type === type
    );

    if (existingInteraction) {
      toast({
        title: "Already interacted",
        description: `You've already ${type === 'like' ? 'liked' : 'attacked'} this artwork`,
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase
      .from('artwork_interactions')
      .insert({
        artwork_id: artworkId,
        user_id: user.id,
        interaction_type: type,
      });

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      // Update local state
      setInteractions(prev => [...prev, { artwork_id: artworkId, interaction_type: type }]);
      
      // Update artwork counts
      setArtworks(prev => prev.map(artwork => 
        artwork.id === artworkId 
          ? {
              ...artwork,
              [type === 'like' ? 'likes_count' : 'attacks_count']: 
                artwork[type === 'like' ? 'likes_count' : 'attacks_count'] + 1
            }
          : artwork
      ));

      toast({
        title: "Success!",
        description: `You ${type === 'like' ? 'liked' : 'attacked'} this artwork`,
      });
    }
  };

  const hasInteracted = (artworkId: string, type: 'like' | 'attack') => {
    return interactions.some(i => i.artwork_id === artworkId && i.interaction_type === type);
  };

  const getTeamBadge = (artwork: Artwork) => {
    if (artwork.event_participants && artwork.event_participants.length > 0) {
      const team = artwork.event_participants[0].team;
      return (
        <Badge variant={team === 'A' ? 'secondary' : 'outline'}>
          Team {team}
        </Badge>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <p className="text-muted-foreground">Loading gallery...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-teal bg-clip-text text-transparent mb-2">
          Art Gallery
        </h1>
        <p className="text-muted-foreground">
          Discover amazing artworks from our battle events
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {artworks.map((artwork) => (
          <Card key={artwork.id} className="overflow-hidden hover:shadow-teal transition-shadow duration-300">
            <div className="aspect-square relative">
              <img
                src={artwork.image_url}
                alt={artwork.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute top-2 right-2">
                {getTeamBadge(artwork)}
              </div>
            </div>
            <CardContent className="p-4">
              <div className="space-y-3">
                <div>
                  <h3 className="font-semibold text-lg">{artwork.title}</h3>
                  {artwork.description && (
                    <p className="text-sm text-muted-foreground">{artwork.description}</p>
                  )}
                </div>

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="h-4 w-4" />
                  <span>{artwork.profiles?.display_name || 'Unknown Artist'}</span>
                </div>

                {artwork.events && (
                  <div className="text-sm text-muted-foreground">
                    Event: {artwork.events.title}
                  </div>
                )}

                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleInteraction(artwork.id, 'like')}
                      disabled={hasInteracted(artwork.id, 'like')}
                      className="flex items-center gap-1 hover:text-red-500"
                    >
                      <Heart 
                        className={`h-4 w-4 ${hasInteracted(artwork.id, 'like') ? 'fill-red-500 text-red-500' : ''}`} 
                      />
                      <span>{artwork.likes_count}</span>
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleInteraction(artwork.id, 'attack')}
                      disabled={hasInteracted(artwork.id, 'attack')}
                      className="flex items-center gap-1 hover:text-orange-500"
                    >
                      <Sword 
                        className={`h-4 w-4 ${hasInteracted(artwork.id, 'attack') ? 'fill-orange-500 text-orange-500' : ''}`} 
                      />
                      <span>{artwork.attacks_count}</span>
                    </Button>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    {new Date(artwork.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {artworks.length === 0 && (
        <div className="text-center py-12">
          <h3 className="text-lg font-medium mb-2">No artworks yet</h3>
          <p className="text-muted-foreground">
            Be the first to submit artwork to an event!
          </p>
        </div>
      )}
    </div>
  );
}