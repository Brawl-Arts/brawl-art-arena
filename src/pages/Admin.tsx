import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Calendar, Clock, Edit, Trash2, Plus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

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

export default function Admin() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const { toast } = useToast();
  const { user, signIn } = useAuth();

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await signIn(email, password);
    
    if (error) {
      toast({ title: "Invalid credentials", variant: "destructive" });
    } else {
      setIsAuthenticated(true);
      toast({ title: "Admin access granted" });
    }
  };

  const fetchEvents = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      toast({ title: "Error fetching events", variant: "destructive" });
    } else {
      setEvents(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (user) {
      setIsAuthenticated(true);
      fetchEvents();
    }
  }, [user]);

  const createEvent = async (formData: FormData) => {
    const startTime = formData.get('start_time') as string;
    const endTime = formData.get('end_time') as string;
    const midwayTime = formData.get('midway_time') as string;
    
    const eventData = {
      title: formData.get('title') as string,
      description: formData.get('description') as string,
      theme: formData.get('theme') as string,
      midway_theme: formData.get('midway_theme') as string || null,
      start_time: startTime ? new Date(startTime).toISOString() : null,
      end_time: endTime ? new Date(endTime).toISOString() : null,
      midway_time: midwayTime ? new Date(midwayTime).toISOString() : null,
      team_a_name: formData.get('team_a_name') as string,
      team_a_pfp: formData.get('team_a_pfp') as string || null,
      team_b_name: formData.get('team_b_name') as string,
      team_b_pfp: formData.get('team_b_pfp') as string || null,
      status: 'upcoming'
    };

    const { error } = await supabase.from('events').insert([eventData]);
    
    if (error) {
      toast({ title: "Error creating event", variant: "destructive" });
    } else {
      toast({ title: "Event created successfully" });
      setIsCreateDialogOpen(false);
      fetchEvents();
    }
  };

  const updateEventTheme = async (eventId: string, newTheme: string, newDescription: string) => {
    const { error } = await supabase
      .from('events')
      .update({ 
        midway_theme: newTheme,
        description: newDescription 
      })
      .eq('id', eventId);
    
    if (error) {
      toast({ title: "Error updating theme", variant: "destructive" });
    } else {
      toast({ title: "Theme updated successfully" });
      fetchEvents();
    }
  };

  const deleteEvent = async (eventId: string) => {
    if (!confirm('Are you sure you want to delete this event? This action cannot be undone.')) {
      return;
    }

    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', eventId);
    
    if (error) {
      toast({ title: "Error deleting event", variant: "destructive" });
    } else {
      toast({ title: "Event deleted successfully" });
      fetchEvents();
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-background">
        <Card className="w-full max-w-md mx-4">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-primary">Admin Access</CardTitle>
            <CardDescription>Sign in with admin credentials to access admin panel</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full">
                Sign In to Admin Panel
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-background">
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Admin Panel</h1>
            <p className="text-muted-foreground">Manage Brawl Arts events</p>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Create Event
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Event</DialogTitle>
                <DialogDescription>Fill in the details for the new event</DialogDescription>
              </DialogHeader>
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.target as HTMLFormElement);
                createEvent(formData);
              }} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label htmlFor="title">Event Title</Label>
                    <Input id="title" name="title" required />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea id="description" name="description" required />
                  </div>
                  <div>
                    <Label htmlFor="theme">Initial Theme</Label>
                    <Input id="theme" name="theme" required />
                  </div>
                  <div>
                    <Label htmlFor="midway_theme">Midway Theme (Optional)</Label>
                    <Input id="midway_theme" name="midway_theme" />
                  </div>
                  <div>
                    <Label htmlFor="start_time">Start Time</Label>
                    <Input id="start_time" name="start_time" type="datetime-local" required />
                  </div>
                  <div>
                    <Label htmlFor="end_time">End Time</Label>
                    <Input id="end_time" name="end_time" type="datetime-local" required />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="midway_time">Midway Theme Change Time (Optional)</Label>
                    <Input id="midway_time" name="midway_time" type="datetime-local" />
                  </div>
                  <div>
                    <Label htmlFor="team_a_name">Team A Name</Label>
                    <Input id="team_a_name" name="team_a_name" required />
                  </div>
                  <div>
                    <Label htmlFor="team_a_pfp">Team A Profile Picture URL</Label>
                    <Input id="team_a_pfp" name="team_a_pfp" type="url" />
                  </div>
                  <div>
                    <Label htmlFor="team_b_name">Team B Name</Label>
                    <Input id="team_b_name" name="team_b_name" required />
                  </div>
                  <div>
                    <Label htmlFor="team_b_pfp">Team B Profile Picture URL</Label>
                    <Input id="team_b_pfp" name="team_b_pfp" type="url" />
                  </div>
                </div>
                <Button type="submit" className="w-full">Create Event</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-6">
          {loading ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Loading events...</p>
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No events found</p>
            </div>
          ) : (
            events.map((event) => (
              <Card key={event.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {event.title}
                        <Badge variant={event.status === 'upcoming' ? 'default' : event.status === 'ongoing' ? 'destructive' : 'secondary'}>
                          {event.status}
                        </Badge>
                      </CardTitle>
                      <CardDescription>{event.description}</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      {event.status === 'ongoing' && (
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Edit className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Update Midway Theme</DialogTitle>
                              <DialogDescription>Change the theme for ongoing event</DialogDescription>
                            </DialogHeader>
                            <form onSubmit={(e) => {
                              e.preventDefault();
                              const formData = new FormData(e.target as HTMLFormElement);
                              updateEventTheme(
                                event.id,
                                formData.get('new_theme') as string,
                                formData.get('new_description') as string
                              );
                            }} className="space-y-4">
                              <div>
                                <Label htmlFor="new_theme">New Theme</Label>
                                <Input id="new_theme" name="new_theme" defaultValue={event.midway_theme || ''} required />
                              </div>
                              <div>
                                <Label htmlFor="new_description">Updated Description</Label>
                                <Textarea id="new_description" name="new_description" defaultValue={event.description} required />
                              </div>
                              <Button type="submit" className="w-full">Update Theme</Button>
                            </form>
                          </DialogContent>
                        </Dialog>
                      )}
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={() => deleteEvent(event.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
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
                          <Edit className="h-4 w-4 text-primary" />
                          <span className="font-medium">Midway:</span>
                          <span>{new Date(event.midway_time).toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <div>
                        <span className="font-medium text-sm">Theme:</span>
                        <span className="ml-2 text-sm">{event.theme}</span>
                      </div>
                      {event.midway_theme && (
                        <div>
                          <span className="font-medium text-sm">Midway Theme:</span>
                          <span className="ml-2 text-sm">{event.midway_theme}</span>
                        </div>
                      )}
                      <div className="flex gap-4 pt-2">
                        <div>
                          <span className="font-medium text-sm">Team A:</span>
                          <span className="ml-2 text-sm">{event.team_a_name}</span>
                        </div>
                        <div>
                          <span className="font-medium text-sm">Team B:</span>
                          <span className="ml-2 text-sm">{event.team_b_name}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}