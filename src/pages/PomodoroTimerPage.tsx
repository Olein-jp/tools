import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Coffee,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Volume2,
  VolumeX
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Seo } from '../seo/Seo';
import { PAGE_SEO } from '../seo/meta';

const STORAGE_KEY = 'olein-tools:pomodoro-timer:v1';
const WORK_PRESETS = [5, 10, 25, 50] as const;
const BREAK_PRESETS = [5, 10] as const;
const MIN_WORK_MINUTES = 1;
const MAX_WORK_MINUTES = 180;
const MIN_BREAK_MINUTES = 1;
const MAX_BREAK_MINUTES = 60;
const MIN_CYCLES = 1;
const MAX_CYCLES = 99;
const SECOND_MARK_COUNT = 60;

type TimerSettings = {
  workDurationMinutes: number;
  breakDurationMinutes: number;
  cycles: number;
  soundEnabled: boolean;
};

type Mode = 'idle' | 'work' | 'break' | 'paused' | 'completed';
type PhaseMode = Extract<Mode, 'work' | 'break'>;
type NotificationKind = 'work-progress' | 'work-5min' | 'work-end' | 'break-end';
type UiStage = 'settings' | 'timer';

type NotificationState = {
  lastWorkElapsedNotificationMinute: number | null;
  notifiedWork5MinLeft: boolean;
  notifiedWorkEnd: boolean;
  notifiedBreakEnd: boolean;
};

type SessionState = NotificationState & {
  mode: Mode;
  previousMode: PhaseMode | null;
  currentCycle: number;
  totalCycles: number;
  phaseDurationSeconds: number;
  remainingSeconds: number;
  phaseStartedAtMs: number | null;
  startedAt: string | null;
  pausedAt: string | null;
  pauseRemainingSeconds: number | null;
};

type ValidationResult = {
  workDurationMinutes: number | null;
  breakDurationMinutes: number | null;
  cycles: number | null;
  errors: {
    work: string | null;
    break: string | null;
    cycles: string | null;
  };
};

type StoredSettings = Partial<TimerSettings>;

const DEFAULT_SETTINGS: TimerSettings = {
  workDurationMinutes: 25,
  breakDurationMinutes: 5,
  cycles: 4,
  soundEnabled: true
};

const emptyNotifications = (): NotificationState => ({
  lastWorkElapsedNotificationMinute: null,
  notifiedWork5MinLeft: false,
  notifiedWorkEnd: false,
  notifiedBreakEnd: false
});

const createIdleSession = (settings: TimerSettings): SessionState => ({
  mode: 'idle',
  previousMode: null,
  currentCycle: 1,
  totalCycles: settings.cycles,
  phaseDurationSeconds: settings.workDurationMinutes * 60,
  remainingSeconds: settings.workDurationMinutes * 60,
  phaseStartedAtMs: null,
  startedAt: null,
  pausedAt: null,
  pauseRemainingSeconds: null,
  ...emptyNotifications()
});

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeStoredSettings(value: unknown): TimerSettings {
  if (!value || typeof value !== 'object') {
    return DEFAULT_SETTINGS;
  }

  const stored = value as StoredSettings;

  return {
    workDurationMinutes: Number.isInteger(stored.workDurationMinutes)
      ? clampNumber(stored.workDurationMinutes as number, MIN_WORK_MINUTES, MAX_WORK_MINUTES)
      : DEFAULT_SETTINGS.workDurationMinutes,
    breakDurationMinutes: Number.isInteger(stored.breakDurationMinutes)
      ? clampNumber(stored.breakDurationMinutes as number, MIN_BREAK_MINUTES, MAX_BREAK_MINUTES)
      : DEFAULT_SETTINGS.breakDurationMinutes,
    cycles: Number.isInteger(stored.cycles)
      ? clampNumber(stored.cycles as number, MIN_CYCLES, MAX_CYCLES)
      : DEFAULT_SETTINGS.cycles,
    soundEnabled: typeof stored.soundEnabled === 'boolean' ? stored.soundEnabled : DEFAULT_SETTINGS.soundEnabled
  };
}

function loadSettings(): TimerSettings {
  if (typeof window === 'undefined') {
    return DEFAULT_SETTINGS;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return DEFAULT_SETTINGS;
    }

    return normalizeStoredSettings(JSON.parse(raw));
  } catch (error) {
    console.error('ポモドーロ設定の読み込みに失敗しました。', error);
    return DEFAULT_SETTINGS;
  }
}

function getInitialCustomValue(value: number, presets: readonly number[]): string {
  return presets.some((preset) => preset === value) ? '' : String(value);
}

