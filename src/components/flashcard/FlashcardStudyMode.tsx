
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Flashcard, FlashcardDeck } from './types';

interface FlashcardStudyModeProps {
  deck: FlashcardDeck;
  onExit: () => void;
}

const FlashcardStudyMode: React.FC<FlashcardStudyModeProps> = ({ deck, onExit }) => {
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  
  const currentCard = currentCardIndex < deck.flashcards.length 
    ? deck.flashcards[currentCardIndex] 
    : null;
  
  const handleNext = () => {
    setIsFlipped(false);
    if (currentCardIndex < deck.flashcards.length - 1) {
      setCurrentCardIndex(currentCardIndex + 1);
    } else {
      setCurrentCardIndex(0);
    }
  };
  
  const handlePrevious = () => {
    setIsFlipped(false);
    if (currentCardIndex > 0) {
      setCurrentCardIndex(currentCardIndex - 1);
    } else {
      setCurrentCardIndex(deck.flashcards.length - 1);
    }
  };
  
  const toggleFlip = () => {
    setIsFlipped(!isFlipped);
  };
  
  return (
    <div className="h-[calc(100vh-15rem)] flex flex-col items-center justify-center">
      <div className="mb-6 flex items-center gap-4">
        <h2 className="text-xl font-semibold">{deck.name}</h2>
        <div className="px-2 py-1 bg-muted rounded-md text-sm">
          Card {currentCardIndex + 1} of {deck.flashcards.length}
        </div>
      </div>
      
      {currentCard && (
        <div 
          className={cn(
            "w-full max-w-2xl h-80 perspective-1000 cursor-pointer",
            "transition-all duration-500"
          )}
          onClick={toggleFlip}
        >
          <div 
            className={cn(
              "relative w-full h-full transition-transform duration-700 transform-style-3d",
              isFlipped ? "rotate-y-180" : ""
            )}
          >
            <div 
              className={cn(
                "absolute w-full h-full backface-hidden glass-panel p-8 flex flex-col",
                "justify-center items-center text-center"
              )}
            >
              <h3 className="text-xl font-semibold mb-4">Question</h3>
              <p className="text-lg">{currentCard.front}</p>
              <div className="mt-8 text-sm text-muted-foreground">Click to flip</div>
            </div>
            
            <div 
              className={cn(
                "absolute w-full h-full backface-hidden rotate-y-180 glass-panel p-8 flex flex-col",
                "justify-center items-center text-center"
              )}
            >
              <h3 className="text-xl font-semibold mb-4">Answer</h3>
              <p className="text-lg">{currentCard.back}</p>
              <div className="mt-8 text-sm text-muted-foreground">Click to flip</div>
            </div>
          </div>
        </div>
      )}
      
      <div className="mt-8 flex gap-4">
        <Button variant="outline" onClick={handlePrevious}>
          <ChevronLeft className="mr-2 h-4 w-4" /> Previous
        </Button>
        <Button variant="outline" onClick={onExit}>
          Exit Study Mode
        </Button>
        <Button onClick={handleNext}>
          Next <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default FlashcardStudyMode;
