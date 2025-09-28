import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Heart, User, Trophy, Upload, Sword, MessageCircle } from 'lucide-react';
import ArtworkUpload from './ArtworkUpload';
import AttackArtworkDialog from './AttackArtworkDialog';
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

interface FightArtwork {
  id: string;
  title: string;
  image_url: string;
  target_artwork_id: string;
  attacker_id: string;
  created_at: string;
  profiles: {
    username: string;
    display_name: string;
  } | null;
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
  const [fightArtworks, setFightArtworks] = useState<FightArtwork[]>([]);
  const [loading, setLoading] = useState(true);
  const [attackDialog, setAttackDialog] = useState<{
    isOpen: boolean;
    artworkId: string;
    artworkTitle: string;
  }>({
    isOpen: false,
    artworkId: '',
    artworkTitle: '',
  });

  useEffect(() => {
    fetchArtworks();
    fetchFightArtworks();
    if (user) {
      fetchInteractions();
    }
  }, [eventId, user]);

  const fetchArtworks = async () => {
    setLoading(true);
    try {
      // First, fetch the artworks with user details
      const { data: artworksData, error: artworksError } = await supabase
        .from('artworks')
        .select(`
          *,
          profiles:user_id (username, display_name)
        `)
        .eq('event_id', eventId)
        .order('created_at', { ascending: false });

      if (artworksError) throw artworksError;

      if (!artworksData || artworksData.length === 0) {
        setArtworks([]);
        setLoading(false);
        return;
      }

      // Get all user IDs to fetch their team information
      const userIds = artworksData.map(artwork => artwork.user_id);
      
      // Fetch team information for all users in one query
      const { data: participantsData, error: participantsError } = await supabase
        .from('event_participants')
        .select('user_id, team')
        .eq('event_id', eventId)
        .in('user_id', userIds);

      if (participantsError) throw participantsError;

      // Create a map of user_id to team
      const userTeamMap = new Map();
      participantsData?.forEach(participant => {
        userTeamMap.set(participant.user_id, participant.team);
      });

      // Combine the data
      const artworksWithTeams = artworksData.map(artwork => ({
        ...artwork,
        event_participants: userTeamMap.has(artwork.user_id) 
          ? [{ team: userTeamMap.get(artwork.user_id) }] 
          : null
      }));

      // Apply team filter if specified
      const filteredArtworks = teamFilter
        ? artworksWithTeams.filter(artwork => 
            artwork.event_participants?.some(p => p.team === teamFilter)
          )
        : artworksWithTeams;

      setArtworks(filteredArtworks as unknown as Artwork[]);
    } catch (error) {
      console.error('Error fetching artworks:', error);
      toast({
        title: "Error fetching artworks",
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchInteractions = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('artwork_interactions')
        .select('artwork_id, interaction_type')
        .eq('user_id', user.id);

      if (error) {
        console.error('Error fetching interactions:', error);
      } else {
        setInteractions((data || []) as Interaction[]);
      }
    } catch (error) {
      console.error('Unexpected error in fetchInteractions:', error);
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

  const fetchFightArtworks = async () => {
    try {
      // First get fight artworks
      const { data: fightData, error } = await supabase
        .from('fight_artworks')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!fightData || fightData.length === 0) {
        setFightArtworks([]);
        return;
      }

      // Get attacker profiles
      const attackerIds = fightData.map(f => f.attacker_id);
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username, display_name')
        .in('id', attackerIds);

      if (profilesError) throw profilesError;

      // Combine data
      const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);
      const fightsWithProfiles = fightData.map(fight => ({
        ...fight,
        profiles: profilesMap.get(fight.attacker_id) || null
      }));

      setFightArtworks(fightsWithProfiles as FightArtwork[]);
    } catch (error) {
      console.error('Error fetching fight artworks:', error);
    }
  };

  const handleUploadSuccess = async (newArtwork: Artwork) => {
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'Please sign in to upload artwork',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Add 3 points to the user's score for uploading artwork
      const { data: currentPoints, error: fetchError } = await supabase
        .from('user_points')
        .select('artwork_points, points_total')
        .eq('user_id', user.id)
        .eq('event_id', eventId)
        .single();

      // Handle the case where the user doesn't have points record yet
      const currentArtworkPoints = currentPoints?.artwork_points || 0;
      const currentTotalPoints = currentPoints?.points_total || 0;

      // Update user points with the new artwork points
      const { error: updateError } = await supabase
        .from('user_points')
        .upsert({
          user_id: user.id,
          event_id: eventId,
          artwork_points: currentArtworkPoints + 3, // 3 points for uploading artwork
          points_total: currentTotalPoints + 3,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,event_id'
        });

      if (updateError) throw updateError;

      // Add the new artwork to the local state
      setArtworks(prev => [newArtwork, ...prev] as Artwork[]);
      
      // Refresh team scores to reflect the new points
      await fetchTeamScores();
      
      // Show success message
      toast({
        title: 'Artwork uploaded!',
        description: 'Your artwork has been submitted successfully. +3 points awarded!',
      });
    } catch (error) {
      console.error('Error handling upload success:', error);
      toast({
        title: 'Error',
        description: 'Failed to update points. Your artwork was uploaded, but points may not have been awarded.',
        variant: 'destructive',
      });
    }
  };

  const handleLikeToggle = async (artworkId: string) => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to like artworks",
        variant: "destructive",
      });
      return;
    }

    const artwork = artworks.find(a => a.id === artworkId);
    if (!artwork) return;

    // Prevent user from liking their own artwork
    if (artwork.user_id === user.id) {
      toast({
        title: "Not allowed",
        description: "You cannot like your own artwork",
        variant: "destructive",
      });
      return;
    }

    // Get user's team
    const { data: userParticipant } = await supabase
      .from('event_participants')
      .select('team')
      .eq('user_id', user.id)
      .eq('event_id', eventId)
      .single();

    // Get artwork owner's team
    const artworkTeam = artwork.event_participants?.[0]?.team;

    // Prevent user from liking artwork from their own team
    if (userParticipant?.team && artworkTeam && userParticipant.team === artworkTeam) {
      toast({
        title: "Not allowed",
        description: "You cannot like artwork from your own team",
        variant: "destructive",
      });
      return;
    }

    try {
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

        if (error) throw error;

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

        if (error) throw error;

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
          title: "🎉 Congratulations!",
          description: "You liked this artwork and the artist earned 1 point!",
        });
      }

      // Refresh team scores
      await fetchTeamScores();
    } catch (error) {
      console.error('Error toggling like:', error);
      toast({
        title: 'Error',
        description: 'Failed to update like status. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleAttackClick = async (artworkId: string, artworkTitle: string) => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to attack artworks",
        variant: "destructive",
      });
      return;
    }

    const artwork = artworks.find(a => a.id === artworkId);
    if (!artwork) return;

    // Prevent user from attacking their own artwork
    if (artwork.user_id === user.id) {
      toast({
        title: "Not allowed",
        description: "You cannot attack your own artwork",
        variant: "destructive",
      });
      return;
    }

    // Get user's team
    const { data: userParticipant } = await supabase
      .from('event_participants')
      .select('team')
      .eq('user_id', user.id)
      .eq('event_id', eventId)
      .single();

    // Get artwork owner's team
    const artworkTeam = artwork.event_participants?.[0]?.team;

    // Prevent user from attacking artwork from their own team
    if (userParticipant?.team && artworkTeam && userParticipant.team === artworkTeam) {
      toast({
        title: "Not allowed",
        description: "You cannot attack artwork from your own team",
        variant: "destructive",
      });
      return;
    }

    // Check if already attacked
    if (hasInteracted(artworkId, 'attack')) {
      toast({
        title: "Already attacked",
        description: "You have already attacked this artwork",
        variant: "destructive",
      });
      return;
    }

    setAttackDialog({
      isOpen: true,
      artworkId,
      artworkTitle,
    });
  };

  const handleAttackSuccess = () => {
    fetchArtworks();
    fetchInteractions();
    fetchTeamScores();
    fetchFightArtworks();
  };

  const hasInteracted = (artworkId: string, type: 'like' | 'attack') => {
    return interactions.some(i => i.artwork_id === artworkId && i.interaction_type === type);
  };

  const getTeamBadge = (artwork: Artwork) => {
    if (artwork.event_participants && artwork.event_participants.length > 0) {
      const team = artwork.event_participants[0]?.team;
      if (!team) return null;
      
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
      {/* Event Title */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 pb-4 pt-2 border-b">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold">{eventTitle}</h2>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4">
        {/* Team Scores */}
        <div className="grid grid-cols-2 gap-4 my-6">
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
                      disabled={artwork.user_id === user?.id || hasInteracted(artwork.id, 'like')}
                    >
                      <Heart 
                        className={`h-4 w-4 ${hasInteracted(artwork.id, 'like') ? 'fill-red-500 text-red-500' : ''}`} 
                      />
                      <span>{artwork.likes_count}</span>
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleAttackClick(artwork.id, artwork.title)}
                      className="flex items-center gap-1 hover:text-destructive"
                      disabled={artwork.user_id === user?.id || hasInteracted(artwork.id, 'attack')}
                    >
                      <Sword className="h-4 w-4" />
                      <span>{artwork.attacks_count}</span>
                    </Button>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    {new Date(artwork.created_at).toLocaleDateString()}
                  </div>
                </div>

                {/* Attack Thread */}
                {artwork.attacks_count > 0 && (
                  <div className="mt-3 pt-3 border-t">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MessageCircle className="h-4 w-4" />
                      <span>Under attack • {artwork.attacks_count} battle{artwork.attacks_count > 1 ? 's' : ''}</span>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Attack Dialog */}
      <AttackArtworkDialog
        isOpen={attackDialog.isOpen}
        onClose={() => setAttackDialog({ isOpen: false, artworkId: '', artworkTitle: '' })}
        targetArtworkId={attackDialog.artworkId}
        targetArtworkTitle={attackDialog.artworkTitle}
        eventId={eventId}
        onAttackSuccess={handleAttackSuccess}
      />

      {artworks.length === 0 && (
        <div className="text-center py-12">
          <h3 className="text-lg font-medium mb-2">No artworks yet</h3>
          <p className="text-muted-foreground">
            Be the first to submit artwork for this event!
          </p>
        </div>
      )}
      </div>
    </div>
  );
}