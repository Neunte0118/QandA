export type QuizMode = 'order' | 'shuffle' | 'incorrect_only';

export interface QuizCategory {
  id: string; // quizId / title_id
  titleId?: string; // explicit title_id
  title: string;
  url: string;
  hash?: string; // hash for cache freshness comparison
  isEncrypted?: boolean;
  decryptionKey?: string;
  rawTitle?: string;
  rawId?: string;
}

export interface TagDetail {
  category: string; // 大分類 (例: '国', '時代', '分野')
  tag: string;      // タグ名 (例: 'イタリア', '近代')
  count?: number;
}

export interface QuizQuestion {
  id: string; // {title_id}-{question_id}
  rawId?: string; // encrypted ID or original ID before decryption
  questionId?: string; // original question_id
  titleId?: string; // title_id
  question: string;
  answer: string;
  importance: string;
  tags?: string[];
  tagDetails?: TagDetail[];
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
