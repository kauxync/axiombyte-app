import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, BackHandler, Platform, ToastAndroid } from 'react-native';
import { useAppTheme } from '@/context/ThemeContext';
import { BottomNavBar, AppTab } from './BottomNavBar';
import { HomeDashboardView } from './HomeDashboardView';
import { RoadmapsView } from './RoadmapsView';
import { SubjectsNotesView } from './SubjectsNotesView';
import { ProfilePage } from './ProfilePage';
import { LeaderboardView } from './LeaderboardView';

export function MainAppLayout() {
  const { colors } = useAppTheme();

  // Navigation History Stack: tracks visited pages in order
  const [tabStack, setTabStack] = useState<AppTab[]>(['home']);
  const [navParams, setNavParams] = useState<{
    roadmaps?: { languageId?: string; topicId?: string };
    subjects?: { subjectId?: string; topicId?: string };
  }>({});
  const lastBackPressRef = useRef<number>(0);

  const activeTab = tabStack[tabStack.length - 1] || 'home';
  const canGoBack = tabStack.length > 1;

  // Navigate to a new tab (pushes to history stack) with optional target entity params
  const navigateToTab = (
    tab: AppTab,
    params?: { languageId?: string; subjectId?: string; topicId?: string }
  ) => {
    if (params) {
      if (tab === 'roadmaps') {
        setNavParams((prev) => ({
          ...prev,
          roadmaps: { languageId: params.languageId, topicId: params.topicId },
        }));
      } else if (tab === 'math') {
        setNavParams((prev) => ({
          ...prev,
          subjects: { subjectId: params.subjectId, topicId: params.topicId },
        }));
      }
    }
    setTabStack((prev) => {
      // Do not duplicate if already on that tab unless params were passed
      if (prev[prev.length - 1] === tab) {
        return params ? [...prev] : prev;
      }
      return [...prev, tab];
    });
  };

  // Pop back to the previous tab in history
  const handleGoBack = () => {
    setTabStack((prev) => {
      if (prev.length <= 1) return prev;
      return prev.slice(0, prev.length - 1);
    });
  };

  // Hardware Back Button (Android & Gesture Navigation)
  useEffect(() => {
    const onBackPress = () => {
      // 1. If we have previous pages in the history stack, follow them back!
      if (tabStack.length > 1) {
        setTabStack((prev) => prev.slice(0, prev.length - 1));
        return true; // Handled! Do not close app!
      }

      // 2. We are at root 'home': double tap within 2s to exit safely
      const now = Date.now();
      if (lastBackPressRef.current && now - lastBackPressRef.current < 2000) {
        BackHandler.exitApp();
        return true;
      }

      lastBackPressRef.current = now;
      if (Platform.OS === 'android') {
        ToastAndroid.show('Press back again to exit', ToastAndroid.SHORT);
      }
      return true; // Handled! Do not close app!
    };

    const backSub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backSub.remove();
  }, [tabStack]);

  const renderActiveScreen = () => {
    switch (activeTab) {
      case 'home':
        return <HomeDashboardView onNavigateTab={navigateToTab} />;
      case 'roadmaps':
        return (
          <RoadmapsView
            key={`roadmaps-${navParams.roadmaps?.languageId || 'root'}-${navParams.roadmaps?.topicId || 'all'}`}
            onNavigateTab={navigateToTab}
            initialLanguageId={navParams.roadmaps?.languageId}
            initialTopicId={navParams.roadmaps?.topicId}
            onGoBack={handleGoBack}
            canGoBack={canGoBack}
          />
        );
      case 'math':
        return (
          <SubjectsNotesView
            key={`math-${navParams.subjects?.subjectId || 'root'}-${navParams.subjects?.topicId || 'all'}`}
            initialSubjectId={navParams.subjects?.subjectId}
            initialTopicId={navParams.subjects?.topicId}
            onGoBack={handleGoBack}
            canGoBack={canGoBack}
          />
        );
      case 'leaderboard':
        return (
          <LeaderboardView
            onGoBack={handleGoBack}
            canGoBack={canGoBack}
          />
        );
      case 'profile':
        return (
          <ProfilePage
            onGoBack={handleGoBack}
            canGoBack={canGoBack}
          />
        );
      default:
        return <HomeDashboardView onNavigateTab={navigateToTab} />;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Screen Content Container */}
      <View style={styles.content}>
        {renderActiveScreen()}
      </View>

      {/* Persistent Bottom Navigation Bar */}
      <BottomNavBar
        activeTab={activeTab}
        onTabChange={navigateToTab}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
});
