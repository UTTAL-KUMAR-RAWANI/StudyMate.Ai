
export interface Flashcard {
  id: string;
  front: string;
  back: string;
  subject: string;
}

export interface FlashcardDeck {
  id: string;
  name: string;
  subject: string;
  totalCards: number;
  flashcards: Flashcard[];
}

export interface UploadedFile {
  name: string;
  size: number;
  type: string;
  content?: string; // For text content extracted from PDF
}
