import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Users, Trophy, Calendar, Clock, Upload } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import EventGallery from './EventGallery';
import ArtworkUpload from './ArtworkUpload';

interface Event {
  id: string;
  title: string;
  description: string;
  theme: string;
  midway_theme: string | null;
  start_time: string;
  end_time: string;
  midway_time: string | null;
  status: string;
  team_a_name: string;
  team_a_pfp: string | null;
  team_b_name: string;
  team_b_pfp: string | null;
}

interface Participant {
  user_id: string;
  team: 'A' | 'B';
  profiles: {
    display_name: string;
    username: string;
  } | null;
}

export default function EventDetail() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [event, setEvent] = useState<Event | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [userParticipation, setUserParticipation] = useState<'A' | 'B' | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [teamPoints, setTeamPoints] = useState<{ teamA: number; teamB: number }>({ teamA: 0, teamB: 0 });

  const joinEvent = async () => {
    if (!user) {
      toast({
        title: "Cannot join event",
        description: "Please sign in to join the event",
        variant: "destructive",
      });
      return;
    }

    if (!event) return;

    if (event.status !== 'upcoming' && event.status !== 'ongoing') {
      toast({
        title: "Cannot join event",
        description: "This event is no longer accepting participants",
        variant: "destructive",
      });
      return;
    }

    setJoining(true);

    try {
      // Count current participants for each team
      const teamACounts = participants.filter(p => p.team === 'A').length;
      const teamBCounts = participants.filter(p => p.team === 'B').length;
      
      // Assign to team with fewer members (balanced assignment)
      const assignedTeam = teamACounts <= teamBCounts ? 'A' : 'B';

      const { error } = await supabase
        .from('event_participants')
        .insert({
          user_id: user.id,
          event_id: event.id,
          team: assignedTeam,
        });

      if (error) throw error;

      // Update local state
      setUserParticipation(assignedTeam);
      
      // Refresh participants list
      await fetchParticipants();

      toast({
        title: "Success!",
        description: `You've been added to Team ${assignedTeam}: ${assignedTeam === 'A' ? event.team_a_name : event.team_b_name}`,
      });
    } catch (error) {
      console.error('Error joining event:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to join event',
        variant: "destructive",
      });
    } finally {
      setJoining(false);
    }
  };

  useEffect(() => {
    if (eventId) {
      fetchEvent();
      fetchParticipants();
      fetchTeamPoints();
    }
  }, [eventId]);

  const fetchTeamPoints = async () => {
    if (!eventId) return;

    try {
      // Get all user points for this event
      const { data: userPoints, error: pointsError } = await supabase
        .from('user_points')
        .select('user_id, points_total')
        .eq('event_id', eventId);

      if (pointsError) throw pointsError;

      // Get all participants to know which team they're on
      const { data: participants, error: participantsError } = await supabase
        .from('event_participants')
        .select('user_id, team')
        .eq('event_id', eventId);

      if (participantsError) throw participantsError;

      // Calculate team totals
      let teamATotal = 0;
      let teamBTotal = 0;

      participants?.forEach(participant => {
        const userPoint = userPoints?.find(p => p.user_id === participant.user_id);
        const points = userPoint?.points_total || 0;
        
        if (participant.team === 'A') {
          teamATotal += points;
        } else {
          teamBTotal += points;
        }
      });

      setTeamPoints({ teamA: teamATotal, teamB: teamBTotal });
    } catch (error) {
      console.error('Error fetching team points:', error);
    }
  };

  const fetchEvent = async () => {
    if (!eventId) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single();

      if (error) throw error;
      
      if (data) {
        setEvent(data);
      } else {
        toast({
          title: "Event not found",
          description: "The requested event could not be found.",
          variant: "destructive",
        });
        navigate('/events');
      }
    } catch (error) {
      console.error('Error fetching event:', error);
      toast({
        title: "Error fetching event",
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        variant: "destructive",
      });
      navigate('/events');
    } finally {
      setLoading(false);
    }
  };

  const fetchParticipants = async () => {
    if (!eventId) return;

    try {
      // First, get all participants for the event
      const { data: participantsData, error: participantsError } = await supabase
        .from('event_participants')
        .select('user_id, team')
        .eq('event_id', eventId);

      if (participantsError) throw participantsError;

      if (!participantsData || participantsData.length === 0) {
        setParticipants([]);
        return;
      }

      // Get user IDs to fetch profile information
      const userIds = participantsData.map(p => p.user_id);
      
      // Fetch user profiles in a separate query
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username, display_name')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      // Create a map of user_id to profile
      const profilesMap = new Map(profilesData?.map(profile => [profile.id, profile]) || []);

      // Combine the data
      const participantsWithProfiles = participantsData.map(participant => ({
        user_id: participant.user_id,
        team: participant.team,
        profiles: profilesMap.get(participant.user_id) || null
      }));

      setParticipants(participantsWithProfiles as unknown as Participant[]);
      
      // Check if current user is already participating
      if (user) {
        const userParticipant = participantsData.find(p => p.user_id === user.id);
        setUserParticipation(userParticipant?.team as 'A' | 'B' || null);
      }
    } catch (error) {
      console.error('Error fetching participants:', error);
      toast({
        title: 'Error',
        description: 'Failed to load participants',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const canUploadArtwork = () => {
    if (!event || !userParticipation) return false;
    
    // Can upload if event is ongoing and midway theme is revealed (if it exists)
    if (event.status !== 'ongoing') return false;
    
    // If there's a midway time, check if it has passed
    if (event.midway_time) {
      const midwayTime = new Date(event.midway_time);
      const now = new Date();
      return now >= midwayTime;
    }
    
    // If no midway time, can upload immediately when event starts
    return true;
  };

  const getCurrentTheme = () => {
    if (!event) return '';
    
    if (event.midway_time && event.midway_theme) {
      const midwayTime = new Date(event.midway_time);
      const now = new Date();
      
      if (now >= midwayTime) {
        return event.midway_theme;
      }
    }
    
    return event.theme;
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <p className="text-muted-foreground">Loading event...</p>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <p className="text-muted-foreground">Event not found</p>
          <Button onClick={() => navigate('/events')} className="mt-4">
            Back to Events
          </Button>
        </div>
      </div>
    );
  }

  const teamAParticipants = participants.filter(p => p.team === 'A');
  const teamBParticipants = participants.filter(p => p.team === 'B');

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" onClick={() => navigate('/events')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Events
        </Button>
      </div>

      {/* Event Info */}
      <Card className="mb-8">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-2xl flex items-center gap-2">
                {event.title}
                <Badge variant={event.status === 'upcoming' ? 'default' : event.status === 'ongoing' ? 'destructive' : 'secondary'}>
                  {event.status}
                </Badge>
              </CardTitle>
              <CardDescription className="mt-2">{event.description}</CardDescription>
            </div>
            {!userParticipation && (event.status === 'upcoming' || event.status === 'ongoing') && (
              <Button onClick={joinEvent} disabled={joining}>
                {joining ? 'Joining...' : 'Join Event'}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            {/* Event Details */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-primary" />
                <span className="font-medium">Start:</span>
                <span>{new Date(event.start_time).toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-primary" />
                <span className="font-medium">End:</span>
                <span>{new Date(event.end_time).toLocaleString()}</span>
              </div>
              {event.midway_time && (
                <div className="flex items-center gap-2 text-sm">
                  <Trophy className="h-4 w-4 text-primary" />
                  <span className="font-medium">Midway:</span>
                  <span>{new Date(event.midway_time).toLocaleString()}</span>
                </div>
              )}
              <div>
                <span className="font-medium text-sm">Current Theme:</span>
                <span className="ml-2 text-sm font-semibold text-primary">{getCurrentTheme()}</span>
              </div>
            </div>

            {/* Teams */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Card className="border-2 border-primary/20">
                  <CardContent className="p-4 text-center">
                    <h3 className="font-semibold text-primary">{event.team_a_name}</h3>
                    <div className="flex items-center justify-center gap-1 mt-2">
                      <Users className="h-4 w-4" />
                      <span className="text-sm">{teamAParticipants.length} members</span>
                    </div>
                    <div className="flex items-center justify-center gap-1 mt-1">
                      <Trophy className="h-4 w-4 text-primary" />
                      <span className="text-sm font-semibold">{teamPoints.teamA} points</span>
                    </div>
                    {userParticipation === 'A' && (
                      <Badge variant="default" className="mt-2">Your Team</Badge>
                    )}
                  </CardContent>
                </Card>
                <Card className="border-2 border-accent/20">
                  <CardContent className="p-4 text-center">
                    <h3 className="font-semibold text-accent">{event.team_b_name}</h3>
                    <div className="flex items-center justify-center gap-1 mt-2">
                      <Users className="h-4 w-4" />
                      <span className="text-sm">{teamBParticipants.length} members</span>
                    </div>
                    <div className="flex items-center justify-center gap-1 mt-1">
                      <Trophy className="h-4 w-4 text-accent" />
                      <span className="text-sm font-semibold">{teamPoints.teamB} points</span>
                    </div>
                    {userParticipation === 'B' && (
                      <Badge variant="secondary" className="mt-2">Your Team</Badge>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>

          {/* Artwork Upload Message */}
          {userParticipation && !canUploadArtwork() && event.status === 'ongoing' && event.midway_time && (
            <div className="mt-6 pt-6 border-t">
              <Card className="border-accent/20 bg-accent/5">
                <CardContent className="p-4 text-center">
                  <p className="text-sm text-muted-foreground">
                    Artwork uploads will be available after the midway theme is revealed
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Midway time: {new Date(event.midway_time).toLocaleString()}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Button and Tabs */}
      <div className="space-y-4">
        {user && (
          <div className="flex justify-end">
            <ArtworkUpload
              eventId={event.id}
              eventTitle={event.title}
              currentTheme={event.midway_theme || event.theme}
              onArtworkUploaded={() => {
                fetchTeamPoints();
              }}
            />
          </div>
        )}
        
        <Tabs defaultValue="all" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="all">All Artworks</TabsTrigger>
            <TabsTrigger value="team-a">Team {event.team_a_name}</TabsTrigger>
            <TabsTrigger value="team-b">Team {event.team_b_name}</TabsTrigger>
          </TabsList>
          
          <TabsContent value="all">
            <EventGallery
              eventId={event.id}
              eventTitle={event.title}
              teamAName={event.team_a_name}
              teamBName={event.team_b_name}
            />
          </TabsContent>
          
          <TabsContent value="team-a">
            <EventGallery
              eventId={event.id}
              eventTitle={event.title}
              teamAName={event.team_a_name}
              teamBName={event.team_b_name}
              teamFilter="A"
            />
          </TabsContent>
          
          <TabsContent value="team-b">
            <EventGallery
              eventId={event.id}
              eventTitle={event.title}
              teamAName={event.team_a_name}
              teamBName={event.team_b_name}
              teamFilter="B"
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}