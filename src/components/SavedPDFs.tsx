
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Download, Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase, SavedPDF } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/context/AuthContext';

const SavedPDFs = () => {
  const [savedPDFs, setSavedPDFs] = useState<SavedPDF[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchSavedPDFs();
    }
  }, [user]);

  const fetchSavedPDFs = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Make sure we're filtering by user_id
      const { data, error } = await supabase
        .from('saved_pdfs')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });
      
      if (error) throw new Error(error.message);
      
      setSavedPDFs(data || []);
    } catch (err) {
      console.error('Error fetching saved PDFs:', err);
      setError(err instanceof Error ? err.message : 'Failed to load saved PDFs');
      
      toast({
        title: "Error loading saved PDFs",
        description: err instanceof Error ? err.message : 'An unexpected error occurred',
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadPDF = (pdf: SavedPDF) => {
    try {
      const link = document.createElement('a');
      link.href = pdf.pdf_data;
      link.download = `${pdf.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: "PDF downloaded",
        description: `${pdf.title} has been downloaded successfully`,
      });
    } catch (err) {
      console.error('Error downloading PDF:', err);
      
      toast({
        title: "Error downloading PDF",
        description: err instanceof Error ? err.message : 'Failed to download the PDF',
        variant: "destructive",
      });
    }
  };

  const handleDeletePDF = async (id: string) => {
    try {
      const { error } = await supabase
        .from('saved_pdfs')
        .delete()
        .eq('id', id);
      
      if (error) throw new Error(error.message);
      
      setSavedPDFs(savedPDFs.filter(pdf => pdf.id !== id));
      
      toast({
        title: "PDF deleted",
        description: "The PDF has been deleted successfully",
      });
    } catch (err) {
      console.error('Error deleting PDF:', err);
      
      toast({
        title: "Error deleting PDF",
        description: err instanceof Error ? err.message : 'Failed to delete the PDF',
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight">Saved PDFs</h1>
        <p className="text-muted-foreground">Access and download your saved summaries as PDFs.</p>
      </div>
      
      {error ? (
        <div className="rounded-lg border border-destructive/50 p-8 flex flex-col items-center text-center">
          <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
          <h3 className="text-xl font-medium mb-2">Error Loading PDFs</h3>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button variant="outline" onClick={fetchSavedPDFs}>
            Try Again
          </Button>
        </div>
      ) : isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="opacity-70 animate-pulse">
              <CardHeader>
                <div className="h-7 bg-muted rounded-md mb-2 w-3/4"></div>
                <div className="h-4 bg-muted rounded-md w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="h-16 bg-muted rounded-md"></div>
              </CardContent>
              <CardFooter>
                <div className="h-9 bg-muted rounded-md w-full"></div>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : savedPDFs.length === 0 ? (
        <div className="rounded-lg border border-border p-8 flex flex-col items-center text-center">
          <FileText className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-xl font-medium mb-2">No Saved PDFs</h3>
          <p className="text-muted-foreground">
            You haven't saved any summaries as PDFs yet. Go to the Notes Summarizer to create and save summaries.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {savedPDFs.map((pdf) => (
            <Card key={pdf.id}>
              <CardHeader>
                <CardTitle className="line-clamp-1">{pdf.title}</CardTitle>
                <CardDescription>
                  {new Date(pdf.created_at).toLocaleDateString()} at {new Date(pdf.created_at).toLocaleTimeString()}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center bg-muted/30 p-6 rounded-md">
                  <FileText className="h-12 w-12 text-primary/70" />
                </div>
              </CardContent>
              <CardFooter className="flex justify-between gap-2">
                <Button 
                  className="flex-1" 
                  variant="outline" 
                  onClick={() => handleDownloadPDF(pdf)}
                >
                  <Download className="mr-2 h-4 w-4" /> Download
                </Button>
                <Button 
                  size="icon" 
                  variant="destructive" 
                  onClick={() => handleDeletePDF(pdf.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default SavedPDFs;
