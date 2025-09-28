import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Sword, Zap } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface AttackDialogProps {
  isOpen: boolean;
  onClose: () => void;
  artworkId: string;
  artworkTitle: string;
  eventId: string;
  onAttackSuccess: () => void;
}

export default function AttackDialog({ 
  isOpen, 
  onClose, 
  artworkId, 
  artworkTitle, 
  eventId,
  onAttackSuccess 
}: AttackDialogProps) {
  const { user } = useAuth();
  const [description, setDescription] = useState('');
  const [isAttacking, setIsAttacking] = useState(false);

  const handleAttack = async () => {
    if (!user) return;

    setIsAttacking(true);

    try {
      // Add attack interaction
      const { error: interactionError } = await supabase
        .from('artwork_interactions')
        .insert({
          artwork_id: artworkId,
          user_id: user.id,
          interaction_type: 'attack',
        });

      if (interactionError) throw interactionError;

      // Award 3 points to attacker
      await supabase.rpc('update_user_points', {
        p_user_id: user.id,
        p_event_id: eventId,
        p_attack_points: 3
      });

      toast({
        title: "Attack successful!",
        description: `You attacked "${artworkTitle}" and earned 3 points!`,
      });

      setDescription('');
      onClose();
      onAttackSuccess();
    } catch (error) {
      console.error('Error attacking artwork:', error);
      toast({
        title: "Attack failed",
        description: "Failed to attack this artwork. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAttacking(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sword className="h-5 w-5 text-destructive" />
            Attack Artwork
          </DialogTitle>
          <DialogDescription>
            You're about to attack "{artworkTitle}"
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-4 w-4 text-destructive" />
              <span className="font-medium text-destructive">Battle Action</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Attacking will earn you 3 points and show your attack in the gallery thread.
            </p>
          </div>

          <div>
            <Label htmlFor="attack-description">Attack Message (Optional)</Label>
            <Textarea
              id="attack-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a battle message (optional)..."
              rows={3}
              disabled={isAttacking}
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button 
              onClick={handleAttack}
              disabled={isAttacking}
              variant="destructive"
              className="flex-1"
            >
              {isAttacking ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Attacking...
                </>
              ) : (
                <>
                  <Sword className="h-4 w-4 mr-2" />
                  Launch Attack (+3 pts)
                </>
              )}
            </Button>
            <Button 
              variant="outline" 
              onClick={onClose}
              disabled={isAttacking}
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}