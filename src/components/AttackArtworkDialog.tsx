import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Sword, Upload } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface AttackArtworkDialogProps {
  isOpen: boolean;
  onClose: () => void;
  targetArtworkId: string;
  targetArtworkTitle: string;
  eventId: string;
  onAttackSuccess: () => void;
}

export default function AttackArtworkDialog({ 
  isOpen, 
  onClose, 
  targetArtworkId, 
  targetArtworkTitle, 
  eventId,
  onAttackSuccess 
}: AttackArtworkDialogProps) {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
    }
  };

  const handleAttack = async () => {
    if (!user || !title.trim() || !imageFile) {
      toast({
        title: "Missing information",
        description: "Please fill in the title and select an image",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      // Upload attack artwork image
      const fileExt = imageFile.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `fight-artworks/${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('fight-artworks')
        .upload(filePath, imageFile);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('fight-artworks')
        .getPublicUrl(filePath);

      // Create fight artwork record
      const { error: fightError } = await supabase
        .from('fight_artworks')
        .insert({
          title: title.trim(),
          image_url: publicUrl,
          target_artwork_id: targetArtworkId,
          attacker_id: user.id,
        });

      if (fightError) throw fightError;

      // Award 3 points to attacker using RPC function
      await supabase.rpc('update_user_points', {
        p_user_id: user.id,
        p_event_id: eventId,
        p_attack_points: 3
      });

      toast({
        title: "🎉 Congratulations!",
        description: `You successfully attacked "${targetArtworkTitle}" and earned 3 points!`,
      });

      setTitle('');
      setDescription('');
      setImageFile(null);
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
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sword className="h-5 w-5 text-destructive" />
            Attack "{targetArtworkTitle}"
          </DialogTitle>
          <DialogDescription>
            Create your attack artwork to challenge this piece. You'll earn 3 points for a successful attack!
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Upload className="h-4 w-4 text-destructive" />
              <span className="font-medium text-destructive">Attack Requirements</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Upload an artwork that challenges or responds to "{targetArtworkTitle}". This will be linked as an attack thread.
            </p>
          </div>

          <div>
            <Label htmlFor="attack-title">Attack Artwork Title *</Label>
            <Input
              id="attack-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Give your attack artwork a title..."
              disabled={isUploading}
            />
          </div>

          <div>
            <Label htmlFor="attack-description">Description (Optional)</Label>
            <Textarea
              id="attack-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your attack or add a battle message..."
              rows={3}
              disabled={isUploading}
            />
          </div>

          <div>
            <Label htmlFor="attack-image">Attack Artwork Image *</Label>
            <Input
              id="attack-image"
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              disabled={isUploading}
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button 
              onClick={handleAttack}
              disabled={isUploading || !title.trim() || !imageFile}
              variant="destructive"
              className="flex-1"
            >
              {isUploading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Uploading Attack...
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
              disabled={isUploading}
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}