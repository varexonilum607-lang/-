export type Mood = 'happy' | 'sad' | 'neutral' | 'angry' | 'tired' | 'stressed';

export type Symptom = 'cramps' | 'headache' | 'bloating' | 'backache' | 'acne' | 'tender_breasts' | 'fatigue';

export interface DayLog {
  date: string; // ISO string YYYY-MM-DD
  isPeriod: boolean;
  flow?: 'light' | 'medium' | 'heavy';
  mood?: Mood;
  symptoms: Symptom[];
  notes?: string;
  sleepHours?: number;
  avgHeartRate?: number;
  weight?: number;
}

export interface UserSettings {
  averageCycleLength: number;
  averagePeriodLength: number;
  lastPeriodStart: string; // ISO string
  birthDate?: string; // ISO string
  notifications: {
    periodStart: boolean;
    ovulationDay: boolean;
    fertileWindow: boolean;
  };
  wearableConnected: boolean;
}

export interface AppState {
  logs: Record<string, DayLog>;
  settings: UserSettings;
}
