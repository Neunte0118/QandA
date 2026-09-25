export type QuizMode = 'order' | 'shuffle' | 'incorrect_only';

export interface QuizCategory {
  id: string; // quizId
  title: string;
  url: string;
  isEncrypted?: boolean;
  decryptionKey?: string;
  rawTitle?: string;
  rawId?: string;
}

export interface QuizQuestion {
  id: string; // questionId
  rawId?: string; // encrypted ID or original ID before decryption
  question: string;
  answer: string;
  importance: string;
  isEncrypted?: boolean;
}

export interface QuizStats {
  quizId: string;
  shown: number;
}

export interface QuestionStats {
  quizId: string;
  questionId: string;
  answered: number;
  correct: number;
  lastShown: number;
}
