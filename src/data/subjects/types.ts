import { AppTab } from '@/components/BottomNavBar';
import { Ionicons } from '@expo/vector-icons';

export interface SubjectTopic {
  id: string;
  title: string;
  category?: 'logic' | 'sets' | 'induction' | 'graphs' | 'complexity' | 'automata' | 'arch' | 'os' | string;
  latexFormula: string;
  definition: string;
  keyProperties: string[];
  example: string;
  isInteractiveLogic?: boolean;
  links?: string;
  duration?: string;
}

// Backwards-compatible alias for existing codebase
export type MathTopic = SubjectTopic;

export interface SubjectChapter {
  id: string;
  title: string;
  description?: string;
  topics: SubjectTopic[];
}

export interface SubjectItem {
  id: string;
  name: string;
  badge: string;
  color: string;
  icon: keyof typeof Ionicons.glyphMap | string;
  description: string;
  status: 'published' | 'draft' | string;
  order?: number;
  estHours?: string;
  targetTab?: AppTab;
  chapters: SubjectChapter[];
  topics: SubjectTopic[];
}

// Backwards-compatible alias
export type SubjectCurriculum = SubjectItem;
