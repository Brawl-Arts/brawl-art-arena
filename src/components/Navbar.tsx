import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { Home, Calendar, Image, User, LogOut } from 'lucide-react';
import ghostMascot from '@/assets/teal-ghost-mascot.png';

export function Navbar() {
  const { user, signOut } = useAuth();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <nav className="bg-card border-b border-border sticky top-0 z-50 backdrop-blur-md bg-card/95">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center space-x-3 hover:opacity-80 transition-opacity">
            <img src={ghostMascot} alt="Brawl Arts Ghost" className="h-10 w-10" />
            <span className="font-bold text-xl bg-gradient-teal bg-clip-text text-transparent">
              Brawl Arts
            </span>
          </Link>

          {user && (
            <div className="flex items-center space-x-6">
              <Link
                to="/"
                className={`flex items-center space-x-2 px-3 py-2 rounded-md transition-colors ${
                  isActive('/') 
                    ? 'bg-primary text-primary-foreground' 
                    : 'hover:bg-accent hover:text-accent-foreground'
                }`}
              >
                <Home className="h-4 w-4" />
                <span>Home</span>
              </Link>
              
              <Link
                to="/events"
                className={`flex items-center space-x-2 px-3 py-2 rounded-md transition-colors ${
                  isActive('/events') 
                    ? 'bg-primary text-primary-foreground' 
                    : 'hover:bg-accent hover:text-accent-foreground'
                }`}
              >
                <Calendar className="h-4 w-4" />
                <span>Events</span>
              </Link>
              
              <Link
                to="/gallery"
                className={`flex items-center space-x-2 px-3 py-2 rounded-md transition-colors ${
                  isActive('/gallery') 
                    ? 'bg-primary text-primary-foreground' 
                    : 'hover:bg-accent hover:text-accent-foreground'
                }`}
              >
                <Image className="h-4 w-4" />
                <span>Gallery</span>
              </Link>
              
              <Link
                to="/profile"
                className={`flex items-center space-x-2 px-3 py-2 rounded-md transition-colors ${
                  isActive('/profile') 
                    ? 'bg-primary text-primary-foreground' 
                    : 'hover:bg-accent hover:text-accent-foreground'
                }`}
              >
                <User className="h-4 w-4" />
                <span>Profile</span>
              </Link>

              <Button
                onClick={handleSignOut}
                variant="ghost"
                size="sm"
                className="flex items-center space-x-2"
              >
                <LogOut className="h-4 w-4" />
                <span>Sign Out</span>
              </Button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}