import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Sword, Image as ImageIcon } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface FightUploadProps {
  targetArtworkId: string;
  targetArtworkTitle: string;
  onFightUploaded: () => void;
}

export default function FightUpload({ targetArtworkId, targetArtworkTitle, onFightUploaded }: FightUploadProps) {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadFightArtwork = async () => {
    if (!user || !imageFile || !title.trim()) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields and select an image",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      // Upload image to Supabase storage
      const fileExt = imageFile.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `fight-artworks/${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('fight-artworks')
        .upload(filePath, imageFile);

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('fight-artworks')
        .getPublicUrl(filePath);

      // Create fight artwork record
      const { error: insertError } = await supabase
        .from('fight_artworks')
        .insert({
          title: title.trim(),
          image_url: publicUrl,
          target_artwork_id: targetArtworkId,
          attacker_id: user.id,
        });

      if (insertError) {
        throw insertError;
      }

      toast({
        title: "Fight artwork uploaded!",
        description: "You earned 2 points for uploading a fight artwork",
      });

      // Reset form
      setTitle('');
      setImageFile(null);
      setImagePreview(null);
      setIsOpen(false);
      onFightUploaded();

    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm"
          className="flex items-center gap-1 hover:text-primary border-primary/20 hover:border-primary"
        >
          <Sword className="h-4 w-4" />
          Fight
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Fight Back!</DialogTitle>
          <DialogDescription>
            Upload your counter artwork to fight against "{targetArtworkTitle}"
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="fight-title">Fight Title *</Label>
            <Input
              id="fight-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter your fight artwork title"
              required
            />
          </div>

          <div>
            <Label htmlFor="fight-image">Fight Artwork Image *</Label>
            <Input
              id="fight-image"
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              required
            />
          </div>

          {imagePreview && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="aspect-square w-full max-w-sm mx-auto relative overflow-hidden rounded-lg">
                  <img
                    src={imagePreview}
                    alt="Fight artwork preview"
                    className="w-full h-full object-cover"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex gap-2 pt-4">
            <Button 
              onClick={uploadFightArtwork} 
              disabled={uploading || !imageFile || !title.trim()}
              className="flex-1"
            >
              {uploading ? 'Uploading...' : 'Upload Fight (+2 points)'}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setIsOpen(false)}
              disabled={uploading}
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}