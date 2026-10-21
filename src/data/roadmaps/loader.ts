import { LanguageRoadmap } from './types';

/**
 * Returns empty array. All language roadmaps are delivered dynamically via Web API & AsyncStorage cache.
 */
export function getPublishedSeedRoadmaps(): LanguageRoadmap[] {
  return [];
}
