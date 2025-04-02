
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BookOpen, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FlashcardDeck } from './types';

interface FlashcardDeckListProps {
  decks: FlashcardDeck[];
  selectedDeck: FlashcardDeck | null;
  onSelectDeck: (deck: FlashcardDeck) => void;
  onCreateDeck: (name: string, subject: string) => void;
}

const FlashcardDeckList: React.FC<FlashcardDeckListProps> = ({
  decks,
  selectedDeck,
  onSelectDeck,
  onCreateDeck,
}) => {
  const [newDeckName, setNewDeckName] = useState('');
  const [newDeckSubject, setNewDeckSubject] = useState('');

  const handleCreateDeck = () => {
    if (!newDeckName.trim() || !newDeckSubject.trim()) return;
    onCreateDeck(newDeckName, newDeckSubject);
    setNewDeckName('');
    setNewDeckSubject('');
  };

  return (
    <Card className="lg:col-span-1">
      <CardHeader>
        <CardTitle>Flashcard Decks</CardTitle>
        <CardDescription>Select or create a deck to begin.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {decks.map((deck) => (
            <div
              key={deck.id}
              className={cn(
                "px-6 py-4 cursor-pointer hover:bg-muted/50 transition-colors",
                selectedDeck?.id === deck.id && "bg-muted/80"
              )}
              onClick={() => onSelectDeck(deck)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">{deck.name}</h3>
                  <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                    <span>{deck.subject}</span>
                    <span className="w-1 h-1 rounded-full bg-muted-foreground"></span>
                    <span>{deck.totalCards} cards</span>
                  </div>
                </div>
                <BookOpen className="h-5 w-5 text-muted-foreground" />
              </div>
            </div>
          ))}
          
          {decks.length === 0 && (
            <div className="px-6 py-8 text-center text-muted-foreground">
              No flashcard decks created yet.
            </div>
          )}
        </div>
        
        <div className="p-6 border-t">
          <div className="space-y-4">
            <h3 className="font-medium">Create New Deck</h3>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="deck-name">Deck Name</Label>
                <Input
                  id="deck-name"
                  placeholder="e.g. Biology - Cell Structure"
                  value={newDeckName}
                  onChange={(e) => setNewDeckName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deck-subject">Subject</Label>
                <Select 
                  value={newDeckSubject} 
                  onValueChange={setNewDeckSubject}
                >
                  <SelectTrigger id="deck-subject">
                    <SelectValue placeholder="Select a subject" />
                  </SelectTrigger>
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
                  </SelectContent>
                </Select>
              </div>
              <Button 
                className="w-full" 
                onClick={handleCreateDeck}
                disabled={!newDeckName.trim() || !newDeckSubject.trim()}
              >
                <Plus className="mr-2 h-4 w-4" /> Create Deck
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default FlashcardDeckList;
