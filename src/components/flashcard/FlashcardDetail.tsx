
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { BookOpen, Plus, Trash2, Edit, Save } from 'lucide-react';
import UploadNotesSection from '../UploadNotesSection';
import { Flashcard, FlashcardDeck } from './types';

interface FlashcardDetailProps {
  deck: FlashcardDeck;
  onStudy: () => void;
  onUpdateDeck: (updatedDeck: FlashcardDeck) => void;
  onAddGeneratedFlashcards: (generatedFlashcards: {front: string; back: string}[]) => void;
}

const FlashcardDetail: React.FC<FlashcardDetailProps> = ({
  deck,
  onStudy,
  onUpdateDeck,
  onAddGeneratedFlashcards
}) => {
  const [newCardFront, setNewCardFront] = useState('');
  const [newCardBack, setNewCardBack] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [editCardFront, setEditCardFront] = useState('');
  const [editCardBack, setEditCardBack] = useState('');
  const [editCardId, setEditCardId] = useState<string | null>(null);
  
  const handleCreateFlashcard = () => {
    if (!newCardFront.trim() || !newCardBack.trim()) return;
    
    const newCard: Flashcard = {
      id: Date.now().toString(),
      front: newCardFront,
      back: newCardBack,
      subject: deck.subject,
    };
    
    const updatedDeck = {
      ...deck,
      totalCards: deck.totalCards + 1,
      flashcards: [...deck.flashcards, newCard],
    };
    
    onUpdateDeck(updatedDeck);
    setNewCardFront('');
    setNewCardBack('');
  };
  
  const handleDeleteFlashcard = (cardId: string) => {
    const updatedFlashcards = deck.flashcards.filter(card => card.id !== cardId);
    const updatedDeck = {
      ...deck,
      totalCards: updatedFlashcards.length,
      flashcards: updatedFlashcards,
    };
    
    onUpdateDeck(updatedDeck);
  };
  
  const handleStartEdit = (card: Flashcard) => {
    setEditCardFront(card.front);
    setEditCardBack(card.back);
    setEditCardId(card.id);
    setEditMode(true);
  };
  
  const handleSaveEdit = () => {
    if (!editCardId || !editCardFront.trim() || !editCardBack.trim()) return;
    
    const updatedFlashcards = deck.flashcards.map(card => 
      card.id === editCardId 
        ? { ...card, front: editCardFront, back: editCardBack }
        : card
    );
    
    const updatedDeck = {
      ...deck,
      flashcards: updatedFlashcards,
    };
    
    onUpdateDeck(updatedDeck);
    setEditMode(false);
    setEditCardId(null);
  };
  
  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>{deck.name}</CardTitle>
            <CardDescription>
              {deck.subject} • {deck.totalCards} cards
            </CardDescription>
          </div>
          {deck.flashcards.length > 0 && (
            <Button onClick={onStudy}>
              <BookOpen className="mr-2 h-4 w-4" /> Study
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Tabs defaultValue="cards">
          <div className="px-6 pb-2 border-b">
            <TabsList className="w-full">
              <TabsTrigger value="cards" className="flex-1">Cards</TabsTrigger>
              <TabsTrigger value="create" className="flex-1">Create New Card</TabsTrigger>
              <TabsTrigger value="upload" className="flex-1">Upload Notes</TabsTrigger>
            </TabsList>
          </div>
          
          <TabsContent value="cards" className="p-6 space-y-6">
            {deck.flashcards.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <BookOpen className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium mb-2">No Flashcards Yet</h3>
                <p className="max-w-sm mx-auto">
                  This deck doesn't have any flashcards yet. Go to the "Create New Card" tab to add some.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {deck.flashcards.map((card) => (
                  <div 
                    key={card.id}
                    className="border rounded-lg p-4 hover:bg-muted/20 transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <div className="space-y-3 flex-1">
                        <div>
                          <h4 className="font-medium">Question</h4>
                          <p>{card.front}</p>
                        </div>
                        <div>
                          <h4 className="font-medium">Answer</h4>
                          <p>{card.back}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleStartEdit(card)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleDeleteFlashcard(card.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="create" className="p-6">
            {editMode ? (
              <div className="space-y-4">
                <h3 className="font-medium">Edit Flashcard</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-front">Question</Label>
                    <Textarea
                      id="edit-front"
                      placeholder="Enter the question"
                      value={editCardFront}
                      onChange={(e) => setEditCardFront(e.target.value)}
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-back">Answer</Label>
                    <Textarea
                      id="edit-back"
                      placeholder="Enter the answer"
                      value={editCardBack}
                      onChange={(e) => setEditCardBack(e.target.value)}
                      rows={5}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      onClick={() => setEditMode(false)}
                    >
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleSaveEdit}
                      disabled={!editCardFront.trim() || !editCardBack.trim()}
                    >
                      <Save className="mr-2 h-4 w-4" /> Save Changes
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <h3 className="font-medium">Create New Flashcard</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="card-front">Question</Label>
                    <Textarea
                      id="card-front"
                      placeholder="Enter the question"
                      value={newCardFront}
                      onChange={(e) => setNewCardFront(e.target.value)}
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="card-back">Answer</Label>
                    <Textarea
                      id="card-back"
                      placeholder="Enter the answer"
                      value={newCardBack}
                      onChange={(e) => setNewCardBack(e.target.value)}
                      rows={5}
                    />
                  </div>
                  <Button 
                    className="w-full"
                    onClick={handleCreateFlashcard}
                    disabled={!newCardFront.trim() || !newCardBack.trim()}
                  >
                    <Plus className="mr-2 h-4 w-4" /> Add Flashcard
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="upload" className="p-6">
            <UploadNotesSection onFlashcardsGenerated={onAddGeneratedFlashcards} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default FlashcardDetail;
