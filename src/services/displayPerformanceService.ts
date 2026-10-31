import AsyncStorage from '@react-native-async-storage/async-storage';

export type DisplayRefreshRate = 60 | 90 | 120 | 144;

export interface DisplayPerformanceMetrics {
  refreshRate: DisplayRefreshRate;
  fps: number;
  frameBudgetMs: number;
  scrollEventThrottle: number;
  isHighRefreshRateSupported: boolean;
  isCalibrated: boolean;
  sampleCount: number;
  jitterMs: number;
}

export interface PerformanceProfileReport {
  actionName: string;
  durationMs: number;
  totalFrames: number;
  targetFps: number;
  actualFps: number;
  droppedFrames: number;
  jankPercentage: number;
  averageFrameTimeMs: number;
  maxFrameTimeMs: number;
  smoothnessRating: 'Ultra Smooth (90-120Hz)' | 'Smooth (60Hz)' | 'Minor Stutter' | 'Janky';
}

const STORAGE_KEY = '@axiombyte_display_performance_v1';
const DEFAULT_REFRESH_RATE: DisplayRefreshRate = 60;
const SAMPLE_FRAME_BURST = 35; // 35 frames is ~300ms at 120Hz, ~580ms at 60Hz: unobtrusive and instant

class DisplayPerformanceService {
  private currentMetrics: DisplayPerformanceMetrics = {
    refreshRate: DEFAULT_REFRESH_RATE,
    fps: 60,
    frameBudgetMs: 16.67,
    scrollEventThrottle: 16,
    isHighRefreshRateSupported: false,
    isCalibrated: false,
    sampleCount: 0,
    jitterMs: 0,
  };

  private listeners: Set<(metrics: DisplayPerformanceMetrics) => void> = new Set();
  private isCalibrating = false;
  private hasInitialized = false;

  constructor() {
    this.loadCachedMetrics();
  }

  /**
   * Fast load of cached display capabilities from storage
   */
  private async loadCachedMetrics(): Promise<void> {
    try {
      const cached = await AsyncStorage.getItem(STORAGE_KEY);
      if (cached) {
        const parsed: DisplayPerformanceMetrics = JSON.parse(cached);
        this.currentMetrics = {
          ...parsed,
          isCalibrated: true,
        };
        this.notifyListeners();
      }
    } catch {
      // Fallback to default
    }
  }

  /**
   * Detect and calibrate the active hardware display refresh rate.
   * Runs non-blocking frame delta measurements using high-precision performance.now().
   * Discards garbage collection outliers and warm-up frames for maximum accuracy.
   */
  public async calibrateDisplayRefreshRate(forceRecalibration = false): Promise<DisplayPerformanceMetrics> {
    if (this.isCalibrating) {
      return this.currentMetrics;
    }

    if (this.currentMetrics.isCalibrated && !forceRecalibration && this.hasInitialized) {
      return this.currentMetrics;
    }

    this.isCalibrating = true;
    this.hasInitialized = true;

    return new Promise((resolve) => {
      // In web/SSR or headless environments, fallback safely
      if (typeof requestAnimationFrame === 'undefined') {
        this.finalizeMetrics(60, 0, resolve);
        return;
      }

      const frameTimes: number[] = [];
      let frameCount = 0;
      let lastTimestamp = typeof performance !== 'undefined' ? performance.now() : Date.now();

      const sampleFrame = (now: number) => {
        const currentNow = typeof performance !== 'undefined' ? performance.now() : now;
        const delta = currentNow - lastTimestamp;
        lastTimestamp = currentNow;

        // Skip the very first 3 frames to allow GPU / layout queue to warm up
        if (frameCount > 3 && delta > 4 && delta < 100) {
          frameTimes.push(delta);
        }

        frameCount++;

        if (frameTimes.length < SAMPLE_FRAME_BURST) {
          requestAnimationFrame(sampleFrame);
        } else {
          // Analyze frame intervals
          // 1. Sort to compute median and interquartile range (discarding outliers)
          frameTimes.sort((a, b) => a - b);
          
          // Discard top 10% and bottom 10% to eliminate GC pauses and vsync skips
          const trimCount = Math.floor(frameTimes.length * 0.1);
          const cleanFrames = frameTimes.slice(trimCount, frameTimes.length - trimCount);

          if (cleanFrames.length === 0) {
            this.finalizeMetrics(60, 0, resolve);
            return;
          }

          const sum = cleanFrames.reduce((acc, val) => acc + val, 0);
          const averageDelta = sum / cleanFrames.length;

          // Compute jitter (standard deviation)
          const variance = cleanFrames.reduce((acc, val) => acc + Math.pow(val - averageDelta, 2), 0) / cleanFrames.length;
          const jitter = Math.sqrt(variance);

          // Map average delta to discrete display refresh rates
          let detectedRate: DisplayRefreshRate = 60;
          if (averageDelta <= 7.8) {
            detectedRate = 144;
          } else if (averageDelta <= 9.6) {
            detectedRate = 120;
          } else if (averageDelta <= 13.8) {
            detectedRate = 90;
          } else {
            detectedRate = 60;
          }

          this.finalizeMetrics(detectedRate, jitter, resolve);
        }
      };

      requestAnimationFrame(sampleFrame);
    });
  }

