import { DayLog, UserSettings, AppState } from '../types';
import { addDays, format, parseISO, differenceInDays, startOfDay, isSameDay } from 'date-fns';

const STORAGE_KEY = 'luna_app_data';

const DEFAULT_SETTINGS: UserSettings = {
  averageCycleLength: 28,
  averagePeriodLength: 5,
  lastPeriodStart: format(new Date(), 'yyyy-MM-dd'),
  notifications: {
    periodStart: false,
    ovulationDay: false,
    fertileWindow: false,
  },
  wearableConnected: false,
};

export const loadState = (): AppState => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      // Migration: Ensure notifications exist
      if (!parsed.settings.notifications) {
        parsed.settings.notifications = DEFAULT_SETTINGS.notifications;
      }
      if (parsed.settings.wearableConnected === undefined) {
        parsed.settings.wearableConnected = DEFAULT_SETTINGS.wearableConnected;
      }
      return parsed;
    } catch (e) {
      console.error('Failed to parse saved state', e);
    }
  }
  return {
    logs: {},
    settings: DEFAULT_SETTINGS,
  };
};

export const saveState = (state: AppState) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

export const calculatePredictions = (settings: UserSettings, logs: Record<string, DayLog> = {}) => {
  // 1. Analyze historical logs to find actual cycle patterns
  const periodDays = Object.entries(logs)
    .filter(([_, log]) => log.isPeriod)
    .map(([date, _]) => date)
    .sort();

  const historicalStarts: Date[] = [];
  if (periodDays.length > 0) {
    let lastDay: Date | null = null;
    periodDays.forEach(dateStr => {
      const d = parseISO(dateStr);
      if (!lastDay || differenceInDays(d, lastDay) > 1) {
        historicalStarts.push(d);
      }
      lastDay = d;
    });
  }

  const cycleLengths: number[] = [];
  for (let i = 1; i < historicalStarts.length; i++) {
    cycleLengths.push(differenceInDays(historicalStarts[i], historicalStarts[i-1]));
  }

  const avgHistoryLength = cycleLengths.length > 0
    ? cycleLengths.reduce((a, b) => a + b, 0) / cycleLengths.length
    : settings.averageCycleLength;

  const variability = cycleLengths.length > 1
    ? Math.max(...cycleLengths) - Math.min(...cycleLengths)
    : 0;

  // Decision logic: prefer history if we have at least 2 complete cycles
  const finalCycleLength = cycleLengths.length >= 2 
    ? (avgHistoryLength * 0.7 + settings.averageCycleLength * 0.3)
    : settings.averageCycleLength;

  const lastStart = parseISO(settings.lastPeriodStart);
  const today = startOfDay(new Date());
  
  const lutealPhase = 14; 
  const nextStart = addDays(lastStart, Math.round(finalCycleLength));
  const ovulationDate = addDays(nextStart, -lutealPhase);
  
  const dayInCycle = differenceInDays(today, lastStart) + 1;
  
  let currentPhase = 'Фолликулярная';
  let phaseDescription = 'Ваше тело готовится к овуляции. Время для планирования и новых начинаний.';

  if (dayInCycle <= settings.averagePeriodLength) {
    currentPhase = 'Менструация';
    phaseDescription = 'Время отдыха и заботы о себе. Уровень энергии может быть низким.';
  } else if (isSameDay(today, ovulationDate)) {
    currentPhase = 'Овуляция';
    phaseDescription = 'Ваш пик фертильности. Время для высокой активности и общения.';
  } else if (dayInCycle > Math.round(finalCycleLength) - lutealPhase) {
    currentPhase = 'Лютеиновая';
    phaseDescription = 'Подготовка организма к новому циклу. Могут появиться симптомы ПМС.';
  }

  // Refined Confidence Score Logic
  let confidence = 95;
  const reasons: string[] = [];
  
  // Data volume factor
  if (cycleLengths.length === 0) {
    confidence -= 15;
    reasons.push('Нет истории циклов');
  } else if (cycleLengths.length < 3) {
    confidence -= 5;
    reasons.push('Мало исторических данных');
  } else {
    reasons.push('Основано на вашей истории');
  }

  // Variability factor
  if (variability > 7) {
    confidence -= 25;
    reasons.push('Высокая вариативность цикла');
  } else if (variability > 3) {
    confidence -= (variability - 3) * 5;
    reasons.push('Умеренная вариативность');
  } else if (cycleLengths.length >= 2) {
    reasons.push('Стабильный цикл');
  }

  // Biological consistency factor
  const cycleDeviation = Math.abs(finalCycleLength - 28);
  if (cycleDeviation > 5) {
    confidence -= (cycleDeviation - 5) * 2;
    reasons.push('Нестандартная длина цикла');
  }

  confidence = Math.max(confidence, 55);

  return {
    nextPeriodStart: nextStart,
    ovulationDate,
    confidence: Math.round(confidence),
    confidenceReasons: reasons,
    dayInCycle,
    currentPhase,
    phaseDescription,
    fertileWindow: {
      start: addDays(ovulationDate, -5),
      end: addDays(ovulationDate, 1),
    }
  };
};

export const getDaysCounter = (nextDate: Date) => {
  const today = startOfDay(new Date());
  const diff = differenceInDays(startOfDay(nextDate), today);
  return diff;
};