function parseMinutes(input: string): number | null {
  if (input.trim() === '') {
    return null;
  }

  if (!/^\d+$/.test(input.trim())) {
    return Number.NaN;
  }

  return Number(input.trim());
}

function parseCycles(input: string): number | null {
  if (!/^\d+$/.test(input.trim())) {
    return Number.NaN;
  }

  return Number(input.trim());
}

function validateInputs(params: {
  workPreset: number | null;
  workCustom: string;
  breakPreset: number | null;
  breakCustom: string;
  cyclesInput: string;
}): ValidationResult {
  let workDurationMinutes: number | null = params.workPreset;
  let breakDurationMinutes: number | null = params.breakPreset;
  let cycles: number | null = null;
  let workError: string | null = null;
  let breakError: string | null = null;
  let cyclesError: string | null = null;

  if (params.workCustom.trim() !== '') {
    const parsed = parseMinutes(params.workCustom);
    if (parsed === null || Number.isNaN(parsed)) {
      workError = '作業時間は数値で入力してください。';
    } else if (parsed < MIN_WORK_MINUTES || parsed > MAX_WORK_MINUTES) {
      workError = `作業時間は ${MIN_WORK_MINUTES}〜${MAX_WORK_MINUTES} 分で入力してください。`;
    } else {
      workDurationMinutes = parsed;
    }
  } else if (workDurationMinutes === null) {
    workError = '作業時間を選択または入力してください。';
  }

  if (params.breakCustom.trim() !== '') {
    const parsed = parseMinutes(params.breakCustom);
    if (parsed === null || Number.isNaN(parsed)) {
      breakError = '休憩時間は数値で入力してください。';
    } else if (parsed < MIN_BREAK_MINUTES || parsed > MAX_BREAK_MINUTES) {
      breakError = `休憩時間は ${MIN_BREAK_MINUTES}〜${MAX_BREAK_MINUTES} 分で入力してください。`;
    } else {
      breakDurationMinutes = parsed;
    }
  } else if (breakDurationMinutes === null) {
    breakError = '休憩時間を選択または入力してください。';
  }

  const parsedCycles = parseCycles(params.cyclesInput);
  if (parsedCycles === null || Number.isNaN(parsedCycles)) {
    cyclesError = '繰り返し回数は数値で入力してください。';
  } else if (parsedCycles < MIN_CYCLES || parsedCycles > MAX_CYCLES) {
    cyclesError = `繰り返し回数は ${MIN_CYCLES}〜${MAX_CYCLES} 回で指定してください。`;
  } else {
    cycles = parsedCycles;
  }

  return {
    workDurationMinutes,
    breakDurationMinutes,
    cycles,
    errors: {
      work: workError,
      break: breakError,
      cycles: cyclesError
    }
  };
}

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secondsInMinute = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(secondsInMinute).padStart(2, '0')}`;
}

function getModeLabel(mode: Mode, previousMode: PhaseMode | null): string {
  if (mode === 'paused') {
    return previousMode === 'break' ? '一時停止中（休憩）' : '一時停止中（作業）';
  }

  switch (mode) {
    case 'idle':
      return '待機中';
    case 'work':
      return '作業中';
    case 'break':
      return '休憩中';
    case 'completed':
      return '完了';
    default:
      return '待機中';
  }
}

function getModeAccent(mode: Mode, previousMode: PhaseMode | null): string {
  const resolvedMode = mode === 'paused' ? previousMode : mode;

  if (resolvedMode === 'break') {
    return 'text-emerald-300';
  }

  if (mode === 'completed') {
    return 'text-amber-300';
  }

  return 'text-rose-300';
}

function getPhaseSummary(mode: Mode, currentCycle: number, totalCycles: number): string {
  if (mode === 'completed') {
    return `${totalCycles} サイクル完了`;
  }

  return `現在 ${currentCycle} / ${totalCycles} サイクル`;
}

function createPhaseSession(
  mode: PhaseMode,
  durationSeconds: number,
  totalCycles: number,
  currentCycle: number
): SessionState {
  return {
    mode,
    previousMode: null,
    currentCycle,
    totalCycles,
    phaseDurationSeconds: durationSeconds,
    remainingSeconds: durationSeconds,
    phaseStartedAtMs: Date.now(),
    startedAt: new Date().toISOString(),
    pausedAt: null,
    pauseRemainingSeconds: null,
    ...emptyNotifications()
  };
}

function getTickState(elapsedInMinute: number, index: number): 'passed' | 'current' | 'upcoming' {
  if (index < elapsedInMinute) {
    return 'passed';
  }

  if (index === elapsedInMinute % SECOND_MARK_COUNT) {
    return 'current';
  }

  return 'upcoming';
}

class BrowserAudioManager {
  private context: AudioContext | null = null;

  private unlocked = false;

  private createContext(): AudioContext | null {
    if (this.context) {
      return this.context;
    }

    if (typeof window === 'undefined') {
      return null;
    }

    const AudioContextConstructor =
      window.AudioContext || (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextConstructor) {
      return null;
    }

    this.context = new AudioContextConstructor();
    return this.context;
  }

  async unlock(): Promise<void> {
    const context = this.createContext();
    if (!context) {
      return;
    }

    try {
      if (context.state === 'suspended') {
        await context.resume();
      }
      this.unlocked = true;
    } catch (error) {
      console.error('通知音の初期化に失敗しました。', error);
    }
  }

  async play(kind: NotificationKind): Promise<void> {
    const context = this.createContext();
    if (!context || !this.unlocked) {
      return;
    }

    try {
      if (context.state === 'suspended') {
        await context.resume();
      }

      const now = context.currentTime + 0.01;
      const gain = context.createGain();
      gain.connect(context.destination);

      const patterns: Record<NotificationKind, number[]> = {
        'work-progress': [659.25],
        'work-5min': [523.25, 659.25],
        'work-end': [659.25, 783.99, 987.77],
        'break-end': [440, 554.37, 659.25]
      };

      patterns[kind].forEach((frequency, index) => {
        const startAt = now + index * 0.16;
        const oscillator = context.createOscillator();
        const oscillatorGain = context.createGain();

        oscillator.type = kind === 'work-end' ? 'triangle' : 'sine';
        oscillator.frequency.setValueAtTime(frequency, startAt);

        oscillatorGain.gain.setValueAtTime(0.0001, startAt);
        oscillatorGain.gain.exponentialRampToValueAtTime(0.14, startAt + 0.02);
        oscillatorGain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.14);

        oscillator.connect(oscillatorGain);
        oscillatorGain.connect(gain);
        oscillator.start(startAt);
        oscillator.stop(startAt + 0.16);
      });
    } catch (error) {
      console.error('通知音の再生に失敗しました。', error);
    }
  }
}

const audioManager = new BrowserAudioManager();

export function PomodoroTimerPage() {
  const initialSettings = useMemo(() => loadSettings(), []);
  const [uiStage, setUiStage] = useState<UiStage>('settings');
  const [workPreset, setWorkPreset] = useState<number | null>(
    WORK_PRESETS.some((preset) => preset === initialSettings.workDurationMinutes) ? initialSettings.workDurationMinutes : null
  );
  const [workCustom, setWorkCustom] = useState<string>(getInitialCustomValue(initialSettings.workDurationMinutes, WORK_PRESETS));
  const [breakPreset, setBreakPreset] = useState<number | null>(
    BREAK_PRESETS.some((preset) => preset === initialSettings.breakDurationMinutes) ? initialSettings.breakDurationMinutes : null
  );
  const [breakCustom, setBreakCustom] = useState<string>(getInitialCustomValue(initialSettings.breakDurationMinutes, BREAK_PRESETS));
  const [cyclesInput, setCyclesInput] = useState<string>(String(initialSettings.cycles));
  const [soundEnabled, setSoundEnabled] = useState<boolean>(initialSettings.soundEnabled);
  const [session, setSession] = useState<SessionState>(() => createIdleSession(initialSettings));
  const [bannerMessage, setBannerMessage] = useState<string>('設定を決めたらスタートできます。');
  const lastTickRef = useRef<number>(initialSettings.workDurationMinutes * 60);

  const validation = useMemo(
    () =>
      validateInputs({
        workPreset,
        workCustom,
        breakPreset,
        breakCustom,
        cyclesInput
      }),
    [workPreset, workCustom, breakPreset, breakCustom, cyclesInput]
  );

  const resolvedSettings = useMemo<TimerSettings | null>(() => {
    if (
      validation.workDurationMinutes === null ||
      validation.breakDurationMinutes === null ||
      validation.cycles === null ||
      validation.errors.work ||
      validation.errors.break ||
      validation.errors.cycles
    ) {
      return null;
    }

    return {
      workDurationMinutes: validation.workDurationMinutes,
      breakDurationMinutes: validation.breakDurationMinutes,
      cycles: validation.cycles,
      soundEnabled
    };
  }, [soundEnabled, validation]);

  const resolvedWorkMinutes = resolvedSettings?.workDurationMinutes ?? validation.workDurationMinutes ?? DEFAULT_SETTINGS.workDurationMinutes;
  const resolvedBreakMinutes =
    resolvedSettings?.breakDurationMinutes ?? validation.breakDurationMinutes ?? DEFAULT_SETTINGS.breakDurationMinutes;

  useEffect(() => {
    if (!resolvedSettings || typeof window === 'undefined') {
      return;
    }

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(resolvedSettings));
    } catch (error) {
      console.error('ポモドーロ設定の保存に失敗しました。', error);
    }
  }, [resolvedSettings]);

  useEffect(() => {
    if (session.mode === 'work' || session.mode === 'break') {
      lastTickRef.current = session.remainingSeconds;
      return;
    }

    const titleBase = 'ポモドーロタイマー';
    document.title = titleBase;
    lastTickRef.current = session.remainingSeconds;
  }, [session.mode, session.remainingSeconds]);

  useEffect(() => {
    if (session.mode !== 'work' && session.mode !== 'break') {
      return;
    }

    const timerId = window.setInterval(() => {
      setSession((currentSession) => {
        if ((currentSession.mode !== 'work' && currentSession.mode !== 'break') || currentSession.phaseStartedAtMs === null) {
          return currentSession;
        }

        const elapsedSeconds = Math.max(0, Math.floor((Date.now() - currentSession.phaseStartedAtMs) / 1000));
        const remainingSeconds = Math.max(0, currentSession.phaseDurationSeconds - elapsedSeconds);

        if (remainingSeconds === currentSession.remainingSeconds) {
          return currentSession;
        }

        return {
          ...currentSession,
          remainingSeconds
        };
      });
    }, 250);

    return () => window.clearInterval(timerId);
  }, [session.mode]);

  useEffect(() => {
    const titleBase = 'ポモドーロタイマー';
    const modeLabel = getModeLabel(session.mode, session.previousMode);

    if (session.mode === 'work' || session.mode === 'break' || session.mode === 'paused') {
      document.title = `${formatTime(session.remainingSeconds)} | ${modeLabel}`;
      return;
    }

    if (session.mode === 'completed') {
      document.title = `完了 | ${titleBase}`;
      return;
    }

    document.title = titleBase;
  }, [session.mode, session.previousMode, session.remainingSeconds]);

  useEffect(() => {
    if (session.mode !== 'work' && session.mode !== 'break') {
      return;
    }

    const previousRemainingSeconds = lastTickRef.current;
    const currentRemainingSeconds = session.remainingSeconds;
    const elapsedSeconds = session.phaseDurationSeconds - currentRemainingSeconds;

    if (soundEnabled && session.mode === 'work' && session.phaseDurationSeconds >= 600) {
      const reachedMilestone = Math.floor(elapsedSeconds / 600) * 10;
      if (
        reachedMilestone >= 10 &&
        reachedMilestone !== session.lastWorkElapsedNotificationMinute &&
        currentRemainingSeconds > 0
      ) {
        setSession((currentSession) => ({
          ...currentSession,
          lastWorkElapsedNotificationMinute: reachedMilestone
        }));
        void audioManager.play('work-progress');
        setBannerMessage(`作業 ${reachedMilestone} 分経過です。ペースを維持しましょう。`);
      }
    }

    if (
      soundEnabled &&
      session.mode === 'work' &&
      session.phaseDurationSeconds > 300 &&
      !session.notifiedWork5MinLeft &&
      previousRemainingSeconds > 300 &&
      currentRemainingSeconds <= 300
    ) {
      setSession((currentSession) => ({
        ...currentSession,
        notifiedWork5MinLeft: true
      }));
      void audioManager.play('work-5min');
      setBannerMessage('作業終了まで残り 5 分です。');
    }

    if (previousRemainingSeconds > 0 && currentRemainingSeconds <= 0) {
      if (session.mode === 'work') {
        if (soundEnabled && !session.notifiedWorkEnd) {
          void audioManager.play('work-end');
        }

        if (session.currentCycle >= session.totalCycles) {
          setSession((currentSession) => ({
            ...currentSession,
            mode: 'completed',
            previousMode: null,
            remainingSeconds: 0,
            pausedAt: null,
            phaseStartedAtMs: null,
            pauseRemainingSeconds: null,
            notifiedWorkEnd: true
          }));
          setBannerMessage('全サイクルが完了しました。おつかれさまでした。');
        } else {
          setSession({
            ...createPhaseSession('break', resolvedBreakMinutes * 60, session.totalCycles, session.currentCycle),
            previousMode: null
          });
          setBannerMessage(`作業 ${session.currentCycle} 回目が終了しました。休憩に入ります。`);
        }
      } else {
        if (soundEnabled && !session.notifiedBreakEnd) {
          void audioManager.play('break-end');
        }

        setSession({
          ...createPhaseSession('work', resolvedWorkMinutes * 60, session.totalCycles, session.currentCycle + 1),
          previousMode: null
        });
        setBannerMessage(`休憩が終わりました。作業 ${session.currentCycle + 1} 回目を始めます。`);
      }
    }

    lastTickRef.current = currentRemainingSeconds;
  }, [
    resolvedBreakMinutes,
    resolvedWorkMinutes,
    session,
    soundEnabled
  ]);

  useEffect(() => {
    if (session.mode !== 'idle' && session.mode !== 'completed') {
      return;
    }

    if (!resolvedSettings) {
      return;
    }

    setSession((currentSession) => {
      if (currentSession.mode !== 'idle' && currentSession.mode !== 'completed') {
        return currentSession;
      }

      return {
        ...currentSession,
        currentCycle: 1,
        totalCycles: resolvedSettings.cycles,
        phaseDurationSeconds: resolvedSettings.workDurationMinutes * 60,
        remainingSeconds: resolvedSettings.workDurationMinutes * 60
      };
    });
  }, [resolvedSettings, session.mode]);

  const activeDurationSeconds = session.phaseDurationSeconds;
  const elapsedSeconds = Math.max(0, activeDurationSeconds - session.remainingSeconds);
  const elapsedInMinute = ((elapsedSeconds % SECOND_MARK_COUNT) + SECOND_MARK_COUNT) % SECOND_MARK_COUNT;
  const secondProgress = elapsedInMinute / SECOND_MARK_COUNT;
  const statusLabel = getModeLabel(session.mode, session.previousMode);
  const modeAccentClass = getModeAccent(session.mode, session.previousMode);
  const canStart = Boolean(resolvedSettings) && (session.mode === 'idle' || session.mode === 'completed');
  const canPause = session.mode === 'work' || session.mode === 'break';
  const canResume = session.mode === 'paused';
  const canReset = session.mode !== 'idle';
  const isRunning = session.mode === 'work' || session.mode === 'break';

  const secondMarks = useMemo(() => Array.from({ length: SECOND_MARK_COUNT }, (_, index) => index), []);

  const handleStart = async () => {
    if (!resolvedSettings) {
      setBannerMessage('入力内容を確認してからスタートしてください。');
      return;
    }

    await audioManager.unlock();
    const nextSession = createPhaseSession('work', resolvedSettings.workDurationMinutes * 60, resolvedSettings.cycles, 1);
    lastTickRef.current = nextSession.remainingSeconds;
    setSession(nextSession);
    setBannerMessage('ポモドーロを開始しました。まずは作業に集中しましょう。');
  };

  const handlePause = () => {
    setSession((currentSession) => {
      if (currentSession.mode !== 'work' && currentSession.mode !== 'break') {
        return currentSession;
      }

      return {
        ...currentSession,
        mode: 'paused',
        previousMode: currentSession.mode,
        pausedAt: new Date().toISOString(),
        pauseRemainingSeconds: currentSession.remainingSeconds,
        phaseStartedAtMs: null
      };
    });
    setBannerMessage('タイマーを一時停止しました。');
  };

  const handleResume = async () => {
    await audioManager.unlock();
    setSession((currentSession) => {
      if (currentSession.mode !== 'paused' || !currentSession.previousMode || currentSession.pauseRemainingSeconds === null) {
        return currentSession;
      }

      return {
        ...currentSession,
        mode: currentSession.previousMode,
        previousMode: null,
        phaseStartedAtMs: Date.now() - (currentSession.phaseDurationSeconds - currentSession.pauseRemainingSeconds) * 1000,
        pausedAt: null,
        remainingSeconds: currentSession.pauseRemainingSeconds,
        pauseRemainingSeconds: null
      };
    });
    setBannerMessage('タイマーを再開しました。');
  };

  const handleReset = () => {
    const fallbackSettings = resolvedSettings ?? {
      workDurationMinutes: validation.workDurationMinutes ?? DEFAULT_SETTINGS.workDurationMinutes,
      breakDurationMinutes: validation.breakDurationMinutes ?? DEFAULT_SETTINGS.breakDurationMinutes,
      cycles: validation.cycles ?? DEFAULT_SETTINGS.cycles,
      soundEnabled
    };

    lastTickRef.current = fallbackSettings.workDurationMinutes * 60;
    setSession(createIdleSession(fallbackSettings));
    setBannerMessage('タイマーをリセットしました。');
  };

  const handleToggleSound = async () => {
    if (!soundEnabled) {
      await audioManager.unlock();
    }

    setSoundEnabled((current) => !current);
  };

  const handleWorkPreset = (value: number) => {
    setWorkPreset(value);
    setWorkCustom('');
  };

  const handleBreakPreset = (value: number) => {
    setBreakPreset(value);
    setBreakCustom('');
  };

  const handleProceedToTimer = () => {
    if (!resolvedSettings) {
      setBannerMessage('入力内容を確認してから時計画面へ進んでください。');
      return;
    }

    setSession(createIdleSession(resolvedSettings));
    setUiStage('timer');
    setBannerMessage('設定を反映しました。スタートで開始できます。');
  };

  const workPreviewText =
    workCustom.trim() !== ''
      ? `カスタム ${workCustom} 分`
      : workPreset !== null
        ? `プリセット ${workPreset} 分`
        : '未選択';
  const breakPreviewText =
    breakCustom.trim() !== ''
      ? `カスタム ${breakCustom} 分`
      : breakPreset !== null
        ? `プリセット ${breakPreset} 分`
        : '未選択';

  return (
    <>
      <Seo meta={PAGE_SEO.pomodoroTimer} />
      {uiStage === 'settings' ? (
        <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 pb-12 pt-16 sm:px-6 sm:pt-20">
          <div className="flex items-center justify-between gap-4">
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-panel/70 px-4 py-2 text-sm font-medium text-muted transition hover:border-accent hover:text-ink"
            >
              <ArrowLeft className="h-4 w-4" />
              ツール一覧へ戻る
            </Link>
            <button
              type="button"
              onClick={handleToggleSound}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border/70 bg-panel/70 px-4 py-2 text-sm font-medium text-muted transition hover:border-accent hover:text-ink"
              aria-pressed={soundEnabled}
            >
              {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              {soundEnabled ? '通知音 ON' : '通知音 OFF'}
            </button>
          </div>

          <header className="space-y-4 text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent">Pomodoro Timer</p>
            <h1 className="text-3xl font-black leading-tight text-ink sm:text-5xl">最初に設定して、あとは時間だけを見る</h1>
            <p className="mx-auto max-w-xl text-sm text-muted sm:text-base">
              設定画面と実行画面を分けています。開始後は時間と最小限の操作だけを表示します。
            </p>
          </header>

          <section className="glass-panel rounded-[2rem] p-5 sm:p-7">
            <div className="space-y-6">
              <section className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor="work-custom" className="text-sm font-semibold text-ink">
                    作業時間
                  </label>
                  <span className="text-xs text-muted">{workPreviewText}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {WORK_PRESETS.map((preset) => {
                    const selected = workPreset === preset && workCustom.trim() === '';
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => handleWorkPreset(preset)}
                        className={`min-h-12 rounded-2xl border px-3 py-3 text-sm font-semibold transition ${
                          selected
                            ? 'border-accent bg-accent/15 text-ink shadow-[0_0_0_1px_rgba(234,166,83,0.24)]'
                            : 'border-border/70 bg-panel/60 text-muted hover:border-accent hover:text-ink'
                        }`}
                        aria-pressed={selected}
                      >
                        {preset} 分
                      </button>
                    );
                  })}
                </div>
                <div className="space-y-2">
                  <input
                    id="work-custom"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={workCustom}
                    onChange={(event) => {
                      setWorkCustom(event.target.value);
                      if (event.target.value.trim() !== '') {
                        setWorkPreset(null);
                      }
                    }}
                    placeholder="カスタム分数を入力"
                    className={`w-full rounded-2xl border bg-panel/80 px-4 py-3 text-base text-ink outline-none transition placeholder:text-muted/70 ${
                      validation.errors.work ? 'border-rose-400/80' : 'border-border/70 focus:border-accent'
                    }`}
                    aria-invalid={Boolean(validation.errors.work)}
                    aria-describedby="work-error"
                  />
                  <p id="work-error" className={`text-sm ${validation.errors.work ? 'text-rose-300' : 'text-muted'}`}>
                    {validation.errors.work ?? `1〜${MAX_WORK_MINUTES} 分、空欄時は直近の有効プリセットを使います。`}
                  </p>
                </div>
              </section>

              <section className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor="break-custom" className="text-sm font-semibold text-ink">
                    休憩時間
                  </label>
                  <span className="text-xs text-muted">{breakPreviewText}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {BREAK_PRESETS.map((preset) => {
                    const selected = breakPreset === preset && breakCustom.trim() === '';
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => handleBreakPreset(preset)}
                        className={`min-h-12 rounded-2xl border px-3 py-3 text-sm font-semibold transition ${
                          selected
                            ? 'border-emerald-300/80 bg-emerald-400/10 text-ink shadow-[0_0_0_1px_rgba(110,231,183,0.18)]'
                            : 'border-border/70 bg-panel/60 text-muted hover:border-emerald-300/80 hover:text-ink'
                        }`}
                        aria-pressed={selected}
                      >
                        {preset} 分
                      </button>
                    );
                  })}
                </div>
                <div className="space-y-2">
                  <input
                    id="break-custom"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={breakCustom}
                    onChange={(event) => {
                      setBreakCustom(event.target.value);
                      if (event.target.value.trim() !== '') {
                        setBreakPreset(null);
                      }
                    }}
                    placeholder="カスタム分数を入力"
                    className={`w-full rounded-2xl border bg-panel/80 px-4 py-3 text-base text-ink outline-none transition placeholder:text-muted/70 ${
                      validation.errors.break ? 'border-rose-400/80' : 'border-border/70 focus:border-accent'
                    }`}
                    aria-invalid={Boolean(validation.errors.break)}
                    aria-describedby="break-error"
                  />
                  <p id="break-error" className={`text-sm ${validation.errors.break ? 'text-rose-300' : 'text-muted'}`}>
                    {validation.errors.break ?? `1〜${MAX_BREAK_MINUTES} 分、空欄時は直近の有効プリセットを使います。`}
                  </p>
                </div>
              </section>

              <section className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor="cycles-input" className="text-sm font-semibold text-ink">
                    繰り返し回数
                  </label>
                  <span className="text-xs text-muted">1〜99 回</span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setCyclesInput((current) => {
                        const parsed = parseCycles(current);
                        const safeValue = parsed === null || Number.isNaN(parsed) ? DEFAULT_SETTINGS.cycles : parsed;
                        return String(clampNumber(safeValue - 1, MIN_CYCLES, MAX_CYCLES));
                      })
                    }
                    className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-2xl border border-border/70 bg-panel/60 text-muted transition hover:border-accent hover:text-ink"
                    aria-label="繰り返し回数を減らす"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <input
                    id="cycles-input"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={cyclesInput}
                    onChange={(event) => setCyclesInput(event.target.value)}
                    className={`w-full rounded-2xl border bg-panel px-4 py-3 text-center text-lg font-bold text-ink [--tw-text-opacity:1] [-webkit-text-fill-color:theme(colors.ink)] outline-none transition ${
                      validation.errors.cycles ? 'border-rose-400/80' : 'border-border/70 focus:border-accent'
                    }`}
                    style={{ color: 'var(--color-ink)', WebkitTextFillColor: 'var(--color-ink)' }}
                    aria-invalid={Boolean(validation.errors.cycles)}
                    aria-describedby="cycles-error"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setCyclesInput((current) => {
                        const parsed = parseCycles(current);
                        const safeValue = parsed === null || Number.isNaN(parsed) ? DEFAULT_SETTINGS.cycles : parsed;
                        return String(clampNumber(safeValue + 1, MIN_CYCLES, MAX_CYCLES));
                      })
                    }
                    className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-2xl border border-border/70 bg-panel/60 text-muted transition hover:border-accent hover:text-ink"
                    aria-label="繰り返し回数を増やす"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <p id="cycles-error" className={`text-sm ${validation.errors.cycles ? 'text-rose-300' : 'text-muted'}`}>
                  {validation.errors.cycles ?? '回数は作業区間の総数です。'}
                </p>
              </section>

              <div className="rounded-[1.5rem] border border-border/70 bg-panel/55 p-4" role="status" aria-live="polite">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 text-accent" />
                  <p className="text-sm leading-6 text-ink">{bannerMessage}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleProceedToTimer}
                disabled={!resolvedSettings}
                className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border border-accent/70 bg-accent/15 px-5 py-3 text-base font-semibold text-ink transition enabled:hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-45"
              >
                時計画面へ進む
              </button>
            </div>
          </section>
        </main>
      ) : (
        <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 pb-10 pt-6 sm:px-6">
          <div className="flex items-center justify-between text-xs text-muted">
            <button
              type="button"
              onClick={() => setUiStage('settings')}
              className="rounded-full border border-border/60 bg-panel/50 px-3 py-2 transition hover:border-accent hover:text-ink"
            >
              設定を開く
            </button>
            <button
              type="button"
              onClick={handleToggleSound}
              className="rounded-full border border-border/60 bg-panel/50 px-3 py-2 transition hover:border-accent hover:text-ink"
              aria-pressed={soundEnabled}
            >
              {soundEnabled ? '音 ON' : '音 OFF'}
            </button>
          </div>

          <div className="flex flex-1 flex-col items-center justify-center">
            <div className="relative flex w-full max-w-[42rem] flex-col items-center justify-center rounded-[2.5rem] border border-white/8 bg-[radial-gradient(circle_at_top,rgba(20,45,66,0.98),rgba(4,10,17,0.98))] px-6 py-10 shadow-[0_40px_120px_-42px_rgba(0,0,0,0.98)]">
              <div className="pointer-events-none absolute inset-0 rounded-[2.5rem] bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08),transparent_60%)]" />
              <div className="relative z-10 flex w-full flex-col items-center">
                <div className="mb-5 flex items-center gap-3 text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-muted">
                  <span className={modeAccentClass}>{statusLabel}</span>
                  <span className="text-muted/60">•</span>
                  <span>{session.currentCycle}/{session.totalCycles}</span>
                </div>

                <div className="relative mb-8 flex h-[24rem] w-full max-w-[24rem] items-center justify-center sm:h-[28rem] sm:max-w-[28rem]">
                  <svg viewBox="0 0 320 320" className="absolute inset-0 h-full w-full opacity-90" aria-hidden="true">
                    <defs>
                      <linearGradient id="pomodoro-ring-minimal" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#f59e0b" />
                        <stop offset="60%" stopColor="#fb7185" />
                        <stop offset="100%" stopColor="#38bdf8" />
                      </linearGradient>
                    </defs>
                    <circle cx="160" cy="160" r="116" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2" />
                    {secondMarks.map((mark) => {
                      const angle = (mark / SECOND_MARK_COUNT) * Math.PI * 2 - Math.PI / 2;
                      const innerRadius = 126;
                      const outerRadius = mark % 5 === 0 ? 146 : 138;
                      const x1 = 160 + innerRadius * Math.cos(angle);
                      const y1 = 160 + innerRadius * Math.sin(angle);
                      const x2 = 160 + outerRadius * Math.cos(angle);
                      const y2 = 160 + outerRadius * Math.sin(angle);
                      const tickState = getTickState(elapsedInMinute, mark);
                      const stroke =
                        tickState === 'passed' ? 'rgba(255,255,255,0.54)' : tickState === 'current' ? 'rgba(250,204,21,0.98)' : 'rgba(255,255,255,0.14)';

                      return (
                        <line
                          key={mark}
                          x1={x1}
                          y1={y1}
                          x2={x2}
                          y2={y2}
                          stroke={stroke}
                          strokeWidth={tickState === 'current' ? 4 : mark % 5 === 0 ? 2.5 : 1.8}
                          strokeLinecap="round"
                        />
                      );
                    })}
                    <circle
                      cx="160"
                      cy="160"
                      r="102"
                      fill="none"
                      stroke="url(#pomodoro-ring-minimal)"
                      strokeOpacity="0.92"
                      strokeWidth="7"
                      strokeDasharray={`${2 * Math.PI * 102}`}
                      strokeDashoffset={`${2 * Math.PI * 102 * (1 - secondProgress)}`}
                      strokeLinecap="round"
                      transform="rotate(-90 160 160)"
                      className="transition-[stroke-dashoffset] duration-300 ease-out"
                    />
                  </svg>

                  <div className="relative z-10 flex flex-col items-center">
                    <p className="font-mono text-[4rem] font-semibold tracking-[0.14em] text-white sm:text-[5.5rem]">
                      {formatTime(session.remainingSeconds)}
                    </p>
                    <p className="mt-3 text-sm text-muted">
                      {session.mode === 'completed' ? '完了しました' : bannerMessage}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={canResume ? handleResume : handleStart}
                    disabled={!canStart && !canResume}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-accent/70 bg-accent/15 px-6 py-3 text-sm font-semibold text-white transition enabled:hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Play className="h-4 w-4" />
                    {canResume ? '再開' : 'スタート'}
                  </button>
                  <button
                    type="button"
                    onClick={handlePause}
                    disabled={!canPause}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-border/70 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition enabled:hover:border-white/40 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Pause className="h-4 w-4" />
                    一時停止
                  </button>
                  <button
                    type="button"
                    onClick={handleReset}
                    disabled={!canReset}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-border/70 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition enabled:hover:border-white/40 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <RotateCcw className="h-4 w-4" />
                    リセット
                  </button>
                </div>

                <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-xs text-muted">
                  <span>作業 {resolvedWorkMinutes} 分</span>
                  <span>休憩 {resolvedBreakMinutes} 分</span>
                  <span>{session.totalCycles} サイクル</span>
                </div>
              </div>
            </div>

            {session.mode === 'completed' && (
              <div className="mt-6 flex items-center gap-3 rounded-full border border-emerald-300/40 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-200">
                <CheckCircle2 className="h-4 w-4" />
                すべてのサイクルが完了しました
              </div>
            )}

            {session.mode === 'break' && (
              <div className="mt-6 flex items-center gap-3 rounded-full border border-emerald-300/30 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-200">
                <Coffee className="h-4 w-4" />
                休憩中
              </div>
            )}
          </div>
        </main>
      )}
    </>
  );
}
