
import React, { useState, useEffect } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { format, parseISO } from 'date-fns';
import { CalendarDays, Clock, Trash2, Plus, BookOpen, Loader2, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

// Form schema for creating study sessions
const formSchema = z.object({
  subject: z.string().min(1, { message: 'Subject is required' }),
  topic: z.string().min(1, { message: 'Topic is required' }),
  date: z.date({
    required_error: 'Date is required',
  }),
  startTime: z.string().min(1, { message: 'Start time is required' }),
  duration: z.string().min(1, { message: 'Duration is required' }),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

// Interface matching our database format
interface DbStudySession {
  id: string;
  user_id: string;
  subject: string;
  topic: string;
  date: string;
  startTime: string; // Matches the column name in database
  duration: string;
  notes: string | null;
  created_at: string;
  progress: number | string;
  completed: boolean | string;
}

// Interface for our component usage
interface StudySession extends Omit<FormValues, 'date'> {
  id: string;
  user_id: string;
  date: Date;
  created_at: string;
  progress: number;
  completed: boolean;
}

const StudyPlanner = () => {
  const [studySessions, setStudySessions] = useState<StudySession[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();

  // Initialize form
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      subject: '',
      topic: '',
      date: new Date(),
      startTime: '',
      duration: '',
      notes: '',
    },
  });

  // Fetch study sessions from the database
  useEffect(() => {
    const fetchStudySessions = async () => {
      if (!user) return;
      
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('study_sessions')
          .select('*')
          .eq('user_id', user.id)
          .order('date', { ascending: false });
        
        if (error) throw error;
        
        // Convert database format to our component format
        const formattedSessions: StudySession[] = (data || []).map(session => ({
          id: session.id,
          user_id: session.user_id,
          subject: session.subject,
          topic: session.topic,
          date: new Date(session.date), // Convert string to Date
          startTime: session.startTime || "", // Match DB column name
          duration: session.duration,
          notes: session.notes || "",
          created_at: session.created_at,
          progress: typeof session.progress === 'number' ? session.progress : 
                   session.progress ? Number(session.progress) : 0,
          completed: typeof session.completed === 'boolean' ? session.completed : 
                    session.completed === 'true' ? true : false
        }));
        
        setStudySessions(formattedSessions);
      } catch (error: any) {
        console.error('Error fetching study sessions:', error);
        toast({
          title: 'Error fetching study sessions',
          description: error.message,
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchStudySessions();
  }, [user, toast]);

  // Handle form submission
  const onSubmit = async (values: FormValues) => {
    if (!user) return;
    
    try {
      // Format the date as YYYY-MM-DD for database storage
      const formattedDate = format(values.date, 'yyyy-MM-dd');
      
      const newSession = {
        user_id: user.id,
        subject: values.subject,
        topic: values.topic,
        date: formattedDate,
        startTime: values.startTime, // Match DB column name
        duration: values.duration,
        notes: values.notes || null,
        progress: "0",  // Store as string to match DB expectations
        completed: "false" // Store as string to match DB expectations
      };
      
      const { data, error } = await supabase
        .from('study_sessions')
        .insert(newSession)
        .select('*')
        .single();
      
      if (error) throw error;
      
      // Convert the returned data to our component format
      const formattedSession: StudySession = {
        id: data.id,
        user_id: data.user_id,
        subject: data.subject,
        topic: data.topic,
        date: new Date(data.date),
        startTime: data.startTime || "", // Match DB column name
        duration: data.duration,
        notes: data.notes || "",
        created_at: data.created_at,
        progress: typeof data.progress === 'number' ? data.progress : 
                 data.progress ? Number(data.progress) : 0,
        completed: typeof data.completed === 'boolean' ? data.completed : 
                  data.completed === 'true' ? true : false
      };
      
      setStudySessions([formattedSession, ...studySessions]);
      setIsCreateDialogOpen(false);
      form.reset();
      
      toast({
        title: 'Study session created',
        description: 'Your study session has been scheduled.',
      });

      // Broadcast update for dashboard
      const channel = supabase.channel('dashboard-updates');
      channel.send({
        type: 'broadcast',
        event: 'session-created',
        payload: { session: formattedSession }
      });
    } catch (error: any) {
      console.error('Error creating study session:', error);
      toast({
        title: 'Error creating study session',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  // Helper to extract minutes from duration string
  const extractMinutes = (duration: string): number => {
    const hourMatch = duration.match(/(\d+)(?:\s+)?hours?/i);
    const minuteMatch = duration.match(/(\d+)(?:\s+)?minutes?/i);
    const halfHourMatch = duration.match(/(\d+\.5)(?:\s+)?hours?/i);

    let totalMinutes = 0;
    if (hourMatch) totalMinutes += parseInt(hourMatch[1]) * 60;
    if (minuteMatch) totalMinutes += parseInt(minuteMatch[1]);
    if (halfHourMatch) totalMinutes += 30; // Add 30 minutes for .5 hours

    return totalMinutes || 60; // Default to 60 minutes if parsing fails
  };

  // Update session progress
  const updateSessionProgress = async (sessionId: string, progress: number) => {
    if (!user) return;
    
    try {
      const completed = progress >= 100;
      
      const { error } = await supabase
        .from('study_sessions')
        .update({ 
          progress: progress.toString(),  // Convert to string for DB
          completed: completed.toString() // Convert to string for DB
        })
        .eq('id', sessionId);
      
      if (error) throw error;
      
      // Update local state
      const updatedSessions = studySessions.map(session => 
        session.id === sessionId 
          ? { ...session, progress, completed } 
          : session
      );
      
      setStudySessions(updatedSessions);
      
      if (completed) {
        toast({
          title: 'Study session completed',
          description: 'Great job! You\'ve completed this study session.',
        });
      }

      // Broadcast update for dashboard
      const channel = supabase.channel('dashboard-updates');
      channel.send({
        type: 'broadcast',
        event: 'session-updated',
        payload: { 
          sessionId,
          progress,
          completed,
          subject: updatedSessions.find(s => s.id === sessionId)?.subject 
        }
      });
    } catch (error: any) {
      console.error('Error updating session progress:', error);
      toast({
        title: 'Error updating progress',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  // Mark session as complete
  const markSessionComplete = async (sessionId: string) => {
    if (!user) return;
    
    try {
      const { error } = await supabase
        .from('study_sessions')
        .update({ 
          progress: "100",  // Store as string to match DB expectations
          completed: "true" // Store as string to match DB expectations
        })
        .eq('id', sessionId);
      
      if (error) throw error;
      
      // Update local state
      const updatedSessions = studySessions.map(session => 
        session.id === sessionId 
          ? { ...session, progress: 100, completed: true } 
          : session
      );
      
      setStudySessions(updatedSessions);
      
      toast({
        title: 'Study session completed',
        description: 'Great job! You\'ve completed this study session.',
      });

      // Broadcast update for dashboard
      const channel = supabase.channel('dashboard-updates');
      channel.send({
        type: 'broadcast',
        event: 'session-completed',
        payload: { 
          sessionId,
          subject: updatedSessions.find(s => s.id === sessionId)?.subject 
        }
      });
    } catch (error: any) {
      console.error('Error marking session as complete:', error);
      toast({
        title: 'Error updating session',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  // Filter sessions for the selected date
  const sessionsForSelectedDate = selectedDate 
    ? studySessions.filter(session => {
        // Compare date components only
        return (
          session.date.getDate() === selectedDate.getDate() &&
          session.date.getMonth() === selectedDate.getMonth() &&
          session.date.getFullYear() === selectedDate.getFullYear()
        );
      })
    : [];

  // Delete a study session
  const deleteSession = async (id: string) => {
    try {
      // Store the session for potential undo
      const sessionToDelete = studySessions.find(session => session.id === id);
      
      const { error } = await supabase
        .from('study_sessions')
        .delete()
        .eq('id', id);
      
      if (error) throw error;

      // Update local state
      setStudySessions(studySessions.filter(session => session.id !== id));
      
      // Provide undo option
      toast({
        title: 'Study session deleted',
        description: 'The study session has been removed.',
        action: sessionToDelete ? (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => handleUndoDelete(sessionToDelete)}
          >
            Undo
          </Button>
        ) : undefined
      });

      // Broadcast update for dashboard
      if (sessionToDelete) {
        const channel = supabase.channel('dashboard-updates');
        channel.send({
          type: 'broadcast',
          event: 'session-deleted',
          payload: { 
            sessionId: id,
            subject: sessionToDelete.subject 
          }
        });
      }
    } catch (error: any) {
      console.error('Error deleting study session:', error);
      toast({
        title: 'Error deleting study session',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  // Handle undo delete
  const handleUndoDelete = async (session: StudySession) => {
    try {
      // Format the date back to YYYY-MM-DD for database storage
      const formattedDate = format(session.date, 'yyyy-MM-dd');
      
      const { data, error } = await supabase
        .from('study_sessions')
        .insert([{
          user_id: session.user_id,
          subject: session.subject,
          topic: session.topic,
          date: formattedDate,
          startTime: session.startTime,
          duration: session.duration,
          notes: session.notes,
          progress: session.progress.toString(),  // Convert to string for DB
          completed: session.completed.toString() // Convert to string for DB
        }])
        .select('*')
        .single();
      
      if (error) throw error;
      
      // Add the restored session back to the state
      const restoredSession: StudySession = {
        id: data.id,
        user_id: data.user_id,
        subject: data.subject,
        topic: data.topic,
        date: new Date(data.date),
        startTime: data.startTime || "",
        duration: data.duration,
        notes: data.notes || "",
        created_at: data.created_at,
        progress: typeof data.progress === 'number' ? data.progress : 
                 data.progress ? Number(data.progress) : 0,
        completed: typeof data.completed === 'boolean' ? data.completed : 
                  data.completed === 'true' ? true : false
      };
      
      setStudySessions([...studySessions, restoredSession]);
      
      toast({
        title: 'Study session restored',
        description: 'The study session has been restored.',
      });

      // Broadcast update for dashboard
      const channel = supabase.channel('dashboard-updates');
      channel.send({
        type: 'broadcast',
        event: 'session-restored',
        payload: { session: restoredSession }
      });
    } catch (error: any) {
      console.error('Error restoring study session:', error);
      toast({
        title: 'Error restoring study session',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight">Study Planner</h1>
        <p className="text-muted-foreground">Schedule and manage your study sessions effectively.</p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Study Calendar</CardTitle>
            <CardDescription>Select a date to view or schedule sessions</CardDescription>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              className="rounded-md border p-3 pointer-events-auto"
            />
            
            <div className="mt-4">
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="w-full">
                    <Plus className="mr-2 h-4 w-4" /> New Study Session
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-hidden">
                  <ScrollArea className="max-h-[80vh]">
                    <DialogHeader>
                      <DialogTitle>Create Study Session</DialogTitle>
                      <DialogDescription>
                        Schedule a new study session for your calendar.
                      </DialogDescription>
                    </DialogHeader>
                    
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                          control={form.control}
                          name="subject"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Subject</FormLabel>
                              <Select 
                                onValueChange={field.onChange} 
                                defaultValue={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select a subject" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="Mathematics">Mathematics</SelectItem>
                                  <SelectItem value="Physics">Physics</SelectItem>
                                  <SelectItem value="Chemistry">Chemistry</SelectItem>
                                  <SelectItem value="Biology">Biology</SelectItem>
                                  <SelectItem value="Computer Science">Computer Science</SelectItem>
                                  <SelectItem value="Literature">Literature</SelectItem>
                                  <SelectItem value="History">History</SelectItem>
                                  <SelectItem value="Geography">Geography</SelectItem>
                                  <SelectItem value="Languages">Languages</SelectItem>
                                  <SelectItem value="Other">Other</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="topic"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Topic</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g. Calculus - Integrals" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="date"
                          render={({ field }) => (
                            <FormItem className="flex flex-col">
                              <FormLabel>Date</FormLabel>
                              <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                                initialFocus
                                className="rounded-md border pointer-events-auto"
                              />
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="startTime"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Start Time</FormLabel>
                                <FormControl>
                                  <Input type="time" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={form.control}
                            name="duration"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Duration</FormLabel>
                                <Select 
                                  onValueChange={field.onChange} 
                                  defaultValue={field.value}
                                >
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select duration" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="30 minutes">30 minutes</SelectItem>
                                    <SelectItem value="1 hour">1 hour</SelectItem>
                                    <SelectItem value="1.5 hours">1.5 hours</SelectItem>
                                    <SelectItem value="2 hours">2 hours</SelectItem>
                                    <SelectItem value="2.5 hours">2.5 hours</SelectItem>
                                    <SelectItem value="3 hours">3 hours</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        
                        <FormField
                          control={form.control}
                          name="notes"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Notes (Optional)</FormLabel>
                              <FormControl>
                                <Textarea 
                                  placeholder="Add any notes or topics to focus on" 
                                  className="resize-none" 
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <DialogFooter className="mt-6">
                          <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                            Cancel
                          </Button>
                          <Button type="submit">Create Session</Button>
                        </DialogFooter>
                      </form>
                    </Form>
                  </ScrollArea>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>
        
        {/* Sessions for Selected Date */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>
                  {selectedDate ? format(selectedDate, 'EEEE, MMMM d, yyyy') : 'Study Sessions'}
                </CardTitle>
                <CardDescription>
                  {loading ? 'Loading sessions...' : (
                    sessionsForSelectedDate.length === 0 
                      ? "No study sessions scheduled for this date." 
                      : `${sessionsForSelectedDate.length} session${sessionsForSelectedDate.length !== 1 ? 's' : ''} scheduled.`
                  )}
                </CardDescription>
              </div>
              {selectedDate && !loading && sessionsForSelectedDate.length === 0 && (
                <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline">
                      <Plus className="mr-2 h-4 w-4" /> Add Session
                    </Button>
                  </DialogTrigger>
                </Dialog>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Loader2 className="h-12 w-12 text-muted-foreground/50 mb-4 animate-spin" />
                  <h3 className="text-lg font-medium mb-2">Loading sessions</h3>
                  <p className="text-muted-foreground max-w-sm">
                    Getting your study schedule...
                  </p>
                </div>
              ) : sessionsForSelectedDate.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <CalendarDays className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Sessions Scheduled</h3>
                  <p className="text-muted-foreground max-w-sm">
                    You don't have any study sessions scheduled for this date. Click 'New Study Session' to create one.
                  </p>
                </div>
              ) : (
                sessionsForSelectedDate.map((session) => (
                  <div 
                    key={session.id}
                    className="group p-4 rounded-lg border border-border hover:bg-muted/10 transition-colors"
                  >
                    <div className="flex items-start">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mr-3">
                        <BookOpen className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-medium text-lg">{session.subject}</h4>
                            <p className="text-muted-foreground">{session.topic}</p>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => deleteSession(session.id)}
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                          </Button>
                        </div>
                        
                        <div className="mt-2 flex items-center text-sm text-muted-foreground">
                          <Clock className="mr-1 h-4 w-4" />
                          <span>{session.startTime} • {session.duration}</span>
                        </div>
                        
                        {/* Progress Tracker */}
                        <div className="mt-4 space-y-2">
                          <div className="flex justify-between items-center text-sm">
                            <span className="font-medium">Progress: {session.progress}%</span>
                            <span className="text-muted-foreground">
                              {Math.round(extractMinutes(session.duration) * session.progress / 100)} min of {extractMinutes(session.duration)} min
                            </span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="text-xs text-muted-foreground">0%</span>
                            <div className="relative flex-1">
                              <Progress value={session.progress} className="h-2" />
                              <Slider
                                defaultValue={[session.progress]}
                                max={100}
                                step={5}
                                onValueChange={(values) => updateSessionProgress(session.id, values[0])}
                                className="mt-1"
                              />
                              <div className="w-full flex justify-between mt-1 px-0.5">
                                <span className="w-0.5 h-1.5 bg-muted-foreground/50"></span>
                                <span className="w-0.5 h-1.5 bg-muted-foreground/50"></span>
                                <span className="w-0.5 h-1.5 bg-muted-foreground/50"></span>
                                <span className="w-0.5 h-1.5 bg-muted-foreground/50"></span>
                                <span className="w-0.5 h-1.5 bg-muted-foreground/50"></span>
                              </div>
                            </div>
                            <span className="text-xs text-muted-foreground">100%</span>
                          </div>
                          
                          {session.progress < 100 ? (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => markSessionComplete(session.id)}
                              className="w-full mt-2"
                            >
                              <CheckCircle className="mr-2 h-4 w-4" />
                              Mark as Complete
                            </Button>
                          ) : (
                            <div className="flex items-center justify-center mt-2 text-primary">
                              <CheckCircle className="mr-2 h-4 w-4" />
                              <span className="font-medium">Completed</span>
                            </div>
                          )}
                        </div>
                        
                        {session.notes && (
                          <div className="mt-3 p-3 bg-muted/30 rounded-md text-sm">
                            {session.notes}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default StudyPlanner;

// This SQL should be run in your database to add the new columns:
// ALTER TABLE public.study_sessions ADD COLUMN progress INTEGER DEFAULT 0;
// ALTER TABLE public.study_sessions ADD COLUMN completed BOOLEAN DEFAULT false;
