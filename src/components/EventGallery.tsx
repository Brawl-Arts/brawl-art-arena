import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Heart, Sword, User, Trophy } from 'lucide-react';
import FightUpload from './FightUpload';
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
  profiles: {
    username: string;
    display_name: string;
  } | null;
  event_participants: {
    team: 'A' | 'B';
  }[] | null;
}

interface Interaction {
  artwork_id: string;
  interaction_type: 'like' | 'attack';
}

interface TeamScore {
  team: 'A' | 'B';
  totalPoints: number;
  memberCount: number;
}

interface EventGalleryProps {
  eventId: string;
  eventTitle: string;
  teamAName: string;
  teamBName: string;
  teamFilter?: 'A' | 'B';
}

export default function EventGallery({ eventId, eventTitle, teamAName, teamBName, teamFilter }: EventGalleryProps) {
  const { user } = useAuth();
  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [teamScores, setTeamScores] = useState<TeamScore[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchArtworks();
    fetchTeamScores();
    if (user) {
      fetchInteractions();
    }
  }, [eventId, user]);

  const fetchArtworks = async () => {
    let query = supabase
      .from('artworks')
      .select(`
        *,
        profiles:user_id (username, display_name),
        event_participants:event_id (team)
      `)
      .eq('event_id', eventId);

    // Apply team filter if specified
    if (teamFilter) {
      const { data: teamData } = await supabase
        .from('event_participants')
        .select('user_id')
        .eq('event_id', eventId)
        .eq('team', teamFilter);
      
      if (teamData && teamData.length > 0) {
        const userIds = teamData.map(p => p.user_id);
        query = query.in('user_id', userIds);
      }
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      toast({
        title: "Error fetching artworks",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setArtworks((data || []) as unknown as Artwork[]);
    }
    setLoading(false);
  };

  const fetchInteractions = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('artwork_interactions')
      .select('artwork_id, interaction_type')
      .eq('user_id', user.id);

    if (error) {
      console.error('Error fetching interactions:', error);
    } else {
      setInteractions((data || []) as Interaction[]);
    }
  };

  const fetchTeamScores = async () => {
    const { data, error } = await supabase
      .from('user_points')
      .select('*')
      .eq('event_id', eventId);

    if (error) {
      console.error('Error fetching team scores:', error);
      return;
    }

    // Get team participants
    const { data: participants, error: participantsError } = await supabase
      .from('event_participants')
      .select('user_id, team')
      .eq('event_id', eventId);

    if (participantsError) {
      console.error('Error fetching participants:', participantsError);
      return;
    }

    // Calculate team scores
    const teamA = { team: 'A' as const, totalPoints: 0, memberCount: 0 };
    const teamB = { team: 'B' as const, totalPoints: 0, memberCount: 0 };

    participants?.forEach(participant => {
      const userPoints = data?.find(p => p.user_id === participant.user_id);
      const points = userPoints?.points_total || 0;
      
      if (participant.team === 'A') {
        teamA.totalPoints += points;
        teamA.memberCount++;
      } else {
        teamB.totalPoints += points;
        teamB.memberCount++;
      }
    });

    setTeamScores([teamA, teamB]);
  };

  const handleLikeToggle = async (artworkId: string) => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to interact with artworks",
        variant: "destructive",
      });
      return;
    }

    // Check if already liked
    const existingLike = interactions.find(
      i => i.artwork_id === artworkId && i.interaction_type === 'like'
    );

    if (existingLike) {
      // Unlike - remove the interaction
      const { error } = await supabase
        .from('artwork_interactions')
        .delete()
        .eq('artwork_id', artworkId)
        .eq('user_id', user.id)
        .eq('interaction_type', 'like');

      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      // Update local state
      setInteractions(prev => prev.filter(i => !(i.artwork_id === artworkId && i.interaction_type === 'like')));
      
      // Update artwork counts
      setArtworks(prev => prev.map(artwork => 
        artwork.id === artworkId 
          ? { ...artwork, likes_count: Math.max(0, artwork.likes_count - 1) }
          : artwork
      ));

      // Remove like points from artwork owner
      const artwork = artworks.find(a => a.id === artworkId);
      if (artwork) {
        const { data: existingPoints } = await supabase
          .from('user_points')
          .select('like_points, points_total')
          .eq('user_id', artwork.user_id)
          .eq('event_id', eventId)
          .single();

        if (existingPoints) {
          const { error: pointsError } = await supabase
            .from('user_points')
            .update({
              like_points: Math.max(0, existingPoints.like_points - 1),
              points_total: Math.max(0, existingPoints.points_total - 1)
            })
            .eq('user_id', artwork.user_id)
            .eq('event_id', eventId);

          if (pointsError) {
            console.error('Error updating like points:', pointsError);
          }
        }
      }

      toast({
        title: "Unliked",
        description: "You unliked this artwork",
      });

    } else {
      // Like - add the interaction
      const { error } = await supabase
        .from('artwork_interactions')
        .insert({
          artwork_id: artworkId,
          user_id: user.id,
          interaction_type: 'like',
        });

      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      // Update local state
      setInteractions(prev => [...prev, { artwork_id: artworkId, interaction_type: 'like' }]);
      
      // Update artwork counts
      setArtworks(prev => prev.map(artwork => 
        artwork.id === artworkId 
          ? { ...artwork, likes_count: artwork.likes_count + 1 }
          : artwork
      ));

      // Add like points to artwork owner (+1 point)
      const artwork = artworks.find(a => a.id === artworkId);
      if (artwork) {
        const { data: existingPoints } = await supabase
          .from('user_points')
          .select('like_points, points_total')
          .eq('user_id', artwork.user_id)
          .eq('event_id', eventId)
          .single();

        const currentLikePoints = existingPoints?.like_points || 0;
        const currentTotal = existingPoints?.points_total || 0;

        const { error: likePointsError } = await supabase
          .from('user_points')
          .upsert({
            user_id: artwork.user_id,
            event_id: eventId,
            like_points: currentLikePoints + 1,
            points_total: currentTotal + 1
          }, {
            onConflict: 'user_id,event_id'
          });

        if (likePointsError) {
          console.error('Error updating like points:', likePointsError);
        }
      }

      toast({
        title: "Liked!",
        description: "You liked this artwork (+1 point to artist)",
      });
    }

    // Refresh team scores
    fetchTeamScores();
  };

  const hasInteracted = (artworkId: string, type: 'like' | 'attack') => {
    return interactions.some(i => i.artwork_id === artworkId && i.interaction_type === type);
  };

  const getTeamBadge = (artwork: Artwork) => {
    if (artwork.event_participants && artwork.event_participants.length > 0) {
      const team = artwork.event_participants[0].team;
      return (
        <Badge 
          variant={team === 'A' ? 'default' : 'secondary'}
          className={team === 'A' ? 'bg-primary text-primary-foreground' : 'bg-accent text-accent-foreground'}
        >
          Team {team}
        </Badge>
      );
    }
    return null;
  };

  const winningTeam = teamScores.length > 0 ? 
    teamScores.reduce((a, b) => a.totalPoints > b.totalPoints ? a : b) : null;

  if (loading) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Loading gallery...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Team Scores */}
      <div className="grid grid-cols-2 gap-4">
        {teamScores.map((team) => (
                <Card key={team.team} className={`border-2 ${team === winningTeam ? 'border-primary border-solid shadow-red' : ''}`}>
                  <CardContent className="p-4 text-center">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      {team === winningTeam && <Trophy className="h-5 w-5 text-gold" />}
                      <h3 className="font-semibold">
                        {team.team === 'A' ? teamAName : teamBName}
                      </h3>
                    </div>
                    <p className="text-2xl font-bold text-primary">{team.totalPoints} pts</p>
                    <p className="text-sm text-muted-foreground">{team.memberCount} members</p>
                  </CardContent>
                </Card>
        ))}
      </div>

      {/* Artworks Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {artworks.map((artwork) => (
          <Card key={artwork.id} className="overflow-hidden hover:shadow-red transition-shadow duration-300">
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

                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleLikeToggle(artwork.id)}
                      className="flex items-center gap-1 hover:text-red-500"
                    >
                      <Heart 
                        className={`h-4 w-4 ${hasInteracted(artwork.id, 'like') ? 'fill-red-500 text-red-500' : ''}`} 
                      />
                      <span>{artwork.likes_count}</span>
                    </Button>

                    <FightUpload
                      targetArtworkId={artwork.id}
                      targetArtworkTitle={artwork.title}
                      onFightUploaded={fetchArtworks}
                    />
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
            Be the first to submit artwork for this event!
          </p>
        </div>
      )}
    </div>
  );
}