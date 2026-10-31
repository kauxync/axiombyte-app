import { useState, useEffect } from 'react';
import {
  displayPerformance,
  DisplayPerformanceMetrics,
  PerformanceProfileReport,
} from '@/services/displayPerformanceService';

export function useDisplayPerformance() {
  const [metrics, setMetrics] = useState<DisplayPerformanceMetrics>(() =>
    displayPerformance.getMetrics()
  );

  useEffect(() => {
    // 1. Subscribe to performance metrics changes
    const unsubscribe = displayPerformance.subscribe((newMetrics) => {
      setMetrics(newMetrics);
    });

    // 2. Perform non-blocking calibration burst on mount if not yet calibrated
    if (!metrics.isCalibrated) {
      displayPerformance.calibrateDisplayRefreshRate().catch(() => {});
    }

    return unsubscribe;
  }, [metrics.isCalibrated]);

  const profileAction = async (actionName: string, durationMs?: number): Promise<PerformanceProfileReport> => {
    return displayPerformance.profilePerformance(actionName, durationMs);
  };

  const forceRecalibrate = async () => {
    return displayPerformance.calibrateDisplayRefreshRate(true);
  };

  return {
    ...metrics,
    profileAction,
    forceRecalibrate,
  };
}