  private finalizeMetrics(
    refreshRate: DisplayRefreshRate,
    jitterMs: number,
    resolve: (metrics: DisplayPerformanceMetrics) => void
  ) {
    const frameBudgetMs = Number((1000 / refreshRate).toFixed(2));
    
    // Optimal scroll event throttle according to display vsync:
    // 120Hz/144Hz: 8ms throttle matches 120fps physics
    // 90Hz: 11ms matches 90fps
    // 60Hz: 16ms matches 60fps
    const scrollEventThrottle = refreshRate >= 120 ? 8 : refreshRate >= 90 ? 11 : 16;
    const isHighRefreshRateSupported = refreshRate >= 90;

    this.currentMetrics = {
      refreshRate,
      fps: refreshRate,
      frameBudgetMs,
      scrollEventThrottle,
      isHighRefreshRateSupported,
      isCalibrated: true,
      sampleCount: SAMPLE_FRAME_BURST,
      jitterMs: Number(jitterMs.toFixed(2)),
    };

    this.isCalibrating = false;

    // Cache persistently for instant next app boot
    try {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.currentMetrics));
    } catch {
      // Ignore storage errors
    }

    this.notifyListeners();
    resolve(this.currentMetrics);
  }

  /**
   * Real-time Performance Profiler
   * Profiles rendering smoothness and frame stability during active operations (scrolling, transitions, interactions).
   */
  public async profilePerformance(actionName: string, durationMs = 1200): Promise<PerformanceProfileReport> {
    return new Promise((resolve) => {
      const targetRate = this.currentMetrics.refreshRate;
      const budgetMs = this.currentMetrics.frameBudgetMs;
      // Any frame that takes longer than 1.45x budget dropped a vsync tick
      const jankThresholdMs = budgetMs * 1.45;

      const frameTimes: number[] = [];
      let startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
      let lastTime = startTime;
      let isDone = false;

      const onFrame = (now: number) => {
        if (isDone) return;

        const currentNow = typeof performance !== 'undefined' ? performance.now() : now;
        const delta = currentNow - lastTime;
        lastTime = currentNow;

        if (delta > 2) {
          frameTimes.push(delta);
        }

        const elapsed = currentNow - startTime;
        if (elapsed < durationMs) {
          requestAnimationFrame(onFrame);
        } else {
          isDone = true;
          const totalFrames = frameTimes.length;
          if (totalFrames === 0) {
            resolve({
              actionName,
              durationMs,
              totalFrames: 0,
              targetFps: targetRate,
              actualFps: targetRate,
              droppedFrames: 0,
              jankPercentage: 0,
              averageFrameTimeMs: budgetMs,
              maxFrameTimeMs: budgetMs,
              smoothnessRating: targetRate >= 90 ? 'Ultra Smooth (90-120Hz)' : 'Smooth (60Hz)',
            });
            return;
          }

          let droppedFrames = 0;
          let maxDelta = 0;
          let totalDelta = 0;

          for (const d of frameTimes) {
            totalDelta += d;
            if (d > maxDelta) maxDelta = d;
            if (d > jankThresholdMs) {
              droppedFrames++;
            }
          }

          const averageFrameTimeMs = Number((totalDelta / totalFrames).toFixed(2));
          const actualFps = Math.min(
            targetRate,
            Math.round(1000 / (averageFrameTimeMs || budgetMs))
          );
          const jankPercentage = Number(((droppedFrames / totalFrames) * 100).toFixed(1));

          let smoothnessRating: PerformanceProfileReport['smoothnessRating'] = 'Smooth (60Hz)';
          if (targetRate >= 90 && jankPercentage < 6) {
            smoothnessRating = 'Ultra Smooth (90-120Hz)';
          } else if (jankPercentage < 10) {
            smoothnessRating = 'Smooth (60Hz)';
          } else if (jankPercentage < 22) {
            smoothnessRating = 'Minor Stutter';
          } else {
            smoothnessRating = 'Janky';
          }

          resolve({
            actionName,
            durationMs: Math.round(elapsed),
            totalFrames,
            targetFps: targetRate,
            actualFps,
            droppedFrames,
            jankPercentage,
            averageFrameTimeMs,
            maxFrameTimeMs: Number(maxDelta.toFixed(2)),
            smoothnessRating,
          });
        }
      };

      requestAnimationFrame(onFrame);
    });
  }

  /**
   * Synchronous getter for current performance metrics
   */
  public getMetrics(): DisplayPerformanceMetrics {
    return this.currentMetrics;
  }

  /**
   * Subscribe to metrics updates
   */
  public subscribe(listener: (metrics: DisplayPerformanceMetrics) => void): () => void {
    this.listeners.add(listener);
    listener(this.currentMetrics);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => {
      try {
        listener(this.currentMetrics);
      } catch {
        // Safe isolation
      }
    });
  }
}

export const displayPerformance = new DisplayPerformanceService();

