export interface QuizCategory {
  id: string; // quizId
  title: string;
  url: string;
}

export interface QuizQuestion {
  id: string; // questionId
  question: string;
  answer: string;
  importance: string;
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
