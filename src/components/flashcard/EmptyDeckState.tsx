
import React from 'react';
import { BookOpen } from 'lucide-react';

const EmptyDeckState: React.FC = () => {
  return (
    <div className="h-[calc(100vh-20rem)] flex flex-col items-center justify-center p-6">
      <BookOpen className="h-12 w-12 text-muted-foreground/50 mb-4" />
      <h3 className="text-lg font-medium">Select a Deck</h3>
      <p className="text-muted-foreground text-center max-w-xs mt-2">
        Select a flashcard deck from the list or create a new one to get started.
      </p>
    </div>
  );
};

export default EmptyDeckState;
