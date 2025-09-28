import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Upload } from 'lucide-react';
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
      // Validate file type
      const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        toast({
          title: "Invalid file type",
          description: "Please upload a JPG, PNG, or WebP image",
          variant: "destructive",
        });
        return;
      }

      // Validate file size (5MB max)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        toast({
          title: "File too large",
          description: "Please upload an image smaller than 5MB",
          variant: "destructive",
        });
        return;
      }

      setImageFile(file);
      const reader = new FileReader();
      reader.onload = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadArtwork = async () => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to upload artwork",
        variant: "destructive",
      });
      return;
    }

    if (!imageFile || !title.trim()) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields and select an image",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      // Verify the user has a profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('user_id', user.id)
        .single();

      if (profileError) {
        console.error('Profile check error:', profileError);
        throw new Error('Error verifying your account. Please try signing out and back in.');
      }

      // Create a unique file path
      const fileExt = imageFile.name.split('.').pop()?.toLowerCase() || 'png';
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
      const filePath = `artworks/${user.id}/${fileName}`;

      // Upload the file to storage
      const { error: uploadError } = await supabase.storage
        .from('artworks')
        .upload(filePath, imageFile, {
          cacheControl: '3600',
          upsert: false,
          contentType: imageFile.type
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw new Error(uploadError.message || 'Failed to upload image');
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('artworks')
        .getPublicUrl(filePath);

      // Create artwork record in database
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
        console.error('Insert error:', insertError);
        // Clean up the uploaded file if the database insert fails
        await supabase.storage.from('artworks').remove([filePath]);
        throw new Error(insertError.message || 'Failed to save artwork details');
      }

      // Update user points for artwork upload (5 points)
      try {
        await supabase.rpc('update_user_points', {
          p_user_id: user.id,
          p_event_id: eventId,
          p_artwork_points: 5
        });
      } catch (pointsError) {
        console.warn('Points update warning:', pointsError);
        // Don't fail the upload if points update fails
      }

      toast({
        title: "Artwork uploaded successfully!",
        description: "Your artwork has been submitted and is now visible in the gallery.",
      });

      // Reset form
      setTitle('');
      setDescription('');
      setImageFile(null);
      setImagePreview(null);
      setIsOpen(false);
      onArtworkUploaded();

    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: "Upload failed",
        description: error.message || 'An error occurred while uploading your artwork',
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
              disabled={uploading}
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
              disabled={uploading}
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
              disabled={uploading}
              className="cursor-pointer"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Accepted formats: JPG, PNG, WebP (max 5MB)
            </p>
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
                    className="w-full h-full object-contain"
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
              {uploading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Uploading...
                </>
              ) : (
                'Submit Artwork'
              )}
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