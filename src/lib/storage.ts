import { DayLog, UserSettings, AppState } from '../types';
import { addDays, format, parseISO, differenceInDays, startOfDay, isSameDay } from 'date-fns';

const STORAGE_KEY = 'luna_app_data';

const DEFAULT_SETTINGS: UserSettings = {
  averageCycleLength: 28,
  averagePeriodLength: 5,
  lastPeriodStart: format(new Date(), 'yyyy-MM-dd'),
  birthDate: '1995-01-01',
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
      if (!parsed.settings.birthDate) {
        parsed.settings.birthDate = DEFAULT_SETTINGS.birthDate;
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

  // Calculate Weighted Average (prefer recent cycles)
  let avgHistoryLength = settings.averageCycleLength;
  if (cycleLengths.length > 0) {
    if (cycleLengths.length === 1) {
      avgHistoryLength = cycleLengths[0];
    } else {
      // Exponential weight: more weight to recent cycles
      let totalWeight = 0;
      let weightedSum = 0;
      cycleLengths.forEach((length, i) => {
        const weight = Math.pow(1.2, i); // Increase weight for later cycles
        weightedSum += length * weight;
        totalWeight += weight;
      });
      avgHistoryLength = weightedSum / totalWeight;
    }
  }

  const variability = cycleLengths.length > 1
    ? Math.max(...cycleLengths) - Math.min(...cycleLengths)
    : 0;

  // Decision logic: blend history and user settings
  const finalCycleLength = cycleLengths.length >= 2 
    ? (avgHistoryLength * 0.8 + settings.averageCycleLength * 0.2)
    : (cycleLengths.length === 1 ? (avgHistoryLength * 0.5 + settings.averageCycleLength * 0.5) : settings.averageCycleLength);

  const lastStart = parseISO(settings.lastPeriodStart);
  const today = startOfDay(new Date());
  
  // Luteal phase estimation (ideally 14, but can be adjusted based on history if ovulation was tracked)
  // For now, we still use 14 as it's biologically the most stable part, 
  // but we'll adjust the 'nextStart' based on symptoms
  const lutealPhase = 14; 
  let nextStart = addDays(lastStart, Math.round(finalCycleLength));
  
  // --- NEW: Symptom-based refinement ---
  // If we are within 4 days of the predicted start, look for premenstrual symptoms
  const daysNearPrediction = differenceInDays(nextStart, today);
  if (daysNearPrediction <= 4 && daysNearPrediction >= -2) {
    let symptomScore = 0;
    // Check last 3 days of logs
    for (let i = 0; i < 3; i++) {
      const checkDate = format(addDays(today, -i), 'yyyy-MM-dd');
      const log = logs[checkDate];
      if (log) {
        if (log.symptoms.includes('cramps')) symptomScore += 2;
        if (log.symptoms.includes('tender_breasts')) symptomScore += 1;
        if (log.symptoms.includes('backache')) symptomScore += 1;
        if (log.mood === 'stressed' || log.mood === 'tired') symptomScore += 0.5;
      }
    }
    
    // If high symptom score but period hasn't started, it's very likely to start within 1-2 days
    if (symptomScore >= 3 && daysNearPrediction > 1) {
      // Shift prediction slightly earlier if symptoms are already strong
      nextStart = addDays(today, 1);
    }
  }

  // --- NEW: Health Factors (Sleep impact) ---
  const recentLogs = Object.values(logs)
    .filter(l => differenceInDays(today, parseISO(l.date)) <= 7 && l.sleepHours !== undefined);
  const avgRecentSleep = recentLogs.length > 0 
    ? recentLogs.reduce((acc, curr) => acc + (curr.sleepHours || 0), 0) / recentLogs.length
    : 8;

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
    reasons.push('Основано на вашей персональной истории');
  }

  // Variability factor
  if (variability > 7) {
    confidence -= 25;
    reasons.push('Высокая вариативность цикла');
  } else if (variability > 3) {
    confidence -= (variability - 3) * 5;
    reasons.push('Умеренная вариативность');
  }

  // Sleep factor
  if (avgRecentSleep < 6) {
    confidence -= 10;
    reasons.push('Недостаток сна может влиять на точность');
  }

  // Symptom check presence
  const hasRecentSymptoms = Object.values(logs).some(l => 
    differenceInDays(today, parseISO(l.date)) <= 3 && l.symptoms.length > 0
  );
  if (hasRecentSymptoms && daysNearPrediction <= 5) {
    confidence += 5;
    reasons.push('Учтены текущие симптомы');
  }

  confidence = Math.min(Math.max(confidence, 40), 98);

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
