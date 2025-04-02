
import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  CalendarDays, BrainCircuit, Menu, X, BookOpen, 
  FileText, LayoutDashboard, ChevronRight, Save,
  User, LogOut
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';

interface NavItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick?: () => void;
}

const NavItem = ({ to, icon, label, isActive, onClick }: NavItemProps) => (
  <Link
    to={to}
    className={cn(
      "flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-300 group",
      isActive 
        ? "bg-primary/10 text-primary font-medium" 
        : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
    )}
    onClick={onClick}
  >
    <div className={cn(
      "flex items-center justify-center w-8 h-8 rounded-lg transition-all",
      isActive ? "bg-primary text-white" : "bg-muted text-muted-foreground group-hover:bg-muted-foreground/10 group-hover:text-foreground"
    )}>
      {icon}
    </div>
    <span>{label}</span>
    {isActive && <ChevronRight className="ml-auto w-4 h-4" />}
  </Link>
);

interface LayoutProps {
  children: React.ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  const navItems = [
    { to: '/', icon: <LayoutDashboard size={18} />, label: 'Dashboard' },
    { to: '/study-planner', icon: <CalendarDays size={18} />, label: 'Study Planner' },
    { to: '/doubt-solver', icon: <BrainCircuit size={18} />, label: 'Doubt Solver' },
    { to: '/flashcard-generator', icon: <BookOpen size={18} />, label: 'Flashcards' },
    { to: '/notes-summarizer', icon: <FileText size={18} />, label: 'Notes Summarizer' },
    { to: '/saved-pdfs', icon: <Save size={18} />, label: 'Saved PDFs' },
  ];

  // Get user initials for avatar
  const getUserInitials = () => {
    if (!user?.email) return 'U';
    return user.email.charAt(0).toUpperCase();
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <div 
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col w-64 bg-card border-r border-border/40 shadow-sm transition-all duration-300 ease-in-out",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between p-4 border-b border-border/40">
          <Link to="/" className="flex items-center gap-2">
            <div className="relative w-8 h-8 bg-primary rounded-lg grid place-items-center">
            <img src="/logo.webp" alt="Brand Logo" className="w-full h-full object-contain rounded-lg" />
              <div className="absolute inset-0 bg-white rounded-lg animate-pulse opacity-40"></div>
            </div>
            <h1 className="font-bold text-lg">StudyMate AI</h1>
          </Link>
          <button 
            onClick={toggleSidebar}
            className="p-1 rounded-md hover:bg-muted/80 transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        
        <div className="flex-1 py-4 px-3 flex flex-col gap-2 overflow-y-auto">
          {navItems.map((item) => (
            <NavItem
              key={item.to}
              to={item.to}
              icon={item.icon}
              label={item.label}
              isActive={location.pathname === item.to}
              onClick={() => window.innerWidth < 768 && setSidebarOpen(false)}
            />
          ))}
        </div>
        
       
      </div>
      
      {/* Main Content */}
      <div className={cn(
        "flex-1 transition-all duration-300",
        sidebarOpen ? "md:ml-64" : "ml-0"
      )}>
        {/* Header */}
        <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border/40 p-3 flex items-center">
          <button 
            onClick={toggleSidebar}
            className={cn(
              "p-2 rounded-md hover:bg-muted/80 transition-colors",
              sidebarOpen && "md:hidden"
            )}
          >
            <Menu size={18} />
          </button>
          
          <div className="flex-1 flex justify-end gap-4">
            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback>{getUserInitials()}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <div className="flex items-center justify-start gap-2 p-2">
                    <div className="flex flex-col space-y-1 leading-none">
                      <p className="font-medium">{user.email}</p>
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/">
                      <User className="mr-2 h-4 w-4" />
                      <span>Dashboard</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </header>
        
        {/* Page Content */}
        <main className="container py-6 animation-fade-in">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
