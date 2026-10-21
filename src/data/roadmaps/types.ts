import { Ionicons } from '@expo/vector-icons';
import { AppTab } from '@/components/BottomNavBar';

export interface RoadmapTopic {
  id: string;
  title: string;
  duration: string;
  links: string; // e.g. "/c/c_ch_intro/c_apps"
  tag?: string;
  summary?: string;
  explanation?: string;
  codeSnippet?: string;
  howItWorks?: string[];
  output?: string;
  relatedTab?: AppTab;
  relatedLabId?: string;
}

// Backward-compatible alias
export type Lesson = RoadmapTopic;

export interface RoadmapChapter {
  id: string;
  title: string;
  description?: string;
  topics: RoadmapTopic[];
}

export interface LanguageRoadmap {
  id: string;
  name: string;
  badge: string;
  color: string;
  icon: keyof typeof Ionicons.glyphMap | string;
  description: string;
  status: 'published' | 'draft' | string;
  order?: number;
  targetTab?: AppTab;
  chapters?: RoadmapChapter[];
  lessons?: RoadmapTopic[];
}

export interface LanguageProgress {
  completed: number;
  total: number;
  percent: number;
  isCompleted: boolean;
}

export interface CodeLabModalData {
  codeId: string;
  title?: string;
  language?: string;
  code: string;
  output: string;
  howItWorks: string[];
}
