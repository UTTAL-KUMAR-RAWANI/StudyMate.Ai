
import React, { useState, useEffect } from 'react';
import { FlashcardDeck } from './flashcard/types';
import FlashcardDeckList from './flashcard/FlashcardDeckList';
import FlashcardDetail from './flashcard/FlashcardDetail';
import FlashcardStudyMode from './flashcard/FlashcardStudyMode';
import EmptyDeckState from './flashcard/EmptyDeckState';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';

const FlashcardGenerator = () => {
  const [decks, setDecks] = useState<FlashcardDeck[]>([]);
  const [selectedDeck, setSelectedDeck] = useState<FlashcardDeck | null>(null);
  const [studyMode, setStudyMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Fetch flashcard decks from the database
  useEffect(() => {
    const fetchDecks = async () => {
      if (!user) return;
      
      try {
        setLoading(true);
        const { data: decksData, error: decksError } = await supabase
          .from('flashcard_decks')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        
        if (decksError) throw decksError;
        
        // Fetch flashcards for each deck
        const decksWithCards: FlashcardDeck[] = [];
        
        for (const deck of decksData || []) {
          const { data: flashcardsData, error: flashcardsError } = await supabase
            .from('flashcards')
            .select('*')
            .eq('deck_id', deck.id);
          
          if (flashcardsError) throw flashcardsError;
          
          decksWithCards.push({
            id: deck.id,
            name: deck.name,
            subject: deck.subject,
            totalCards: flashcardsData?.length || 0,
            flashcards: flashcardsData?.map(card => ({
              id: card.id,
              front: card.front,
              back: card.back,
              subject: deck.subject,
            })) || [],
          });
        }
        
        setDecks(decksWithCards);
        
        // If we have decks and no deck is selected, select the first one
        if (decksWithCards.length > 0 && !selectedDeck) {
          setSelectedDeck(decksWithCards[0]);
        }
      } catch (error: any) {
        console.error('Error fetching flashcard decks:', error);
        toast({
          title: 'Error loading flashcards',
          description: error.message,
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchDecks();
  }, [user, toast]);
  
  // Create a new deck
  const handleCreateDeck = async (name: string, subject: string) => {
    if (!user) return;
    
    try {
      // Insert the new deck into the database
      const { data, error } = await supabase
        .from('flashcard_decks')
        .insert({
          name,
          subject,
          user_id: user.id,
        })
        .select('*')
        .single();
      
      if (error) throw error;
      
      // Add the new deck to the state
      const newDeck: FlashcardDeck = {
        id: data.id,
        name: data.name,
        subject: data.subject,
        totalCards: 0,
        flashcards: [],
      };
      
      setDecks([newDeck, ...decks]);
      setSelectedDeck(newDeck);
      
      toast({
        title: 'Deck created',
        description: `Deck "${name}" has been created.`,
      });
    } catch (error: any) {
      console.error('Error creating deck:', error);
      toast({
        title: 'Error creating deck',
        description: error.message,
        variant: 'destructive',
      });
    }
  };
  
  // Update deck
  const handleUpdateDeck = async (updatedDeck: FlashcardDeck) => {
    try {
      // Find the cards that were added, updated, or deleted
      const originalDeck = decks.find(deck => deck.id === updatedDeck.id);
      
      if (!originalDeck) return;
      
      // Handle new cards (cards in updatedDeck but not in originalDeck)
      const newCards = updatedDeck.flashcards.filter(
        card => !originalDeck.flashcards.some(origCard => origCard.id === card.id)
      );
      
      // Handle deleted cards (cards in originalDeck but not in updatedDeck)
      const deletedCardIds = originalDeck.flashcards
        .filter(origCard => !updatedDeck.flashcards.some(card => card.id === origCard.id))
        .map(card => card.id);
      
      // Handle updated cards (cards in both, but content might have changed)
      const updatedCards = updatedDeck.flashcards.filter(
        card => originalDeck.flashcards.some(origCard => origCard.id === card.id && 
          (origCard.front !== card.front || origCard.back !== card.back))
      );
      
      // Insert new cards
      if (newCards.length > 0) {
        const { error: insertError } = await supabase
          .from('flashcards')
          .insert(
            newCards.map(card => ({
              deck_id: updatedDeck.id,
              front: card.front,
              back: card.back,
            }))
          );
        
        if (insertError) throw insertError;
      }
      
      // Delete removed cards
      if (deletedCardIds.length > 0) {
        const { error: deleteError } = await supabase
          .from('flashcards')
          .delete()
          .in('id', deletedCardIds);
        
        if (deleteError) throw deleteError;
      }
      
      // Update modified cards
      for (const card of updatedCards) {
        const { error: updateError } = await supabase
          .from('flashcards')
          .update({
            front: card.front,
            back: card.back,
          })
          .eq('id', card.id);
        
        if (updateError) throw updateError;
      }
      
      // Update the deck in state
      setDecks(decks.map(deck => deck.id === updatedDeck.id ? updatedDeck : deck));
      setSelectedDeck(updatedDeck);
      
      toast({
        title: 'Deck updated',
        description: `Deck "${updatedDeck.name}" has been updated.`,
      });
    } catch (error: any) {
      console.error('Error updating deck:', error);
      toast({
        title: 'Error updating deck',
        description: error.message,
        variant: 'destructive',
      });
    }
  };
  
  // Add generated flashcards to the current deck
  const handleAddGeneratedFlashcards = async (generatedFlashcards: {front: string; back: string}[]) => {
    if (!selectedDeck || generatedFlashcards.length === 0 || !user) return;
    
    try {
      // Insert the new flashcards into the database
      const { data, error } = await supabase
        .from('flashcards')
        .insert(
          generatedFlashcards.map(card => ({
            deck_id: selectedDeck.id,
            front: card.front,
            back: card.back,
          }))
        )
        .select('*');
      
      if (error) throw error;
      
      // Convert the new flashcards to our app format
      const newFlashcards = data.map(card => ({
        id: card.id,
        front: card.front,
        back: card.back,
        subject: selectedDeck.subject,
      }));
      
      // Update the selected deck
      const updatedDeck = {
        ...selectedDeck,
        totalCards: selectedDeck.totalCards + newFlashcards.length,
        flashcards: [...selectedDeck.flashcards, ...newFlashcards],
      };
      
      handleUpdateDeck(updatedDeck);
      
      toast({
        title: 'Flashcards added',
        description: `${newFlashcards.length} flashcards have been added to "${selectedDeck.name}".`,
      });
    } catch (error: any) {
      console.error('Error adding generated flashcards:', error);
      toast({
        title: 'Error adding flashcards',
        description: error.message,
        variant: 'destructive',
      });
    }
  };
  
  const enterStudyMode = () => {
    setStudyMode(true);
  };
  
  const exitStudyMode = () => {
    setStudyMode(false);
  };
  
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight">Flashcard Generator</h1>
        <p className="text-muted-foreground">Create and study flashcards to enhance your learning.</p>
      </div>
      
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="flex flex-col items-center">
            <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
            <p className="text-muted-foreground">Loading flashcards...</p>
          </div>
        </div>
      ) : studyMode && selectedDeck ? (
        <FlashcardStudyMode 
          deck={selectedDeck} 
          onExit={exitStudyMode} 
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <FlashcardDeckList 
            decks={decks}
            selectedDeck={selectedDeck}
            onSelectDeck={setSelectedDeck}
            onCreateDeck={handleCreateDeck}
          />
          
          {selectedDeck ? (
            <FlashcardDetail 
              deck={selectedDeck}
              onStudy={enterStudyMode}
              onUpdateDeck={handleUpdateDeck}
              onAddGeneratedFlashcards={handleAddGeneratedFlashcards}
            />
          ) : (
            <EmptyDeckState />
          )}
        </div>
      )}
    </div>
  );
};

export default FlashcardGenerator;
