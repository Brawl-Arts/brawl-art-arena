import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Calendar, Image, Target } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface Profile {
  username: string;
  display_name: string;
  avatar_url: string | null;
}

interface UserStats {
  totalArtworks: number;
  totalLikes: number;
  totalAttacks: number;
  totalPoints: number;
  eventsParticipated: number;
}

interface Event {
  id: string;
  title: string;
  team: 'A' | 'B';
  points: number;
}

export default function Profile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<UserStats>({
    totalArtworks: 0,
    totalLikes: 0,
    totalAttacks: 0,
    totalPoints: 0,
    eventsParticipated: 0,
  });
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchStats();
      fetchEvents();
    }
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('profiles')
      .select('username, display_name, avatar_url')
      .eq('user_id', user.id)
      .single();

    if (error) {
      console.error('Error fetching profile:', error);
    } else {
      setProfile(data);
    }
  };

  const fetchStats = async () => {
    if (!user) return;

    // Fetch artworks count
    const { count: artworksCount } = await supabase
      .from('artworks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    // Fetch total likes received
    const { data: artworkIds } = await supabase
      .from('artworks')
      .select('id')
      .eq('user_id', user.id);

    let totalLikes = 0;
    let totalAttacks = 0;

    if (artworkIds && artworkIds.length > 0) {
      const ids = artworkIds.map(a => a.id);
      
      const { count: likesCount } = await supabase
        .from('artwork_interactions')
        .select('*', { count: 'exact', head: true })
        .in('artwork_id', ids)
        .eq('interaction_type', 'like');

      const { count: attacksCount } = await supabase
        .from('artwork_interactions')
        .select('*', { count: 'exact', head: true })
        .in('artwork_id', ids)
        .eq('interaction_type', 'attack');

      totalLikes = likesCount || 0;
      totalAttacks = attacksCount || 0;
    }

    // Fetch total points
    const { data: pointsData } = await supabase
      .from('user_points')
      .select('points_total')
      .eq('user_id', user.id);

    const totalPoints = pointsData?.reduce((sum, p) => sum + p.points_total, 0) || 0;

    // Fetch events participated
    const { count: eventsCount } = await supabase
      .from('event_participants')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    setStats({
      totalArtworks: artworksCount || 0,
      totalLikes,
      totalAttacks,
      totalPoints,
      eventsParticipated: eventsCount || 0,
    });

    setLoading(false);
  };

  const fetchEvents = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('event_participants')
      .select(`
        team,
        events:event_id (id, title),
        user_points!inner (points_total)
      `)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error fetching events:', error);
    } else if (data) {
      const eventsList = data.map(item => ({
        id: item.events?.id || '',
        title: item.events?.title || '',
        team: item.team as 'A' | 'B',
        points: 0, // Will be fetched separately if needed
      }));
      setEvents(eventsList);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <p className="text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <p className="text-muted-foreground">Profile not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-teal bg-clip-text text-transparent mb-2">
          Profile
        </h1>
        <p className="text-muted-foreground">
          Your battle statistics and achievements
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Profile Info */}
        <Card className="md:col-span-2 lg:col-span-1">
          <CardHeader>
            <CardTitle>Artist Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-teal rounded-full mx-auto mb-4 flex items-center justify-center">
                <span className="text-2xl font-bold text-white">
                  {profile.display_name.charAt(0).toUpperCase()}
                </span>
              </div>
              <h3 className="text-xl font-semibold">{profile.display_name}</h3>
              <p className="text-muted-foreground">@{profile.username}</p>
            </div>
          </CardContent>
        </Card>

        {/* Stats Overview */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Battle Statistics</CardTitle>
            <CardDescription>Your performance across all events</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-secondary rounded-lg">
                <Image className="h-8 w-8 mx-auto mb-2 text-primary" />
                <p className="text-2xl font-bold">{stats.totalArtworks}</p>
                <p className="text-sm text-muted-foreground">Artworks</p>
              </div>
              
              <div className="text-center p-4 bg-secondary rounded-lg">
                <Trophy className="h-8 w-8 mx-auto mb-2 text-primary" />
                <p className="text-2xl font-bold">{stats.totalPoints}</p>
                <p className="text-sm text-muted-foreground">Total Points</p>
              </div>
              
              <div className="text-center p-4 bg-secondary rounded-lg">
                <Calendar className="h-8 w-8 mx-auto mb-2 text-primary" />
                <p className="text-2xl font-bold">{stats.eventsParticipated}</p>
                <p className="text-sm text-muted-foreground">Events</p>
              </div>
              
              <div className="text-center p-4 bg-secondary rounded-lg">
                <Target className="h-8 w-8 mx-auto mb-2 text-primary" />
                <p className="text-2xl font-bold">{stats.totalLikes + stats.totalAttacks}</p>
                <p className="text-sm text-muted-foreground">Interactions</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Event History */}
        <Card className="md:col-span-2 lg:col-span-3">
          <CardHeader>
            <CardTitle>Event History</CardTitle>
            <CardDescription>Your participation in battle events</CardDescription>
          </CardHeader>
          <CardContent>
            {events.length > 0 ? (
              <div className="space-y-3">
                {events.map((event) => (
                  <div key={event.id} className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                    <div>
                      <h4 className="font-medium">{event.title}</h4>
                      <Badge variant={event.team === 'A' ? 'secondary' : 'outline'}>
                        Team {event.team}
                      </Badge>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-primary">{event.points} pts</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No events participated yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Join an event to start your battle journey!
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}