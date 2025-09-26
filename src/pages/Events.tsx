import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, Clock, Users, Trophy, Palette, AlertCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import ArtworkUpload from '@/components/ArtworkUpload';
import EventGallery from '@/components/EventGallery';

interface Event {
  id: string;
  title: string;
  description: string;
  theme: string;
  midway_theme: string | null;
  start_time: string;
  end_time: string;
  midway_time: string | null;
  team_a_name: string;
  team_a_pfp: string | null;
  team_b_name: string;
  team_b_pfp: string | null;
  status: 'upcoming' | 'ongoing' | 'ended';
}

interface Participation {
  event_id: string;
  team: 'A' | 'B';
}

export default function Events() {
  const { user } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [participations, setParticipations] = useState<Participation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEvents();
    if (user) {
      fetchParticipations();
    }
  }, [user]);

  const fetchEvents = async () => {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .order('start_time', { ascending: true });

    if (error) {
      toast({
        title: "Error fetching events",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setEvents((data || []) as Event[]);
    }
    setLoading(false);
  };

  const fetchParticipations = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('event_participants')
      .select('event_id, team')
      .eq('user_id', user.id);

    if (error) {
      console.error('Error fetching participations:', error);
    } else {
      setParticipations((data || []) as Participation[]);
    }
  };

  const joinEvent = async (eventId: string) => {
    if (!user) return;

    // Check current participation counts
    const { data: participants, error: countError } = await supabase
      .from('event_participants')
      .select('team')
      .eq('event_id', eventId);

    if (countError) {
      toast({
        title: "Error joining event",
        description: countError.message,
        variant: "destructive",
      });
      return;
    }

    // Calculate team balance
    const teamACounts = participants?.filter(p => p.team === 'A').length || 0;
    const teamBCounts = participants?.filter(p => p.team === 'B').length || 0;
    const assignedTeam = teamACounts <= teamBCounts ? 'A' : 'B';

    const { error } = await supabase
      .from('event_participants')
      .insert({
        event_id: eventId,
        user_id: user.id,
        team: assignedTeam,
      });

    if (error) {
      toast({
        title: "Error joining event",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Successfully joined event!",
        description: `You've been assigned to Team ${assignedTeam}`,
      });
      fetchParticipations();
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'upcoming':
        return <Badge variant="secondary">Upcoming</Badge>;
      case 'ongoing':
        return <Badge className="bg-teal text-white">Ongoing</Badge>;
      case 'ended':
        return <Badge variant="outline">Ended</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getCurrentTheme = (event: Event) => {
    const now = new Date();
    const midwayTime = event.midway_time ? new Date(event.midway_time) : null;
    
    if (midwayTime && now >= midwayTime && event.midway_theme) {
      return event.midway_theme;
    }
    return event.theme;
  };

  const isEventOngoing = (event: Event) => {
    const now = new Date();
    const startTime = new Date(event.start_time);
    const endTime = new Date(event.end_time);
    
    return now >= startTime && now <= endTime;
  };

  const canUploadArtwork = (event: Event) => {
    return isEventOngoing(event) && isParticipating(event.id);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isParticipating = (eventId: string) => {
    return participations.find(p => p.event_id === eventId);
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <p className="text-muted-foreground">Loading events...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-teal bg-clip-text text-transparent mb-2">
          Battle Events
        </h1>
        <p className="text-muted-foreground">
          Join epic art battles and showcase your creativity
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {events.map((event) => {
          const participation = isParticipating(event.id);
          const currentTheme = getCurrentTheme(event);
          const canUpload = canUploadArtwork(event);
          const themeChanged = event.midway_theme && currentTheme === event.midway_theme;
          
          return (
            <Card key={event.id} className="hover:shadow-teal transition-shadow duration-300">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl">{event.title}</CardTitle>
                  {getStatusBadge(event.status)}
                </div>
                <CardDescription>{event.description}</CardDescription>
                
                {themeChanged && (
                  <div className="flex items-center gap-2 p-2 bg-teal/10 rounded-lg border border-teal/20">
                    <AlertCircle className="h-4 w-4 text-teal" />
                    <span className="text-sm text-teal font-medium">Theme changed!</span>
                  </div>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Palette className="h-4 w-4" />
                    <span>Current Theme: <strong className="text-teal">{currentTheme}</strong></span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>Starts: {formatDate(event.start_time)}</span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>Ends: {formatDate(event.end_time)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-secondary rounded-lg">
                    <p className="font-semibold text-sm">{event.team_a_name}</p>
                    <p className="text-xs text-muted-foreground">Team A</p>
                  </div>
                  <div className="text-center p-3 bg-secondary rounded-lg">
                    <p className="font-semibold text-sm">{event.team_b_name}</p>
                    <p className="text-xs text-muted-foreground">Team B</p>
                  </div>
                </div>

                {participation ? (
                  <div className="space-y-3">
                    <div className="text-center">
                      <Badge className="bg-teal text-white">
                        <Users className="h-3 w-3 mr-1" />
                        Team {participation.team}
                      </Badge>
                    </div>
                    
                    {canUpload && (
                      <ArtworkUpload 
                        eventId={event.id}
                        eventTitle={event.title}
                        currentTheme={currentTheme}
                        onArtworkUploaded={() => {
                          // Optionally refresh something
                        }}
                      />
                    )}
                    
                    {event.status === 'ongoing' && (
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" className="w-full">
                            <Trophy className="h-4 w-4 mr-2" />
                            View Battle Gallery
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
                          <DialogHeader>
                            <DialogTitle>{event.title} - Battle Gallery</DialogTitle>
                            <DialogDescription>
                              Current Theme: {currentTheme}
                            </DialogDescription>
                          </DialogHeader>
                          <div className="overflow-y-auto max-h-[70vh]">
                            <EventGallery 
                              eventId={event.id}
                              eventTitle={event.title}
                              teamAName={event.team_a_name}
                              teamBName={event.team_b_name}
                            />
                          </div>
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>
                ) : event.status === 'upcoming' ? (
                  <Button 
                    onClick={() => joinEvent(event.id)}
                    className="w-full shadow-glow hover:shadow-teal transition-all duration-300"
                  >
                    Join Battle
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <p className="text-center text-muted-foreground text-sm">
                      {event.status === 'ongoing' ? 'Battle in progress' : 'Battle ended'}
                    </p>
                    {event.status === 'ended' && (
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" className="w-full">
                            <Trophy className="h-4 w-4 mr-2" />
                            View Final Results
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
                          <DialogHeader>
                            <DialogTitle>{event.title} - Final Results</DialogTitle>
                            <DialogDescription>
                              Battle completed - Final theme: {currentTheme}
                            </DialogDescription>
                          </DialogHeader>
                          <div className="overflow-y-auto max-h-[70vh]">
                            <EventGallery 
                              eventId={event.id}
                              eventTitle={event.title}
                              teamAName={event.team_a_name}
                              teamBName={event.team_b_name}
                            />
                          </div>
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {events.length === 0 && (
        <div className="text-center py-12">
          <h3 className="text-lg font-medium mb-2">No events yet</h3>
          <p className="text-muted-foreground">
            Check back soon for exciting art battles!
          </p>
        </div>
      )}
    </div>
  );
}