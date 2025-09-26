import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Upload, Image as ImageIcon } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface ArtworkUploadProps {
  eventId: string;
  eventTitle: string;
  currentTheme: string;
  onArtworkUploaded: () => void;
}

export default function ArtworkUpload({ eventId, eventTitle, currentTheme, onArtworkUploaded }: ArtworkUploadProps) {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
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

  const uploadArtwork = async () => {
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
      const filePath = `artworks/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('artworks')
        .upload(filePath, imageFile);

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('artworks')
        .getPublicUrl(filePath);

      // Create artwork record
      const { error: insertError } = await supabase
        .from('artworks')
        .insert({
          title: title.trim(),
          description: description.trim() || null,
          image_url: publicUrl,
          event_id: eventId,
          user_id: user.id,
        });

      if (insertError) {
        throw insertError;
      }

      // Update user points for artwork upload (+3 points)
      const { error: pointsError } = await supabase
        .from('user_points')
        .upsert({
          user_id: user.id,
          event_id: eventId,
          artwork_points: 3,
          points_total: 3
        }, {
          onConflict: 'user_id,event_id'
        });

      if (pointsError) {
        console.error('Error updating points:', pointsError);
      }

      toast({
        title: "Artwork uploaded successfully!",
        description: "You earned 3 points for uploading artwork",
      });

      // Reset form
      setTitle('');
      setDescription('');
      setImageFile(null);
      setImagePreview(null);
      setIsOpen(false);
      onArtworkUploaded();

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
        <Button className="w-full shadow-glow hover:shadow-teal transition-all duration-300">
          <Upload className="h-4 w-4 mr-2" />
          Submit Artwork
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Submit Artwork</DialogTitle>
          <DialogDescription>
            Upload your artwork for "{eventTitle}" - Theme: {currentTheme}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="artwork-title">Title *</Label>
            <Input
              id="artwork-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter artwork title"
              required
            />
          </div>

          <div>
            <Label htmlFor="artwork-description">Description</Label>
            <Textarea
              id="artwork-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your artwork (optional)"
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="artwork-image">Artwork Image *</Label>
            <Input
              id="artwork-image"
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
                    alt="Artwork preview"
                    className="w-full h-full object-cover"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex gap-2 pt-4">
            <Button 
              onClick={uploadArtwork} 
              disabled={uploading || !imageFile || !title.trim()}
              className="flex-1"
            >
              {uploading ? 'Uploading...' : 'Submit Artwork (+3 points)'}
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