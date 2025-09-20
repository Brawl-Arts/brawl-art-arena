import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Trophy, Users, ArrowRight, Image } from 'lucide-react';
import ghostMascot from '@/assets/teal-ghost-mascot.png';

interface Event {
  id: string;
  title: string;
  description: string;
  theme: string;
  start_time: string;
  end_time: string;
  team_a_name: string;
  team_b_name: string;
  status: 'upcoming' | 'ongoing' | 'ended';
}

const Index = () => {
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([]);
  const [ongoingEvents, setOngoingEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .in('status', ['upcoming', 'ongoing'])
      .order('start_time', { ascending: true });

    if (!error && data) {
      const upcoming = data.filter(e => e.status === 'upcoming');
      const ongoing = data.filter(e => e.status === 'ongoing');
      setUpcomingEvents(upcoming as Event[]);
      setOngoingEvents(ongoing as Event[]);
    }
    setLoading(false);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Hero Section */}
      <div className="text-center mb-12">
        <img src={ghostMascot} alt="Brawl Arts Ghost" className="h-24 w-24 mx-auto mb-6" />
        <h1 className="text-5xl font-bold bg-gradient-teal bg-clip-text text-transparent mb-4">
          Welcome to Brawl Arts
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Join epic art battles, showcase your creativity, and compete for glory in our battle arena
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-3 mb-12">
        <Link to="/events">
          <Card className="hover:shadow-teal transition-shadow duration-300 cursor-pointer">
            <CardContent className="p-6 text-center">
              <Calendar className="h-12 w-12 mx-auto mb-4 text-primary" />
              <h3 className="font-semibold mb-2">Join Events</h3>
              <p className="text-sm text-muted-foreground">Participate in art battles</p>
            </CardContent>
          </Card>
        </Link>

        <Link to="/gallery">
          <Card className="hover:shadow-teal transition-shadow duration-300 cursor-pointer">
            <CardContent className="p-6 text-center">
              <Image className="h-12 w-12 mx-auto mb-4 text-primary" />
              <h3 className="font-semibold mb-2">Art Gallery</h3>
              <p className="text-sm text-muted-foreground">Explore amazing artworks</p>
            </CardContent>
          </Card>
        </Link>

        <Link to="/profile">
          <Card className="hover:shadow-teal transition-shadow duration-300 cursor-pointer">
            <CardContent className="p-6 text-center">
              <Trophy className="h-12 w-12 mx-auto mb-4 text-primary" />
              <h3 className="font-semibold mb-2">Your Stats</h3>
              <p className="text-sm text-muted-foreground">View your achievements</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Ongoing Events */}
      {ongoingEvents.length > 0 && (
        <div className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-3xl font-bold">🔥 Live Battles</h2>
            <Link to="/events">
              <Button variant="outline" className="flex items-center gap-2">
                View All <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
          
          <div className="grid gap-6 md:grid-cols-2">
            {ongoingEvents.slice(0, 2).map((event) => (
              <Card key={event.id} className="border-primary/50 shadow-glow">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xl">{event.title}</CardTitle>
                    <Badge className="bg-teal text-white animate-pulse">LIVE</Badge>
                  </div>
                  <CardDescription>{event.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Trophy className="h-4 w-4" />
                    <span>Theme: {event.theme}</span>
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

                  <Link to="/events">
                    <Button className="w-full shadow-glow">
                      <Users className="h-4 w-4 mr-2" />
                      Join the Battle
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming Events */}
      {upcomingEvents.length > 0 && (
        <div className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-3xl font-bold">⏰ Upcoming Battles</h2>
            <Link to="/events">
              <Button variant="outline" className="flex items-center gap-2">
                View All <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
          
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {upcomingEvents.slice(0, 3).map((event) => (
              <Card key={event.id} className="hover:shadow-teal transition-shadow duration-300">
                <CardHeader>
                  <CardTitle className="text-lg">{event.title}</CardTitle>
                  <CardDescription>{event.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Trophy className="h-4 w-4" />
                    <span>Theme: {event.theme}</span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>Starts: {formatDate(event.start_time)}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="text-center p-2 bg-secondary rounded">
                      {event.team_a_name}
                    </div>
                    <div className="text-center p-2 bg-secondary rounded">
                      {event.team_b_name}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* No Events State */}
      {!loading && upcomingEvents.length === 0 && ongoingEvents.length === 0 && (
        <div className="text-center py-12">
          <img src={ghostMascot} alt="No events" className="h-16 w-16 mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-medium mb-2">No active battles</h3>
          <p className="text-muted-foreground mb-6">
            Check back soon for new art battle events!
          </p>
          <Link to="/gallery">
            <Button variant="outline">
              <Image className="h-4 w-4 mr-2" />
              Browse Gallery
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
};

export default Index;
