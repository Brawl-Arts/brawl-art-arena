import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Users, Trophy, Calendar, Clock } from 'lucide-react';
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

  useEffect(() => {
    if (eventId) {
      fetchEvent();
      fetchParticipants();
    }
  }, [eventId]);

  const fetchEvent = async () => {
    if (!eventId) return;

    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (error) {
      toast({
        title: "Error fetching event",
        description: error.message,
        variant: "destructive",
      });
      navigate('/events');
    } else {
      setEvent(data);
    }
    setLoading(false);
  };

  const fetchParticipants = async () => {
    if (!eventId) return;

    const { data, error } = await supabase
      .from('event_participants')
      .select(`
        user_id,
        team,
        profiles:user_id (display_name, username)
      `)
      .eq('event_id', eventId);

    if (error) {
      console.error('Error fetching participants:', error);
    } else {
      setParticipants((data || []) as unknown as Participant[]);
      
      // Check if current user is already participating
      if (user) {
        const userParticipant = data?.find(p => p.user_id === user.id);
        setUserParticipation(userParticipant?.team as 'A' | 'B' || null);
      }
    }
  };

  const joinEvent = async () => {
    if (!user || !eventId || !event) {
      toast({
        title: "Cannot join event",
        description: "Please sign in to join the event",
        variant: "destructive",
      });
      return;
    }

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
          event_id: eventId,
          team: assignedTeam,
        });

      if (error) {
        throw error;
      }

      toast({
        title: "Successfully joined event!",
        description: `You've been assigned to Team ${assignedTeam}: ${assignedTeam === 'A' ? event.team_a_name : event.team_b_name}`,
      });

      setUserParticipation(assignedTeam);
      fetchParticipants();

    } catch (error: any) {
      toast({
        title: "Failed to join event",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setJoining(false);
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
                    {userParticipation === 'B' && (
                      <Badge variant="secondary" className="mt-2">Your Team</Badge>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>

          {/* Artwork Upload */}
          {userParticipation && canUploadArtwork() && (
            <div className="mt-6 pt-6 border-t">
              <ArtworkUpload
                eventId={event.id}
                eventTitle={event.title}
                currentTheme={getCurrentTheme()}
                onArtworkUploaded={fetchParticipants}
              />
            </div>
          )}

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

      {/* Gallery Tabs */}
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
  );
}