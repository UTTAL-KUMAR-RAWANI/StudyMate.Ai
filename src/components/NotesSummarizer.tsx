import React, { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { FileText, Copy, FileUp, BrainCircuit, RefreshCw, Check, X, AlertTriangle, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { jsPDF } from 'jspdf';
import { useAuth } from '@/context/AuthContext';

const NotesSummarizer = () => {
  const [inputText, setInputText] = useState('');
  const [summaryText, setSummaryText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [summaryLength, setSummaryLength] = useState([50]); // 50% by default
  const [summaryType, setSummaryType] = useState('concise');
  const [isCopied, setIsCopied] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<{ name: string; size: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summaryTitle, setSummaryTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  
  const extractTextFromPDF = async (file: File): Promise<string> => {
    try {
      const formData = new FormData();
      formData.append('pdf', file);
      
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target?.result) {
            resolve(`Content extracted from PDF: ${file.name}\n\nThis would contain the actual text extracted from the PDF file. For this demo, we're simulating text extraction.`);
          } else {
            resolve(`Failed to extract content from ${file.name}`);
          }
        };
        reader.readAsText(file);
      });
    } catch (error) {
      console.error('Error extracting text from PDF:', error);
      throw new Error('Failed to extract text from PDF');
    }
  };
  
  const handleGenerateSummary = async () => {
    if (!inputText.trim() && !uploadedFile) {
      toast({
        title: "No content to summarize",
        description: "Please enter text or upload a PDF file.",
        variant: "destructive",
      });
      return;
    }
    
    setIsGenerating(true);
    setError(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('summarize-notes', {
        body: {
          text: inputText,
          summaryType: summaryType,
          summaryLength: summaryLength[0]
        }
      });
      
      if (error) {
        throw new Error(error.message);
      }
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      setSummaryText(data.summary);
      
      toast({
        title: "Summary generated",
        description: "Your notes have been successfully summarized.",
      });
    } catch (err) {
      console.error('Error generating summary:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate summary');
      
      toast({
        title: "Error generating summary",
        description: err instanceof Error ? err.message : 'An unexpected error occurred',
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };
  
  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(summaryText);
    setIsCopied(true);
    
    toast({
      title: "Copied to clipboard",
      description: "Summary copied to clipboard",
    });
    
    setTimeout(() => setIsCopied(false), 2000);
  };
  
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    if (file.type !== 'application/pdf') {
      toast({
        title: "Invalid file type",
        description: "Please upload a PDF file.",
        variant: "destructive",
      });
      return;
    }
    
    setUploadedFile({
      name: file.name,
      size: file.size,
    });
    
    try {
      const extractedText = await extractTextFromPDF(file);
      setInputText(extractedText);
      
      toast({
        title: "PDF uploaded",
        description: `Successfully uploaded ${file.name}`,
      });
    } catch (err) {
      console.error('Error processing PDF:', err);
      
      toast({
        title: "Error processing PDF",
        description: err instanceof Error ? err.message : 'Failed to process the PDF file',
        variant: "destructive",
      });
      
      removeUploadedFile();
    }
  };
  
  const removeUploadedFile = () => {
    setUploadedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setInputText('');
  };
  
  const handleSaveAsPDF = async () => {
    if (!summaryText) {
      toast({
        title: "No summary to save",
        description: "Please generate a summary first.",
        variant: "destructive",
      });
      return;
    }
    
    if (!summaryTitle.trim()) {
      toast({
        title: "Title required",
        description: "Please enter a title for your summary.",
        variant: "destructive",
      });
      return;
    }
    
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please log in to save PDFs.",
        variant: "destructive",
      });
      return;
    }
    
    setIsSaving(true);
    
    try {
      const doc = new jsPDF();
      
      doc.setFontSize(18);
      doc.text(summaryTitle, 20, 20);
      
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Summary Type: ${summaryType.charAt(0).toUpperCase() + summaryType.slice(1)}`, 20, 30);
      doc.text(`Summary Length: ${summaryLength[0]}%`, 20, 35);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 20, 40);
      
      const textLines = doc.splitTextToSize(summaryText, 170);
      doc.text(textLines, 20, 50);
      
      const pdfDataUrl = doc.output('datauristring');
      
      const { data, error: saveError } = await supabase
        .from('saved_pdfs')
        .insert([
          { 
            title: summaryTitle,
            pdf_data: pdfDataUrl,
            user_id: user.id
          }
        ])
        .select();
      
      if (saveError) throw new Error(saveError.message);
      
      toast({
        title: "PDF saved successfully",
        description: "Your summary has been saved as a PDF",
      });
    } catch (err) {
      console.error('Error saving PDF:', err);
      
      toast({
        title: "Error saving PDF",
        description: err instanceof Error ? err.message : 'An unexpected error occurred',
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };
  
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight">Notes Summarizer</h1>
        <p className="text-muted-foreground">Convert your lengthy notes into concise summaries powered by Gemini AI.</p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Input Text</CardTitle>
            <CardDescription>Paste your notes or upload a PDF file.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="paste">
              <TabsList className="mb-4 w-full">
                <TabsTrigger value="paste" className="flex-1">Paste Text</TabsTrigger>
                <TabsTrigger value="upload" className="flex-1">Upload PDF</TabsTrigger>
              </TabsList>
              
              <TabsContent value="paste">
                <Textarea
                  placeholder="Paste your notes or text here..."
                  className="min-h-[300px] font-mono text-sm"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                />
              </TabsContent>
              
              <TabsContent value="upload" className="flex flex-col items-center justify-center min-h-[300px]">
                {uploadedFile ? (
                  <div className="w-full flex flex-col items-center">
                    <div className="w-full flex items-center justify-between bg-muted/50 p-4 rounded-lg mb-4">
                      <div className="flex items-center space-x-3">
                        <FileText className="h-8 w-8 text-blue-500" />
                        <div>
                          <p className="font-medium">{uploadedFile.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" onClick={removeUploadedFile}>
                        <X className="h-5 w-5" />
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      PDF uploaded successfully. Click "Generate Summary" to process.
                    </p>
                  </div>
                ) : (
                  <div className="w-full max-w-sm flex flex-col items-center text-center">
                    <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                      <FileUp className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-medium mb-2">Upload PDF File</h3>
                    <p className="text-muted-foreground mb-4">
                      Upload a PDF file to summarize its contents.
                    </p>
                    <label className="w-full">
                      <div className="w-full flex items-center justify-center px-6 py-4 border border-dashed border-muted-foreground/25 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                        <span className="text-sm text-muted-foreground">Choose file or drag & drop</span>
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,application/pdf"
                        className="hidden"
                        onChange={handleFileUpload}
                      />
                    </label>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
          <CardFooter className="flex-col gap-4">
            <div className="w-full space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>Summary Length</Label>
                  <span className="text-sm text-muted-foreground">{summaryLength[0]}%</span>
                </div>
                <Slider
                  value={summaryLength}
                  onValueChange={setSummaryLength}
                  min={10}
                  max={90}
                  step={10}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Summary Type</Label>
                <Select
                  value={summaryType}
                  onValueChange={setSummaryType}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select summary type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="concise">Concise</SelectItem>
                    <SelectItem value="detailed">Detailed</SelectItem>
                    <SelectItem value="bullet">Bullet Points</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <Button 
              className="w-full"
              onClick={handleGenerateSummary}
              disabled={isGenerating || (!inputText.trim() && !uploadedFile)}
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Generating...
                </>
              ) : (
                <>
                  <BrainCircuit className="mr-2 h-4 w-4" /> Generate Summary
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
        
        <Card>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle>Summary</CardTitle>
                <CardDescription>AI-generated summary of your notes.</CardDescription>
              </div>
              <div className="flex space-x-2">
                {summaryText && (
                  <>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={handleCopyToClipboard}
                    >
                      {isCopied ? (
                        <>
                          <Check className="mr-2 h-4 w-4" /> Copied
                        </>
                      ) : (
                        <>
                          <Copy className="mr-2 h-4 w-4" /> Copy
                        </>
                      )}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {error ? (
              <div className="min-h-[300px] p-4 rounded-md bg-red-50 flex flex-col items-center justify-center text-center">
                <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
                <h3 className="text-lg font-medium mb-2 text-red-700">Error</h3>
                <p className="text-red-600 max-w-xs">{error}</p>
              </div>
            ) : summaryText ? (
              <div className="min-h-[300px] p-4 rounded-md bg-muted/30 whitespace-pre-line">
                {summaryText}
              </div>
            ) : (
              <div className="min-h-[300px] flex flex-col items-center justify-center text-center">
                <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium mb-2">No Summary Yet</h3>
                <p className="text-muted-foreground max-w-xs">
                  Enter your text and click "Generate Summary" to see the results here.
                </p>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            {summaryText && (
              <div className="w-full space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="summary-title">Title</Label>
                  <Input
                    id="summary-title"
                    placeholder="Enter a title for your summary"
                    value={summaryTitle}
                    onChange={(e) => setSummaryTitle(e.target.value)}
                  />
                </div>
                
                <Button 
                  onClick={handleSaveAsPDF} 
                  className="w-full" 
                  disabled={isSaving || !summaryText || !summaryTitle.trim()}
                >
                  {isSaving ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" /> Save as PDF
                    </>
                  )}
                </Button>
              </div>
            )}
            
            <div className="w-full text-sm text-muted-foreground">
              <p> Adjust the summary length and type to get different results.</p>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default NotesSummarizer;
