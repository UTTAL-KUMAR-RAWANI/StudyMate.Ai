
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { BrainCircuit, Search, ThumbsUp, MessageCircle, Filter, RefreshCw, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { format } from 'date-fns'; // Import format from date-fns

interface Message {
  id: string;
  content: string;
  sender: string; // Changed from 'user' | 'ai' to string to match database
  timestamp: Date;
}

interface Doubt {
  id: string;
  question: string;
  timestamp: Date;
  solved: boolean;
  subject: string;
  messages: Message[];
}

const DoubtSolver = () => {
  const [doubts, setDoubts] = useState<Doubt[]>([]);
  const [selectedDoubt, setSelectedDoubt] = useState<Doubt | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [newQuestion, setNewQuestion] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();
  
  useEffect(() => {
    const fetchDoubts = async () => {
      if (!user) return;
      
      try {
        setLoading(true);
        
        const { data: doubtsData, error: doubtsError } = await supabase
          .from('doubts')
          .select('*')
          .eq('user_id', user.id)
          .order('timestamp', { ascending: false });
        
        if (doubtsError) throw doubtsError;
        
        const doubtsWithMessages: Doubt[] = [];
        
        for (const doubt of doubtsData || []) {
          const { data: messagesData, error: messagesError } = await supabase
            .from('doubt_messages')
            .select('*')
            .eq('doubt_id', doubt.id)
            .order('timestamp', { ascending: true });
          
          if (messagesError) throw messagesError;
          
          doubtsWithMessages.push({
            id: doubt.id,
            question: doubt.question,
            timestamp: new Date(doubt.timestamp),
            solved: doubt.solved,
            subject: doubt.subject,
            messages: messagesData?.map(message => ({
              id: message.id,
              content: message.content,
              sender: message.sender,
              timestamp: new Date(message.timestamp),
            })) || [],
          });
        }
        
        setDoubts(doubtsWithMessages);
        
        if (doubtsWithMessages.length > 0 && !selectedDoubt) {
          setSelectedDoubt(doubtsWithMessages[0]);
        }
      } catch (error: any) {
        console.error('Error fetching doubts:', error);
        toast({
          title: 'Error loading doubts',
          description: error.message,
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchDoubts();
  }, [user, toast]);
  
  const filteredDoubts = doubts.filter(doubt => 
    doubt.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doubt.subject.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const handleSubmitQuestion = async () => {
    if (!newQuestion.trim() || !user) return;
    
    try {
      const { data: doubtData, error: doubtError } = await supabase
        .from('doubts')
        .insert({
          question: newQuestion,
          user_id: user.id,
          subject: 'General',
        })
        .select('*')
        .single();
      
      if (doubtError) throw doubtError;
      
      const { data: messageData, error: messageError } = await supabase
        .from('doubt_messages')
        .insert({
          doubt_id: doubtData.id,
          content: newQuestion,
          sender: 'user',
        })
        .select('*')
        .single();
      
      if (messageError) throw messageError;
      
      const newDoubt: Doubt = {
        id: doubtData.id,
        question: doubtData.question,
        timestamp: new Date(doubtData.timestamp),
        solved: doubtData.solved,
        subject: doubtData.subject,
        messages: [{
          id: messageData.id,
          content: messageData.content,
          sender: messageData.sender,
          timestamp: new Date(messageData.timestamp),
        }],
      };
      
      setDoubts([newDoubt, ...doubts]);
      setSelectedDoubt(newDoubt);
      setNewQuestion('');
      setIsGenerating(true);
      
      const { data, error } = await supabase.functions.invoke('doubt-solver', {
        body: {
          question: newQuestion
        }
      });
      
      if (error) throw new Error(error.message);
      
      if (data && data.error) throw new Error(data.error);
      
      const { data: aiMessageData, error: aiMessageError } = await supabase
        .from('doubt_messages')
        .insert({
          doubt_id: doubtData.id,
          content: data.answer,
          sender: 'ai',
        })
        .select('*')
        .single();
      
      if (aiMessageError) throw aiMessageError;
      
      const updatedDoubt = {
        ...newDoubt,
        messages: [
          ...newDoubt.messages,
          {
            id: aiMessageData.id,
            content: aiMessageData.content,
            sender: aiMessageData.sender,
            timestamp: new Date(aiMessageData.timestamp),
          }
        ],
      };
      
      setDoubts(doubts.map(d => d.id === updatedDoubt.id ? updatedDoubt : d));
      setSelectedDoubt(updatedDoubt);
      
      // Broadcast update for dashboard
      const channel = supabase.channel('dashboard-updates');
      channel.send({
        type: 'broadcast',
        event: 'doubt-created',
        payload: { 
          doubt: {
            id: newDoubt.id,
            question: newDoubt.question,
            answered: false,
            datetime: format(new Date(), 'PPp')
          }
        }
      });
      
      toast({
        title: "Answer generated",
        description: "AI has answered your question.",
      });
    } catch (err: any) {
      console.error('Error generating answer:', err);
      
      if (selectedDoubt) {
        const errorMessage = "I'm sorry, I encountered an error while processing your question. Please try again or rephrase your question.";
        
        const { data: errorMessageData, error: errorMessageError } = await supabase
          .from('doubt_messages')
          .insert({
            doubt_id: selectedDoubt.id,
            content: errorMessage,
            sender: 'ai',
          })
          .select('*')
          .single();
        
        if (errorMessageError) throw errorMessageError;
        
        const updatedDoubt = {
          ...selectedDoubt,
          messages: [
            ...selectedDoubt.messages,
            {
              id: errorMessageData.id,
              content: errorMessageData.content,
              sender: errorMessageData.sender,
              timestamp: new Date(errorMessageData.timestamp),
            }
          ],
        };
        
        setDoubts(doubts.map(d => d.id === updatedDoubt.id ? updatedDoubt : d));
        setSelectedDoubt(updatedDoubt);
      }
      
      toast({
        title: "Error generating answer",
        description: err.message || "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };
  
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedDoubt || !user) return;
    
    try {
      const { data: messageData, error: messageError } = await supabase
        .from('doubt_messages')
        .insert({
          doubt_id: selectedDoubt.id,
          content: newMessage,
          sender: 'user',
        })
        .select('*')
        .single();
      
      if (messageError) throw messageError;
      
      const userMessage = {
        id: messageData.id,
        content: messageData.content,
        sender: messageData.sender,
        timestamp: new Date(messageData.timestamp),
      };
      
      const updatedDoubt = {
        ...selectedDoubt,
        messages: [...selectedDoubt.messages, userMessage],
      };
      
      setDoubts(doubts.map(d => d.id === updatedDoubt.id ? updatedDoubt : d));
      setSelectedDoubt(updatedDoubt);
      setNewMessage('');
      setIsGenerating(true);
      
      const previousMessages = updatedDoubt.messages
        .map(m => `${m.sender.toUpperCase()}: ${m.content}`)
        .join('\n\n');
      
      const { data, error } = await supabase.functions.invoke('doubt-solver', {
        body: {
          question: newMessage,
          context: `This is a follow-up question. Previous conversation:\n${previousMessages}`
        }
      });
      
      if (error) throw new Error(error.message);
      
      if (data.error) throw new Error(data.error);
      
      const { data: aiMessageData, error: aiMessageError } = await supabase
        .from('doubt_messages')
        .insert({
          doubt_id: selectedDoubt.id,
          content: data.answer,
          sender: 'ai',
        })
        .select('*')
        .single();
      
      if (aiMessageError) throw aiMessageError;
      
      const aiMessage = {
        id: aiMessageData.id,
        content: aiMessageData.content,
        sender: aiMessageData.sender,
        timestamp: new Date(aiMessageData.timestamp),
      };
      
      const finalDoubt = {
        ...updatedDoubt,
        messages: [...updatedDoubt.messages, aiMessage],
      };
      
      setDoubts(doubts.map(d => d.id === finalDoubt.id ? finalDoubt : d));
      setSelectedDoubt(finalDoubt);
    } catch (err: any) {
      console.error('Error generating answer:', err);
      
      if (selectedDoubt) {
        const errorMessage = "I'm sorry, I encountered an error while processing your question. Please try again or rephrase your question.";
        
        const { data: errorMessageData, error: errorMessageError } = await supabase
          .from('doubt_messages')
          .insert({
            doubt_id: selectedDoubt.id,
            content: errorMessage,
            sender: 'ai',
          })
          .select('*')
          .single();
        
        if (errorMessageError) throw errorMessageError;
        
        const updatedDoubt = {
          ...selectedDoubt,
          messages: [
            ...selectedDoubt.messages,
            {
              id: errorMessageData.id,
              content: errorMessageData.content,
              sender: errorMessageData.sender,
              timestamp: new Date(errorMessageData.timestamp),
            }
          ],
        };
        
        setDoubts(doubts.map(d => d.id === updatedDoubt.id ? updatedDoubt : d));
        setSelectedDoubt(updatedDoubt);
      }
      
      toast({
        title: "Error generating answer",
        description: err.message || "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };
  
  const markAsSolved = async (id: string) => {
    try {
      const { error } = await supabase
        .from('doubts')
        .update({ solved: true })
        .eq('id', id);
      
      if (error) throw error;
      
      const updatedDoubts = doubts.map(doubt => 
        doubt.id === id ? { ...doubt, solved: true } : doubt
      );
      
      setDoubts(updatedDoubts);
      
      if (selectedDoubt && selectedDoubt.id === id) {
        setSelectedDoubt({ ...selectedDoubt, solved: true });
      }
      
      // Broadcast update for dashboard
      const channel = supabase.channel('dashboard-updates');
      channel.send({
        type: 'broadcast',
        event: 'doubt-updated',
        payload: { 
          doubtId: id,
          solved: true
        }
      });
      
      toast({
        title: "Doubt marked as solved",
        description: "This question has been marked as solved.",
      });
    } catch (error: any) {
      console.error('Error marking doubt as solved:', error);
      toast({
        title: "Error updating doubt",
        description: error.message,
        variant: "destructive",
      });
    }
  };
  
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight">Doubt Solver</h1>
        <p className="text-muted-foreground">Get answers to your study questions with AI assistance.</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Ask a Question</CardTitle>
              <CardDescription>Our AI will help you find the answers.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                <Input
                  placeholder="Type your study question here..."
                  value={newQuestion}
                  onChange={(e) => setNewQuestion(e.target.value)}
                  className="w-full"
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                onClick={handleSubmitQuestion} 
                disabled={!newQuestion.trim() || isGenerating || loading}
                className="w-full"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Generating...
                  </>
                ) : (
                  <>
                    <BrainCircuit className="mr-2 h-4 w-4" /> Ask Question
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Your Questions</CardTitle>
              <CardDescription>Browse your previous questions.</CardDescription>
              <div className="relative mt-2">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search questions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Tabs defaultValue="all">
                <div className="px-6 pb-2">
                  <TabsList className="w-full">
                    <TabsTrigger value="all" className="flex-1">All</TabsTrigger>
                    <TabsTrigger value="solved" className="flex-1">Solved</TabsTrigger>
                    <TabsTrigger value="unsolved" className="flex-1">Unsolved</TabsTrigger>
                  </TabsList>
                </div>
                
                <TabsContent value="all" className="m-0">
                  <div className="divide-y">
                    {loading ? (
                      <div className="py-6 text-center">
                        <Loader2 className="h-8 w-8 mx-auto animate-spin mb-2 text-primary/70" />
                        <p className="text-muted-foreground">Loading your questions...</p>
                      </div>
                    ) : filteredDoubts.length === 0 ? (
                      <div className="py-6 text-center text-muted-foreground">
                        No questions found. Try a different search or ask a new question.
                      </div>
                    ) : (
                      filteredDoubts.map((doubt) => (
                        <div
                          key={doubt.id}
                          className={cn(
                            "px-6 py-3 cursor-pointer hover:bg-muted/50 transition-colors",
                            selectedDoubt?.id === doubt.id && "bg-muted/80"
                          )}
                          onClick={() => setSelectedDoubt(doubt)}
                        >
                          <div className="flex items-start gap-3">
                            <div className={cn(
                              "w-2 h-2 mt-2 rounded-full",
                              doubt.solved ? "bg-green-500" : "bg-amber-500"
                            )} />
                            <div className="flex-1">
                              <h4 className="font-medium line-clamp-1">
                                {doubt.question}
                              </h4>
                              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                <span>
                                  {doubt.timestamp.toLocaleDateString()} at {doubt.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                <span className="w-1 h-1 rounded-full bg-muted-foreground"></span>
                                <span>{doubt.subject}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </TabsContent>
                
                <TabsContent value="solved" className="m-0">
                  <div className="divide-y">
                    {loading ? (
                      <div className="py-6 text-center">
                        <Loader2 className="h-8 w-8 mx-auto animate-spin mb-2 text-primary/70" />
                        <p className="text-muted-foreground">Loading your questions...</p>
                      </div>
                    ) : filteredDoubts.filter(doubt => doubt.solved).length === 0 ? (
                      <div className="py-6 text-center text-muted-foreground">
                        No solved questions found.
                      </div>
                    ) : (
                      filteredDoubts
                        .filter(doubt => doubt.solved)
                        .map((doubt) => (
                          <div
                            key={doubt.id}
                            className={cn(
                              "px-6 py-3 cursor-pointer hover:bg-muted/50 transition-colors",
                              selectedDoubt?.id === doubt.id && "bg-muted/80"
                            )}
                            onClick={() => setSelectedDoubt(doubt)}
                          >
                            <div className="flex items-start gap-3">
                              <div className="w-2 h-2 mt-2 rounded-full bg-green-500" />
                              <div className="flex-1">
                                <h4 className="font-medium line-clamp-1">
                                  {doubt.question}
                                </h4>
                                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                  <span>
                                    {doubt.timestamp.toLocaleDateString()} at {doubt.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                  <span className="w-1 h-1 rounded-full bg-muted-foreground"></span>
                                  <span>{doubt.subject}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))
                    )}
                  </div>
                </TabsContent>
                
                <TabsContent value="unsolved" className="m-0">
                  <div className="divide-y">
                    {loading ? (
                      <div className="py-6 text-center">
                        <Loader2 className="h-8 w-8 mx-auto animate-spin mb-2 text-primary/70" />
                        <p className="text-muted-foreground">Loading your questions...</p>
                      </div>
                    ) : filteredDoubts.filter(doubt => !doubt.solved).length === 0 ? (
                      <div className="py-6 text-center text-muted-foreground">
                        No unsolved questions found.
                      </div>
                    ) : (
                      filteredDoubts
                        .filter(doubt => !doubt.solved)
                        .map((doubt) => (
                          <div
                            key={doubt.id}
                            className={cn(
                              "px-6 py-3 cursor-pointer hover:bg-muted/50 transition-colors",
                              selectedDoubt?.id === doubt.id && "bg-muted/80"
                            )}
                            onClick={() => setSelectedDoubt(doubt)}
                          >
                            <div className="flex items-start gap-3">
                              <div className="w-2 h-2 mt-2 rounded-full bg-amber-500" />
                              <div className="flex-1">
                                <h4 className="font-medium line-clamp-1">
                                  {doubt.question}
                                </h4>
                                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                  <span>
                                    {doubt.timestamp.toLocaleDateString()} at {doubt.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                  <span className="w-1 h-1 rounded-full bg-muted-foreground"></span>
                                  <span>{doubt.subject}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
        
        <div className="md:col-span-2">
          <Card className="h-[calc(100vh-13rem)]">
            {loading ? (
              <div className="h-full flex flex-col items-center justify-center">
                <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
                <h3 className="text-lg font-medium">Loading your questions</h3>
                <p className="text-muted-foreground text-center max-w-xs mt-2">
                  Please wait while we fetch your previous questions and answers.
                </p>
              </div>
            ) : selectedDoubt ? (
              <>
                <CardHeader className="pb-3 border-b">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-xl">{selectedDoubt.question}</CardTitle>
                      <CardDescription>
                        {selectedDoubt.subject} • 
                        {selectedDoubt.timestamp.toLocaleDateString()} at {selectedDoubt.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </CardDescription>
                    </div>
                    {!selectedDoubt.solved && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => markAsSolved(selectedDoubt.id)}
                      >
                        <ThumbsUp className="mr-2 h-4 w-4" /> Mark as Solved
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-0 flex flex-col h-[calc(100%-10rem)]">
                  <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {selectedDoubt.messages.map((message) => (
                      <div
                        key={message.id}
                        className={cn(
                          "flex gap-3 max-w-[85%]",
                          message.sender === 'user' ? "ml-auto flex-row-reverse" : "mr-auto"
                        )}
                      >
                        <Avatar className={cn(
                          "w-8 h-8",
                          message.sender === 'user' ? "bg-primary" : "bg-muted"
                        )}>
                          <AvatarFallback>
                            {message.sender === 'user' ? 'U' : 'AI'}
                          </AvatarFallback>
                        </Avatar>
                        <div
                          className={cn(
                            "p-3 rounded-lg",
                            message.sender === 'user' 
                              ? "bg-primary text-primary-foreground" 
                              : "bg-muted"
                          )}
                        >
                          <div className="text-sm whitespace-pre-line">{message.content}</div>
                          <div className="mt-1 text-xs opacity-70 text-right">
                            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
                <CardFooter className="p-4 border-t mt-auto">
                  <div className="w-full flex gap-2">
                    <Input
                      placeholder="Type your message..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && !isGenerating && handleSendMessage()}
                      className="flex-1"
                      disabled={isGenerating}
                    />
                    <Button 
                      onClick={handleSendMessage} 
                      disabled={!newMessage.trim() || isGenerating}
                    >
                      {isGenerating ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <MessageCircle className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </CardFooter>
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center">
                <BrainCircuit className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium">Select a Question</h3>
                <p className="text-muted-foreground text-center max-w-xs mt-2">
                  Select a question from the list or ask a new question to start a conversation.
                </p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default DoubtSolver;
