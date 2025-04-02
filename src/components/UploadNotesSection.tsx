
import React, { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { FileText, Loader2, Upload, X } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Input } from '@/components/ui/input';
import { UploadedFile } from './flashcard/types';
import { supabase } from '@/integrations/supabase/client';

interface UploadNotesSectionProps {
  onFlashcardsGenerated: (flashcards: {front: string; back: string}[]) => void;
}

const UploadNotesSection: React.FC<UploadNotesSectionProps> = ({ onFlashcardsGenerated }) => {
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [subject, setSubject] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check if the file is a PDF
    if (file.type !== 'application/pdf') {
      toast({
        title: "Invalid file type",
        description: "Please upload a PDF file",
        variant: "destructive",
      });
      return;
    }

    // Store the uploaded file information
    setUploadedFile({
      name: file.name,
      size: file.size,
      type: file.type,
    });

    // In a real implementation, you would extract text from the PDF
    // For now, we'll just simulate it by setting the file name in the notes
    setNotes(`Content from uploaded PDF: ${file.name}`);

    toast({
      title: "File uploaded",
      description: `Successfully uploaded ${file.name}`,
    });
  };

  const removeUploadedFile = () => {
    setUploadedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setNotes('');
  };

  const handleGenerateFlashcards = async () => {
    if (!notes.trim() && !uploadedFile) {
      toast({
        title: "Notes required",
        description: "Please enter your notes or upload a PDF to generate flashcards.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Call Supabase edge function to generate flashcards
      const { data, error } = await supabase.functions.invoke('generate-flashcards', {
        body: {
          text: notes,
          subject: subject || 'General',
          count: 10
        }
      });
      
      if (error) {
        throw new Error(error.message);
      }
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      if (!data.flashcards || !Array.isArray(data.flashcards)) {
        throw new Error('Invalid response format from AI');
      }
      
      // Pass the generated flashcards back to the parent component
      onFlashcardsGenerated(data.flashcards);
      
      toast({
        title: "Flashcards generated",
        description: `Successfully created ${data.flashcards.length} flashcards from your ${uploadedFile ? 'PDF' : 'notes'}.`,
      });
    } catch (error) {
      toast({
        title: "Generation failed",
        description: error instanceof Error ? error.message : "Failed to generate flashcards. Please try again.",
        variant: "destructive",
      });
      console.error("Error generating flashcards:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Upload Notes
        </CardTitle>
        <CardDescription>
          Paste your study notes or upload a PDF file to generate flashcards automatically
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
          {uploadedFile ? (
            <div className="flex items-center justify-between bg-muted p-3 rounded-md">
              <div className="flex items-center space-x-3">
                <FileText className="h-6 w-6 text-blue-500" />
                <div className="text-left">
                  <p className="text-sm font-medium">{uploadedFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(uploadedFile.size / 1024).toFixed(2)} KB
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={removeUploadedFile}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <>
              <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground mb-2">Drag and drop your PDF file, or click to browse</p>
              <Input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={handleFileUpload}
                id="pdf-upload"
              />
              <Button 
                variant="outline" 
                onClick={() => fileInputRef.current?.click()}
              >
                Choose PDF
              </Button>
            </>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="subject">Subject (Optional)</Label>
          <Input
            id="subject"
            placeholder="e.g., Biology, Mathematics, History"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Or Enter Your Notes Manually</Label>
          <Textarea
            id="notes"
            placeholder="Paste your notes here..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={8}
            className="min-h-[200px]"
          />
        </div>
        <Button 
          onClick={handleGenerateFlashcards} 
          disabled={isLoading || (!notes.trim() && !uploadedFile)} 
          className="w-full"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating Flashcards...
            </>
          ) : (
            "Generate Flashcards"
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

export default UploadNotesSection;
