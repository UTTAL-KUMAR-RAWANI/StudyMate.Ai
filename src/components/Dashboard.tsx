
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  CalendarDays, BrainCircuit, BookOpen, FileText, 
  Clock, TrendingUp, CheckCircle, ChevronRight, Save
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { format, isBefore, parseISO } from 'date-fns';

interface StudySession {
  id: string;
  subject: string;
  topic: string;
  date: Date;
  startTime: string;
  duration: string;
  progress: number;
  completed: boolean;
}

interface Doubt {
  id: string;
  question: string;
  answered: boolean;
  datetime: string;
}

interface SubjectProgress {
  subject: string;
  progress: number;
  totalSessions: number;
  completedSessions: number;
}

const Dashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [upcomingStudySessions, setUpcomingStudySessions] = useState<StudySession[]>([]);
  const [recentDoubts, setRecentDoubts] = useState<Doubt[]>([]);
  const [studyProgress, setStudyProgress] = useState<SubjectProgress[]>([]);
  const [updatingProgress, setUpdatingProgress] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchDashboardData = async () => {
      setLoading(true);
      
      try {
        // Fetch study sessions
        const { data: sessionsData, error: sessionsError } = await supabase
          .from('study_sessions')
          .select('*')
          .eq('user_id', user.id)
          .order('date', { ascending: true });
          
        if (sessionsError) throw sessionsError;
        
        // Fetch recent doubts
        const { data: doubtsData, error: doubtsError } = await supabase
          .from('doubts')
          .select('*')
          .eq('user_id', user.id)
          .order('timestamp', { ascending: false })
          .limit(5);
          
        if (doubtsError) throw doubtsError;
        
        // Process upcoming sessions
        const formattedSessions = (sessionsData || []).map(session => ({
          id: session.id,
          subject: session.subject,
          topic: session.topic,
          date: new Date(session.date),
          startTime: session.startTime || "",
          duration: session.duration,
          progress: typeof session.progress === 'number' ? session.progress : 
                    session.progress ? Number(session.progress) : 0,
          completed: typeof session.completed === 'boolean' ? session.completed : 
                     session.completed === 'true' ? true : false
        }));
        
        // Filter for upcoming sessions (not past and not completed)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const upcoming = formattedSessions
          .filter(session => 
            !session.completed && 
            (session.date >= today || 
              (session.date.getDate() === today.getDate() && 
               session.date.getMonth() === today.getMonth() && 
               session.date.getFullYear() === today.getFullYear()))
          )
          .sort((a, b) => {
            // First by date
            const dateComparison = a.date.getTime() - b.date.getTime();
            if (dateComparison !== 0) return dateComparison;
            
            // If same date, sort by start time
            const timeA = a.startTime.split(':').map(Number);
            const timeB = b.startTime.split(':').map(Number);
            
            // Compare hours then minutes
            return timeA[0] !== timeB[0] 
              ? timeA[0] - timeB[0] 
              : timeA[1] - timeB[1];
          })
          .slice(0, 4); // Show more sessions (increased from 2)
          
        setUpcomingStudySessions(upcoming);
        
        // Process recent doubts
        const formattedDoubts = (doubtsData || []).map(doubt => ({
          id: doubt.id,
          question: doubt.question,
          answered: doubt.solved,
          datetime: format(new Date(doubt.timestamp), 'PPp') // Format timestamp
        })).slice(0, 2); // Get only 2 for display
        
        setRecentDoubts(formattedDoubts);
        
        // Calculate study progress by subject
        const subjectMap = new Map<string, { total: number; completed: number }>();
        
        formattedSessions.forEach(session => {
          const subject = session.subject;
          if (!subjectMap.has(subject)) {
            subjectMap.set(subject, { total: 0, completed: 0 });
          }
          
          const subjectData = subjectMap.get(subject)!;
          subjectData.total += 1;
          
          if (session.completed) {
            subjectData.completed += 1;
          } else if (session.progress > 0) {
            // Partially completed sessions contribute proportionally
            subjectData.completed += session.progress / 100;
          }
        });
        
        const progressData: SubjectProgress[] = Array.from(subjectMap.entries())
          .map(([subject, data]) => ({
            subject,
            progress: Math.round(data.total > 0 ? (data.completed / data.total) * 100 : 0),
            totalSessions: data.total,
            completedSessions: Math.round(data.completed)
          }))
          .sort((a, b) => b.progress - a.progress) // Sort by progress (descending)
          .slice(0, 3); // Take top 3 subjects
          
        setStudyProgress(progressData);
      } catch (error: any) {
        console.error('Error fetching dashboard data:', error);
        toast({
          title: 'Error loading dashboard',
          description: error.message,
          variant: 'destructive'
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchDashboardData();
    
    // Set up real-time updates
    const channel = supabase.channel('dashboard-updates');
    
    channel
      .on('broadcast', { event: 'session-created' }, ({ payload }) => {
        handleSessionCreated(payload.session);
      })
      .on('broadcast', { event: 'session-updated' }, ({ payload }) => {
        handleSessionUpdated(payload);
      })
      .on('broadcast', { event: 'session-completed' }, ({ payload }) => {
        handleSessionCompleted(payload);
      })
      .on('broadcast', { event: 'session-deleted' }, ({ payload }) => {
        handleSessionDeleted(payload);
      })
      .on('broadcast', { event: 'session-restored' }, ({ payload }) => {
        handleSessionCreated(payload.session);
      })
      .on('broadcast', { event: 'doubt-created' }, ({ payload }) => {
        handleDoubtCreated(payload.doubt);
      })
      .on('broadcast', { event: 'doubt-updated' }, ({ payload }) => {
        handleDoubtUpdated(payload);
      })
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, toast]);
  
  // Handler for session created event
  const handleSessionCreated = (session: StudySession) => {
    // Update upcoming sessions
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (!session.completed && (session.date >= today)) {
      // Add to upcoming sessions and sort
      const updated = [...upcomingStudySessions, session]
        .sort((a, b) => {
          // First by date
          const dateComparison = a.date.getTime() - b.date.getTime();
          if (dateComparison !== 0) return dateComparison;
          
          // If same date, sort by start time
          const timeA = a.startTime.split(':').map(Number);
          const timeB = b.startTime.split(':').map(Number);
          
          // Compare hours then minutes
          return timeA[0] !== timeB[0] 
            ? timeA[0] - timeB[0] 
            : timeA[1] - timeB[1];
        })
        .slice(0, 4); // Show more sessions (increased from 2)
        
      setUpcomingStudySessions(updated);
    }
    
    // Update subject progress
    updateSubjectProgress(session.subject);
    
    // Show toast for confirmation
    toast({
      title: 'Dashboard updated',
      description: 'New study session has been added to your schedule.',
    });
  };
  
  // Handler for session updated event
  const handleSessionUpdated = (payload: { sessionId: string; progress: number; completed: boolean; subject: string }) => {
    // Update upcoming sessions if this session is there
    const updatedUpcoming = upcomingStudySessions.map(session => 
      session.id === payload.sessionId 
        ? { ...session, progress: payload.progress, completed: payload.completed } 
        : session
    );
    
    // If session is now complete, remove from upcoming
    const filteredUpcoming = updatedUpcoming.filter(session => !session.completed);
    setUpcomingStudySessions(filteredUpcoming);
    
    // Update subject progress with animation
    setUpdatingProgress(payload.subject);
    updateSubjectProgress(payload.subject);
    
    // Reset updating status after animation completes
    setTimeout(() => {
      setUpdatingProgress(null);
    }, 1000);
  };
  
  // Handler for session completed event
  const handleSessionCompleted = (payload: { sessionId: string; subject: string }) => {
    // Remove from upcoming sessions
    setUpcomingStudySessions(prev => 
      prev.filter(session => session.id !== payload.sessionId)
    );
    
    // Update subject progress with animation
    setUpdatingProgress(payload.subject);
    updateSubjectProgress(payload.subject);
    
    // Reset updating status after animation completes
    setTimeout(() => {
      setUpdatingProgress(null);
    }, 1000);
    
    // Show confirmation
    toast({
      title: 'Session completed',
      description: 'Great job! Your progress has been updated.',
    });
  };
  
  // Handler for session deleted event
  const handleSessionDeleted = (payload: { sessionId: string; subject: string }) => {
    // Remove from upcoming sessions
    setUpcomingStudySessions(prev => 
      prev.filter(session => session.id !== payload.sessionId)
    );
    
    // Update subject progress
    updateSubjectProgress(payload.subject);
  };
  
  // Handler for doubt created event
  const handleDoubtCreated = (doubt: Doubt) => {
    // Add to recent doubts and keep only most recent 2
    setRecentDoubts(prev => [doubt, ...prev].slice(0, 2));
    
    // Show confirmation
    toast({
      title: 'New doubt added',
      description: 'Your question has been added to the list.',
    });
  };
  
  // Handler for doubt updated event
  const handleDoubtUpdated = (payload: { doubtId: string; solved: boolean }) => {
    // Update doubt status
    setRecentDoubts(prev => 
      prev.map(doubt => 
        doubt.id === payload.doubtId 
          ? { ...doubt, answered: payload.solved } 
          : doubt
      )
    );
    
    // Show confirmation if solved
    if (payload.solved) {
      toast({
        title: 'Doubt solved',
        description: 'Your question has been marked as answered.',
      });
    }
  };
  
  // Helper to update subject progress
  const updateSubjectProgress = async (subject: string) => {
    if (!user) return;
    
    try {
      // Fetch all sessions for this subject
      const { data, error } = await supabase
        .from('study_sessions')
        .select('*')
        .eq('user_id', user.id)
        .eq('subject', subject);
        
      if (error) throw error;
      
      // Calculate progress
      let totalSessions = data.length;
      let completedSessions = 0;
      
      data.forEach(session => {
        const isCompleted = typeof session.completed === 'boolean' 
          ? session.completed 
          : session.completed === 'true';
          
        const sessionProgress = typeof session.progress === 'number'
          ? session.progress
          : session.progress ? Number(session.progress) : 0;
          
        if (isCompleted) {
          completedSessions += 1;
        } else if (sessionProgress > 0) {
          // Partially completed sessions contribute proportionally
          completedSessions += sessionProgress / 100;
        }
      });
      
      const progress = Math.round(totalSessions > 0 ? (completedSessions / totalSessions) * 100 : 0);
      
      // Update study progress state
      setStudyProgress(prev => {
        const existing = prev.find(p => p.subject === subject);
        
        if (existing) {
          // Update existing subject
          return prev.map(p => 
            p.subject === subject 
              ? { ...p, progress, totalSessions, completedSessions: Math.round(completedSessions) } 
              : p
          );
        } else {
          // Add new subject if not in top 3 yet
          const newProgress = { 
            subject, 
            progress, 
            totalSessions, 
            completedSessions: Math.round(completedSessions) 
          };
          
          return [...prev, newProgress]
            .sort((a, b) => b.progress - a.progress)
            .slice(0, 3);
        }
      });
    } catch (error: any) {
      console.error('Error updating subject progress:', error);
    }
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="space-y-3">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-full max-w-md" />
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <Card key={i} className="h-full">
              <CardHeader className="pb-2">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <Skeleton className="h-5 w-32 mt-3" />
                <Skeleton className="h-4 w-full" />
              </CardHeader>
              <CardFooter className="pt-2">
                <Skeleton className="h-4 w-16" />
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Alert>
        <AlertDescription>
          Please sign in to view your dashboard.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight">Welcome back</h1>
        <p className="text-muted-foreground">Track your study journey and achieve your goals with StudyMate AI.</p>
      </div>
      
      {/* Study Tools */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Link to="/study-planner" className="group">
          <Card className="h-full transition-all duration-300 hover:shadow-md hover:border-primary/20 group-hover:scale-[1.02] active:scale-[0.98]">
            <CardHeader className="pb-2">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <CalendarDays className="w-5 h-5 text-primary" />
              </div>
              <CardTitle className="mt-3">Study Planner</CardTitle>
              <CardDescription>Schedule and track your study sessions</CardDescription>
            </CardHeader>
            <CardFooter className="pt-2">
              <span className="text-sm text-primary flex items-center">
                Open <ChevronRight className="ml-1 w-4 h-4" />
              </span>
            </CardFooter>
          </Card>
        </Link>
        
        <Link to="/doubt-solver" className="group">
          <Card className="h-full transition-all duration-300 hover:shadow-md hover:border-primary/20 group-hover:scale-[1.02] active:scale-[0.98]">
            <CardHeader className="pb-2">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <BrainCircuit className="w-5 h-5 text-primary" />
              </div>
              <CardTitle className="mt-3">Doubt Solver</CardTitle>
              <CardDescription>Get answers to your study questions</CardDescription>
            </CardHeader>
            <CardFooter className="pt-2">
              <span className="text-sm text-primary flex items-center">
                Open <ChevronRight className="ml-1 w-4 h-4" />
              </span>
            </CardFooter>
          </Card>
        </Link>
        
        <Link to="/flashcard-generator" className="group">
          <Card className="h-full transition-all duration-300 hover:shadow-md hover:border-primary/20 group-hover:scale-[1.02] active:scale-[0.98]">
            <CardHeader className="pb-2">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-primary" />
              </div>
              <CardTitle className="mt-3">Flashcards</CardTitle>
              <CardDescription>Create and review flashcards for efficient studying</CardDescription>
            </CardHeader>
            <CardFooter className="pt-2">
              <span className="text-sm text-primary flex items-center">
                Open <ChevronRight className="ml-1 w-4 h-4" />
              </span>
            </CardFooter>
          </Card>
        </Link>
        
        <Link to="/notes-summarizer" className="group">
          <Card className="h-full transition-all duration-300 hover:shadow-md hover:border-primary/20 group-hover:scale-[1.02] active:scale-[0.98]">
            <CardHeader className="pb-2">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <CardTitle className="mt-3">Notes Summarizer</CardTitle>
              <CardDescription>Generate concise summaries of your study materials</CardDescription>
            </CardHeader>
            <CardFooter className="pt-2">
              <span className="text-sm text-primary flex items-center">
                Open <ChevronRight className="ml-1 w-4 h-4" />
              </span>
            </CardFooter>
          </Card>
        </Link>
        
        <Link to="/saved-pdfs" className="group">
          <Card className="h-full transition-all duration-300 hover:shadow-md hover:border-primary/20 group-hover:scale-[1.02] active:scale-[0.98]">
            <CardHeader className="pb-2">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Save className="w-5 h-5 text-primary" />
              </div>
              <CardTitle className="mt-3">Saved PDFs</CardTitle>
              <CardDescription>Access your saved PDF summaries</CardDescription>
            </CardHeader>
            <CardFooter className="pt-2">
              <span className="text-sm text-primary flex items-center">
                Open <ChevronRight className="ml-1 w-4 h-4" />
              </span>
            </CardFooter>
          </Card>
        </Link>
      </div>
      
      {/* Dashboard Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Study Progress</CardTitle>
              <TrendingUp className="w-5 h-5 text-primary" />
            </div>
            <CardDescription>Your progress across different subjects</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {studyProgress.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-4">
                  No study progress to show yet. Start scheduling and completing study sessions!
                </div>
              ) : (
                studyProgress.map((subject) => (
                  <div key={subject.subject} className="space-y-2">
                    <div className="flex justify-between">
                      <span className="font-medium">{subject.subject}</span>
                      <div className="flex items-center">
                        {updatingProgress === subject.subject && (
                          <span className="animate-pulse mr-2 text-primary text-xs">Updating...</span>
                        )}
                        <span className="text-sm text-muted-foreground">{subject.progress}%</span>
                      </div>
                    </div>
                    <Progress 
                      value={subject.progress} 
                      className={`h-2 transition-all duration-700 ${updatingProgress === subject.subject ? 'animate-pulse' : ''}`} 
                    />
                    <div className="text-xs text-muted-foreground">
                      {subject.completedSessions} of {subject.totalSessions} sessions completed
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Upcoming Sessions</CardTitle>
              <Clock className="w-5 h-5 text-primary" />
            </div>
            <CardDescription>Your scheduled study sessions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {upcomingStudySessions.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-4">
                  No upcoming sessions. Plan your study schedule to stay on track!
                </div>
              ) : (
                upcomingStudySessions.map((session) => (
                  <div key={session.id} className="flex items-start p-3 rounded-lg border border-border hover:bg-muted/20 transition-colors">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mr-3">
                      <CalendarDays className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium">{session.subject} - {session.topic}</h4>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{format(session.date, 'E, MMM d')} at {session.startTime}</span>
                        <span className="w-1 h-1 rounded-full bg-muted-foreground"></span>
                        <span>{session.duration}</span>
                      </div>
                      {session.progress > 0 && (
                        <div className="mt-2">
                          <Progress value={session.progress} className="h-1.5" />
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
          <CardFooter>
            <Link to="/study-planner" className="text-sm text-primary flex items-center">
              View all sessions <ChevronRight className="ml-1 w-4 h-4" />
            </Link>
          </CardFooter>
        </Card>
        
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Doubts</CardTitle>
              <BrainCircuit className="w-5 h-5 text-primary" />
            </div>
            <CardDescription>Questions you've recently asked</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentDoubts.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-4">
                  No recent doubts. Use the Doubt Solver to get answers to your questions!
                </div>
              ) : (
                recentDoubts.map((doubt) => (
                  <div key={doubt.id} className="flex items-start p-3 rounded-lg border border-border hover:bg-muted/20 transition-colors">
                    {doubt.answered ? (
                      <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center mr-3">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mr-3">
                        <BrainCircuit className="w-5 h-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1">
                      <h4 className="font-medium">{doubt.question}</h4>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{doubt.answered ? 'Answered' : 'Pending'}</span>
                        <span className="w-1 h-1 rounded-full bg-muted-foreground"></span>
                        <span>{doubt.datetime}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
          <CardFooter>
            <Link to="/doubt-solver" className="text-sm text-primary flex items-center">
              View all doubts <ChevronRight className="ml-1 w-4 h-4" />
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
