/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart, 
  Bar, 
  LineChart,
  Line,
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { 
  Calendar as CalendarIcon, 
  Home, 
  BarChart2, 
  Settings as SettingsIcon, 
  Plus, 
  ChevronLeft, 
  ChevronRight,
  Heart,
  Droplets,
  Zap,
  Smile,
  Check,
  Bell,
  User as UserIcon
} from 'lucide-react';
import { 
  format, 
  addMonths, 
  subMonths, 
  subDays,
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  isToday,
  addDays,
  parseISO,
  startOfToday
} from 'date-fns';
import { ru } from 'date-fns/locale';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { AppState, DayLog, UserSettings, Mood, Symptom } from './types';
import { loadState, saveState, calculatePredictions, getDaysCounter } from './lib/storage';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Components ---

const Button = ({ 
  children, 
  onClick, 
  className, 
  variant = 'primary' 
}: { 
  children: React.ReactNode; 
  onClick?: () => void; 
  className?: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'pink'
}) => {
  const variants = {
    primary: 'bg-art-text text-art-bg shadow-sm hover:bg-art-accent hover:text-white',
    secondary: 'bg-white text-art-text border border-art-text/10 hover:border-art-text/30',
    ghost: 'bg-transparent text-art-text/50 hover:text-art-accent',
    pink: 'bg-art-accent text-white'
  };

  return (
    <button 
      onClick={onClick}
      className={cn(
        'px-6 py-3 rounded-full font-sans text-xs uppercase tracking-art transition-all active:scale-95 flex items-center justify-center gap-2',
        variants[variant],
        className
      )}
    >
      {children}
    </button>
  );
};

const Card = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn('bg-white border border-art-text/5 p-6 rounded-none', className)}>
    {children}
  </div>
);

// --- Main App ---

export default function App() {
  const [activeTab, setActiveTab] = useState<'home' | 'calendar' | 'stats' | 'settings'>('home');
  const [state, setState] = useState<AppState>(loadState());
  const [showLogModal, setShowLogModal] = useState<string | null>(null); // date string

  const predictions = useMemo(() => calculatePredictions(state.settings, state.logs), [state.settings, state.logs]);
  const daysUntilNext = getDaysCounter(predictions.nextPeriodStart);

  const weightData = useMemo(() => {
    return Array.from({ length: 30 }).map((_, i) => {
      const date = format(addDays(new Date(), -29 + i), 'yyyy-MM-dd');
      const log = state.logs[date];
      return {
        date: format(parseISO(date), 'dd.MM'),
        weight: log?.weight || undefined,
      };
    }).filter(d => d.weight !== undefined);
  }, [state.logs]);

  const symptomData = useMemo(() => {
    return Array.from({ length: 4 }).map((_, i) => {
      const weekLabel = `Н${i + 1}`;
      let cramps = 0;
      let fatigue = 0;
      let bloating = 0;
      for (let j = 0; j < 7; j++) {
        const dateStr = format(addDays(new Date(), -27 + (i * 7) + j), 'yyyy-MM-dd');
        const log = state.logs[dateStr];
        if (log?.symptoms.includes('cramps')) cramps++;
        if (log?.symptoms.includes('fatigue')) fatigue++;
        if (log?.symptoms.includes('bloating')) bloating++;
      }
      return { week: weekLabel, cramps, fatigue, bloating };
    });
  }, [state.logs]);

  useEffect(() => {
    saveState(state);
  }, [state]);

  // Check for notifications
  useEffect(() => {
    const checkNotifications = async () => {
      if (!('Notification' in window) || Notification.permission !== 'granted') return;

      const { periodStart, ovulationDay, fertileWindow } = state.settings.notifications;
      const today = startOfToday();
      
      const fireNotification = (title: string, body: string) => {
        new Notification(title, { body, icon: '/favicon.ico' });
      };

      // Period start check (1 day before)
      if (periodStart) {
        const tomorrow = addDays(today, 1);
        if (isSameDay(tomorrow, predictions.nextPeriodStart)) {
          fireNotification('Luna: Завтра начнется период', 'Приготовьте все необходимое заранее.');
        }
      }

      // Ovulation check
      if (ovulationDay) {
        if (isSameDay(today, predictions.ovulationDate)) {
          fireNotification('Luna: Сегодня день овуляции', 'Ваш шанс забеременеть сегодня максимален.');
        }
      }

      // Fertile window check
      if (fertileWindow) {
        if (isSameDay(today, predictions.fertileWindow.start)) {
          fireNotification('Luna: Началось фертильное окно', 'Удачное время для планирования.');
        }
      }
    };

    checkNotifications();
  }, [state.settings.notifications, predictions]);

  const handleUpdateLog = (date: string, log: Partial<DayLog>) => {
    setState(prev => {
      const existing = prev.logs[date] || { date, isPeriod: false, symptoms: [] };
      const updated = { ...existing, ...log };
      
      if (log.isPeriod && !existing.isPeriod) {
        return {
          ...prev,
          logs: { ...prev.logs, [date]: updated },
          settings: { ...prev.settings, lastPeriodStart: date }
        };
      }

      return {
        ...prev,
        logs: { ...prev.logs, [date]: updated }
      };
    });
  };

  const handleTogglePeriod = (date: string) => {
    setState(prev => {
      const existing = prev.logs[date] || { date, isPeriod: false, symptoms: [] };
      return {
        ...prev,
        logs: { ...prev.logs, [date]: { ...existing, isPeriod: !existing.isPeriod } }
      };
    });
  };

  return (
    <div className="max-w-md mx-auto min-h-screen bg-art-bg flex flex-col font-serif select-none pb-24">
      {/* Header */}
      <header className="p-8 pt-12 flex items-baseline justify-between">
        <div>
          <h1 className="text-5xl font-light tracking-tighter leading-none">LUNA</h1>
          <p className="text-[9px] uppercase tracking-art-wide font-sans mt-2 opacity-50">Цикл под контролем</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-light italic">{format(new Date(), 'd MMMM', { locale: ru })}</p>
          <p className="text-[10px] uppercase tracking-art font-sans opacity-40">{format(new Date(), 'EEEE', { locale: ru })}</p>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-8 space-y-8 overflow-y-auto">
        <AnimatePresence mode="wait">
          {activeTab === 'home' && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-10"
            >
              {/* Circle Status */}
              <div className="relative flex justify-center py-6">
                <div className="w-64 h-64 rounded-full border border-dashed border-art-accent/30 flex flex-col items-center justify-center bg-white shadow-2xl shadow-art-text/5 relative">
                  <span className="text-xs font-sans uppercase tracking-art-wide opacity-40 mb-2">День</span>
                  <span className="text-[100px] font-light leading-none">
                    {predictions.dayInCycle}
                  </span>
                  
                  <div className="mt-4 flex items-center space-x-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-art-accent"></div>
                    <span className="text-[10px] font-sans tracking-art opacity-60 uppercase">{daysUntilNext} дн. до периода</span>
                  </div>
                </div>
              </div>

              {/* Quick Actions / Info */}
              <div className="grid grid-cols-1 gap-6">
                <div>
                  <p className="text-[10px] font-sans font-bold uppercase tracking-art mb-3 text-art-accent">Текущая фаза</p>
                  <h2 className="text-4xl font-light mb-2">{predictions.currentPhase}</h2>
                  <p className="text-sm font-sans leading-relaxed opacity-60">
                    {predictions.phaseDescription}
                  </p>
                </div>

                <div className="flex gap-4">
                  <Button 
                    onClick={() => setShowLogModal(format(new Date(), 'yyyy-MM-dd'))}
                    className="flex-1"
                  >
                    Отметить период
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'calendar' && (
            <motion.div
              key="calendar"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <CalendarView 
                state={state} 
                onSelectDay={setShowLogModal}
                onTogglePeriod={handleTogglePeriod}
              />
            </motion.div>
          )}

          {activeTab === 'stats' && (
            <motion.div
              key="stats"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-8"
            >
              <h2 className="text-4xl font-light">Аналитика</h2>
              <div className="grid grid-cols-1 gap-6">
                {/* Predictions Section */}
                <div className="space-y-6">
                  <p className="text-[10px] font-sans font-bold uppercase tracking-art text-art-accent">Прогноз фертильности</p>
                  
                  <div className="flex flex-col gap-6">
                    <div className="flex flex-col gap-2 bg-art-accent/5 p-4 border border-art-accent/10">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-[8px] font-sans uppercase tracking-widest opacity-40 mb-1">Точность прогноза</p>
                          <p className="text-sm font-sans font-bold">{predictions.confidence}%</p>
                        </div>
                        <div className="flex-1 ml-6 max-w-[100px] h-1 bg-art-accent/10 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-art-accent transition-all duration-1000" 
                            style={{ width: `${predictions.confidence}%` }}
                          />
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                        {predictions.confidenceReasons?.map((reason, i) => (
                          <span key={i} className="text-[7px] uppercase tracking-wider opacity-40 font-bold border-l border-art-accent/30 pl-2">
                             {reason}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-between items-end border-b border-art-text/10 pb-4">
                      <div className="space-y-1">
                        <p className="text-[10px] font-sans uppercase tracking-art-wide opacity-40">Овуляция</p>
                        <p className="text-2xl font-light italic">{format(predictions.ovulationDate, 'd MMMM', { locale: ru })}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-sans uppercase opacity-40">Шанс зачатия</p>
                        <p className="text-sm font-sans font-bold text-art-nature uppercase tracking-tighter">Высокий</p>
                      </div>
                    </div>

                    <div className="flex justify-between items-end border-b border-art-text/10 pb-4">
                      <div className="space-y-1">
                        <p className="text-[10px] font-sans uppercase tracking-art-wide opacity-40">Фертильное окно</p>
                        <p className="text-lg font-light">
                          {format(predictions.fertileWindow.start, 'd')} — {format(predictions.fertileWindow.end, 'd MMMM', { locale: ru })}
                        </p>
                      </div>
                      <div className="w-1.5 h-1.5 rounded-full bg-art-nature mb-2"></div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-b border-art-text/10 pb-6 flex justify-between items-baseline">
                  <p className="text-[10px] font-sans font-bold uppercase tracking-art text-art-text/40">Средний цикл</p>
                  <p className="text-3xl font-light italic">{state.settings.averageCycleLength} дн.</p>
                </div>
                <div className="border-b border-art-text/10 pb-6 flex justify-between items-baseline">
                  <p className="text-[10px] font-sans font-bold uppercase tracking-art text-art-text/40">Средний период</p>
                  <p className="text-3xl font-light italic">{state.settings.averagePeriodLength} дн.</p>
                </div>
                
                <div className="pt-4 w-full">
                  <p className="text-[10px] font-sans font-bold uppercase tracking-art text-art-text/40 mb-6 font-sans">История циклов и периодов</p>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                      <BarChart
                        data={[
                          { name: 'Март', cycle: 28, period: 5 },
                          { name: 'Апр', cycle: 27, period: 6 },
                          { name: 'Май', cycle: 29, period: 5 },
                          { name: 'Июн', cycle: 28, period: 4 },
                        ]}
                        margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
                      >
                      <XAxis 
                        dataKey="name" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fill: '#2D2926', opacity: 0.4, fontStyle: 'uppercase' }} 
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fill: '#2D2926', opacity: 0.4 }} 
                      />
                      <Tooltip 
                        cursor={{ fill: 'transparent' }}
                        contentStyle={{ 
                          backgroundColor: '#FDFBF7', 
                          border: '1px solid rgba(45, 41, 38, 0.1)', 
                          fontSize: '12px',
                          borderRadius: '0px'
                        }}
                      />
                      <Bar 
                        dataKey="cycle" 
                        fill="#2D2926" 
                        opacity={0.05} 
                        radius={[0, 0, 0, 0]} 
                        name="Цикл"
                      />
                      <Bar 
                        dataKey="period" 
                        fill="#B16E5B" 
                        radius={[0, 0, 0, 0]} 
                        name="Период"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

                <div className="pt-8 w-full">
                  <p className="text-[10px] font-sans font-bold uppercase tracking-art text-art-text/40 mb-6 font-sans">Частота симптомов (последние 4 недели)</p>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                      <LineChart
                        data={symptomData}
                        margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
                      >
                      <XAxis 
                        dataKey="week" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fill: '#2D2926', opacity: 0.4 }} 
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fill: '#2D2926', opacity: 0.4 }} 
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#FDFBF7', 
                          border: '1px solid rgba(45, 41, 38, 0.1)', 
                          fontSize: '10px',
                          borderRadius: '0px'
                        }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="cramps" 
                        stroke="#B16E5B" 
                        strokeWidth={2}
                        dot={{ r: 3, fill: '#B16E5B', strokeWidth: 0 }}
                        name="Спазмы"
                      />
                      <Line 
                        type="monotone" 
                        dataKey="fatigue" 
                        stroke="#6D7E5E" 
                        strokeWidth={2}
                        dot={{ r: 3, fill: '#6D7E5E', strokeWidth: 0 }}
                        name="Усталость"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

                <div className="pt-8 w-full">
                  <p className="text-[10px] font-sans font-bold uppercase tracking-art text-art-text/40 mb-6 font-sans">Календарь настроения</p>
                  <div className="bg-art-text/5 p-6 border border-art-text/10">
                    <div className="grid grid-cols-7 mb-4">
                      {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(day => (
                        <div key={day} className="text-[8px] font-sans uppercase text-center opacity-30">{day}</div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-2">
                      {Array.from({ length: 30 }).map((_, i) => {
                        const date = format(addDays(new Date(), -29 + i), 'yyyy-MM-dd');
                        const log = state.logs[date];
                        
                        const moodMap: Record<string, { color: string, icon: string }> = {
                          happy: { color: 'bg-yellow-200 border-yellow-300 text-yellow-800', icon: '😊' },
                          sad: { color: 'bg-blue-100 border-blue-200 text-blue-800', icon: '😢' },
                          neutral: { color: 'bg-gray-100 border-gray-200 text-gray-800', icon: '😐' },
                          angry: { color: 'bg-red-100 border-red-200 text-red-800', icon: '😠' },
                          tired: { color: 'bg-purple-100 border-purple-200 text-purple-800', icon: '😴' },
                          stressed: { color: 'bg-orange-100 border-orange-200 text-orange-800', icon: '😰' }
                        };

                        const moodData = log?.mood ? moodMap[log.mood] : null;

                        return (
                          <button 
                            key={date} 
                            onClick={() => setShowLogModal(date)}
                            className={cn(
                              "aspect-square flex flex-col items-center justify-center border rounded-sm text-[10px] transition-all relative group cursor-pointer active:scale-90 hover:shadow-md hover:border-art-accent/50 hover:-translate-y-0.5",
                              moodData ? moodData.color : "bg-white border-art-text/10 text-art-text/20 hover:text-art-text/60"
                            )}
                            title={`${date}${log?.mood ? `: ${log.mood}` : ''}`}
                          >
                            <span className="text-[8px] opacity-40 absolute top-1 left-1">{format(parseISO(date), 'd')}</span>
                            <span className="mt-1">{moodData?.icon || '·'}</span>
                          </button>
                        );
                      })}
                    </div>
                    
                    <div className="mt-6 flex flex-wrap gap-4 pt-4 border-t border-art-text/10">
                      {Object.entries({
                        'Счастливая': 'bg-yellow-200',
                        'Нейтральная': 'bg-gray-100',
                        'Грустная': 'bg-blue-100',
                        'Злая': 'bg-red-100',
                        'Усталость': 'bg-purple-100',
                        'Стресс': 'bg-orange-100'
                      }).map(([label, color]) => (
                        <div key={label} className="flex items-center gap-2">
                          <div className={cn("w-2 h-2 rounded-full", color)} />
                          <span className="text-[8px] font-sans uppercase tracking-art opacity-60">{label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-8 w-full">
                  <p className="text-[10px] font-sans font-bold uppercase tracking-art text-art-text/40 mb-6 font-sans">Здоровье: Сон и Пульс</p>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                      <BarChart
                        data={[
                          { week: 'Н1', sleep: 7.2, hr: 68 },
                          { week: 'Н2', sleep: 6.8, hr: 72 },
                          { week: 'Н3', sleep: 7.5, hr: 69 },
                          { week: 'Н4', sleep: 6.5, hr: 75 },
                        ]}
                        margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
                      >
                      <XAxis 
                        dataKey="week" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fill: '#2D2926', opacity: 0.4 }} 
                      />
                      <YAxis 
                        yAxisId="left"
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 8, fill: '#B16E5B', opacity: 0.6 }} 
                      />
                      <YAxis 
                        yAxisId="right"
                        orientation="right"
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 8, fill: '#6D7E5E', opacity: 0.6 }} 
                      />
                      <Tooltip />
                      <Bar yAxisId="left" dataKey="sleep" fill="#B16E5B" radius={[2, 2, 0, 0]} name="Сон (ч)" />
                      <Bar yAxisId="right" dataKey="hr" fill="#6D7E5E" radius={[2, 2, 0, 0]} name="Пульс" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

                <div className="pt-8 w-full">
                  <p className="text-[10px] font-sans font-bold uppercase tracking-art text-art-text/40 mb-6 font-sans">Тренд веса (последние записи)</p>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                      <LineChart
                        data={weightData.length > 0 ? weightData : [
                          { date: '?', weight: state.logs[format(new Date(), 'yyyy-MM-dd')]?.weight || 60 }
                        ]}
                        margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
                      >
                      <XAxis 
                        dataKey="date" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 8, fill: '#2D2926', opacity: 0.4 }} 
                      />
                      <YAxis 
                        domain={['dataMin - 1', 'dataMax + 1']}
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fill: '#2D2926', opacity: 0.4 }} 
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#FDFBF7', 
                          border: '1px solid rgba(45, 41, 38, 0.1)', 
                          fontSize: '10px',
                          borderRadius: '0px'
                        }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="weight" 
                        stroke="#B16E5B" 
                        strokeWidth={2}
                        connectNulls
                        dot={{ r: 3, fill: '#B16E5B', strokeWidth: 0 }}
                        name="Вес (кг)"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                  {weightData.length === 0 && (
                    <p className="text-[10px] text-center opacity-30 mt-2">Нет данных о весе за последние 30 дней</p>
                  )}
                </div>
              </div>

                <div className="pt-8 space-y-4">
                  <p className="text-[10px] font-sans font-bold uppercase tracking-art text-art-text/40">Легенда</p>
                  <div className="flex flex-wrap gap-x-6 gap-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-art-text/10" />
                      <span className="text-[10px] font-sans uppercase tracking-art text-art-text/60">Цикл</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-art-accent" />
                      <span className="text-[10px] font-sans uppercase tracking-art text-art-text/60">Период</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-[2px] bg-art-accent" />
                      <span className="text-[10px] font-sans uppercase tracking-art text-art-text/60">Спазмы</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-[2px] bg-art-nature" />
                      <span className="text-[10px] font-sans uppercase tracking-art text-art-text/60">Усталость</span>
                    </div>
                    <div className="flex items-center gap-2">
                       <div className="w-3 h-[2px] bg-art-accent" />
                       <span className="text-[10px] font-sans uppercase tracking-art text-art-text/60">Вес</span>
                    </div>
                    <div className="flex items-center gap-2">
                       <span className="text-sm">😊</span>
                       <span className="text-[10px] font-sans uppercase tracking-art text-art-text/60">Настроение</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'settings' && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <SettingsView 
                settings={state.settings} 
                onUpdate={(s) => setState(p => ({ ...p, settings: s }))} 
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-art-bg/80 backdrop-blur-xl border-t border-art-text/5 p-4 flex justify-around items-center">
        <NavButton active={activeTab === 'home'} onClick={() => setActiveTab('home')} icon={<Home />} label="Сегодня" />
        <NavButton active={activeTab === 'calendar'} onClick={() => setActiveTab('calendar')} icon={<CalendarIcon />} label="Календарь" />
        <NavButton active={activeTab === 'stats'} onClick={() => setActiveTab('stats')} icon={<BarChart2 />} label="Аналитика" />
        <NavButton active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={<SettingsIcon />} label="Опции" />
      </nav>

      {/* Modal */}
      <AnimatePresence>
        {showLogModal && (
          <LogModal 
            date={showLogModal} 
            allLogs={state.logs}
            wearableConnected={state.settings.wearableConnected}
            onClose={() => setShowLogModal(null)} 
            onSave={(log) => {
              handleUpdateLog(showLogModal, log);
              setShowLogModal(null);
            }} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Sub-components ---

function NavButton({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex flex-col items-center p-3 transition-all",
        active ? "text-art-accent border-t-2 border-art-accent -mt-[2px]" : "text-art-text/30"
      )}
    >
      <span className="text-[9px] font-sans font-bold uppercase tracking-art-wide mt-1">{label}</span>
    </button>
  );
}

function CalendarView({ state, onSelectDay, onTogglePeriod }: { state: AppState, onSelectDay: (d: string) => void, onTogglePeriod: (d: string) => void }) {
  const [viewDate, setViewDate] = useState(new Date());
  const [isEditing, setIsEditing] = useState(false);
  const monthStart = startOfMonth(viewDate);
  const monthEnd = endOfMonth(monthStart);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const predictions = calculatePredictions(state.settings, state.logs);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-light italic capitalize">{format(viewDate, 'LLLL yyyy', { locale: ru })}</h2>
          <button 
            onClick={() => setIsEditing(!isEditing)}
            className={cn(
              "mt-2 text-[10px] font-sans font-bold uppercase tracking-art transition-colors",
              isEditing ? "text-art-accent" : "text-art-text/40 hover:text-art-text"
            )}
          >
            {isEditing ? "Готово" : "Изменить даты"}
          </button>
        </div>
        <div className="flex gap-4">
          <button onClick={() => setViewDate(subMonths(viewDate, 1))} className="opacity-40 hover:opacity-100 transition-opacity"><ChevronLeft size={24}/></button>
          <button onClick={() => setViewDate(addMonths(viewDate, 1))} className="opacity-40 hover:opacity-100 transition-opacity"><ChevronRight size={24}/></button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-4">
        {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(d => (
          <div key={d} className="text-center text-[10px] font-sans font-bold uppercase tracking-art opacity-30 py-2">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-4">
        {Array.from({ length: (monthStart.getDay() + 6) % 7 }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}
        
        {days.map(day => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const isPeriod = state.logs[dateStr]?.isPeriod;
          const isPredicted = !isPeriod && isSameDay(day, predictions.nextPeriodStart);
          
          return (
            <button
              key={dateStr}
              onClick={() => isEditing ? onTogglePeriod(dateStr) : onSelectDay(dateStr)}
              className={cn(
                "h-12 w-full relative flex items-center justify-center text-lg transition-all rounded-xl hover:bg-art-accent/5 cursor-pointer active:scale-90 border border-transparent",
                isToday(day) && "bg-art-text/5 border-art-text/10 italic font-bold after:content-[''] after:absolute after:bottom-1 after:w-1 after:h-1 after:bg-art-text after:rounded-full",
                isPeriod ? "text-art-accent font-bold scale-105 border-art-accent/20 bg-art-accent/5" : "text-art-text",
                isPredicted && "text-art-accent/40 border-dashed border-art-accent/20",
                isEditing && "hover:bg-red-50 hover:border-red-100"
              )}
            >
              {format(day, 'd')}
              {isPeriod && (
                <div className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-art-accent rounded-full" />
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-12 space-y-3 pt-8 border-t border-art-text/5">
        <LegendItem color="bg-art-accent" label="Ваш период" />
        <LegendItem color="bg-art-accent/30 border border-dashed border-art-accent" label="Прогноз периода" />
      </div>
    </div>
  );
}

function LegendItem({ color, label }: { color: string, label: string }) {
  return (
    <div className="flex items-center gap-4 text-[10px] font-sans uppercase tracking-art-wide text-art-text/60">
      <div className={cn("w-3 h-3 rounded-none", color)} />
      <span>{label}</span>
    </div>
  );
}

function LogModal({ date, allLogs, wearableConnected, onClose, onSave }: { date: string, allLogs: Record<string, DayLog>, wearableConnected: boolean, onClose: () => void, onSave: (log: Partial<DayLog>) => void }) {
  const existingLog = allLogs[date];
  const [isPeriod, setIsPeriod] = useState(existingLog?.isPeriod || false);
  const [flow, setFlow] = useState<'light' | 'medium' | 'heavy' | undefined>(existingLog?.flow);
  const [mood, setMood] = useState<Mood | undefined>(existingLog?.mood);
  const [symptoms, setSymptoms] = useState<Symptom[]>(existingLog?.symptoms || []);
  const [notes, setNotes] = useState(existingLog?.notes || '');
  const [sleepHours, setSleepHours] = useState(existingLog?.sleepHours || 7);
  const [avgHeartRate, setAvgHeartRate] = useState(existingLog?.avgHeartRate || 70);
  const [weight, setWeight] = useState(existingLog?.weight || 60);
  const [isSyncing, setIsSyncing] = useState(false);

  const simulateSync = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setSleepHours(7.5 + Math.random());
      setAvgHeartRate(Math.floor(65 + Math.random() * 10));
      setIsSyncing(false);
    }, 1500);
  };

  const moods: { type: Mood; icon: string }[] = [
    { type: 'happy', icon: '😊' },
    { type: 'neutral', icon: '😐' },
    { type: 'sad', icon: '😔' },
    { type: 'angry', icon: '😡' },
    { type: 'tired', icon: '😫' },
    { type: 'stressed', icon: '😰' },
  ];

  const symptomList: { type: Symptom; label: string }[] = [
    { type: 'cramps', label: 'Спазмы' },
    { type: 'headache', label: 'Головная боль' },
    { type: 'bloating', label: 'Вздутие' },
    { type: 'fatigue', label: 'Усталость' },
    { type: 'tender_breasts', label: 'Чувствительность' },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-art-text/20 backdrop-blur-sm flex items-end justify-center p-0"
      onClick={onClose}
    >
      <motion.div 
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        className="bg-art-bg w-full max-w-md border-t border-art-text/10 p-8 space-y-8 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-baseline">
          <h2 className="text-4xl font-light italic">{format(parseISO(date), 'd MMMM', { locale: ru })}</h2>
          <button onClick={onClose} className="text-art-text/40 hover:text-art-text font-sans text-xs uppercase tracking-art">Закрыть</button>
        </div>

        <div className="space-y-8">
          <section>
            <h3 className="text-[10px] font-sans font-bold uppercase tracking-art text-art-text/30 mb-4 text-center">Настроение за неделю</h3>
            <div className="flex justify-between items-end h-12 gap-1 px-2">
              {Array.from({ length: 7 }).map((_, i) => {
                const day = subDays(parseISO(date), 6 - i);
                const dayStr = format(day, 'yyyy-MM-dd');
                const dayLog = allLogs[dayStr];
                const moodData = moods.find(m => m.type === dayLog?.mood);
                
                return (
                  <div key={dayStr} className="flex-1 flex flex-col items-center gap-2">
                    <div className={cn(
                      "w-full h-8 rounded-sm transition-all flex items-center justify-center text-lg",
                      dayLog?.isPeriod ? "bg-art-accent/10" : "bg-art-text/5",
                      isSameDay(day, parseISO(date)) && "ring-1 ring-art-accent"
                    )}>
                      {moodData?.icon || <div className="w-1 h-1 bg-art-text/20 rounded-full" />}
                    </div>
                    <span className="text-[8px] font-sans uppercase opacity-30">{format(day, 'EEEEEE', { locale: ru })}</span>
                  </div>
                );
              })}
            </div>
          </section>

          <label className="flex items-center justify-between py-4 border-b border-art-text/5 cursor-pointer">
            <span className="font-sans text-[10px] font-bold uppercase tracking-art">Менструация сегодня</span>
            <div className={cn("w-6 h-6 rounded-none flex items-center justify-center border transition-all", isPeriod ? "bg-art-accent border-art-accent" : "border-art-text/10")}>
              {isPeriod && <Check size={14} className="text-white" />}
            </div>
            <input type="checkbox" className="hidden" checked={isPeriod} onChange={e => setIsPeriod(e.target.checked)} />
          </label>

          {isPeriod && (
            <motion.section
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="space-y-4"
            >
              <h3 className="text-[10px] font-sans font-bold uppercase tracking-art text-art-text/30">Обильность выделений</h3>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'light', label: 'Скудные' },
                  { id: 'medium', label: 'Средние' },
                  { id: 'heavy', label: 'Обильные' },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFlow(f.id as any)}
                    className={cn(
                      "py-3 border text-[10px] font-sans uppercase tracking-art transition-all",
                      flow === f.id 
                        ? "bg-art-accent border-art-accent text-white" 
                        : "bg-art-text/5 border-transparent text-art-text/40 hover:border-art-text/10"
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </motion.section>
          )}

          <section>
            <h3 className="text-[10px] font-sans font-bold uppercase tracking-art text-art-text/30 mb-4">Настроение</h3>
            <div className="flex justify-between">
              {moods.map(m => (
                <button 
                  key={m.type}
                  onClick={() => setMood(prev => prev === m.type ? undefined : m.type)}
                  className={cn(
                    "w-10 h-10 text-2xl flex items-center justify-center transition-all",
                    mood === m.type ? "grayscale-0 scale-125 brightness-110" : "grayscale opacity-30 hover:opacity-100"
                  )}
                  title={m.type}
                >
                  {m.icon}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-[10px] font-sans font-bold uppercase tracking-art text-art-text/30 mb-4">Симптомы</h3>
            <div className="flex flex-wrap gap-2">
              {symptomList.map(s => {
                const isActive = symptoms.includes(s.type);
                return (
                  <button
                    key={s.type}
                    onClick={() => setSymptoms(p => isActive ? p.filter(x => x !== s.type) : [...p, s.type])}
                    className={cn(
                      "px-4 py-2 rounded-full text-[10px] font-sans uppercase tracking-art transition-all border",
                      isActive ? "bg-art-text text-white border-art-text" : "bg-transparent text-art-text/40 border-art-text/10"
                    )}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <h3 className="text-[10px] font-sans font-bold uppercase tracking-art text-art-text/30 mb-4">Данные о здоровье</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-art-text/5 p-4 space-y-2">
                <p className="text-[10px] font-sans uppercase opacity-40">Сон (часы)</p>
                <input 
                  type="number" step="0.5"
                  value={sleepHours}
                  onChange={e => setSleepHours(parseFloat(e.target.value))}
                  className="bg-transparent border-0 text-xl font-light w-full focus:outline-none"
                />
              </div>
              <div className="bg-art-text/5 p-4 space-y-2">
                <p className="text-[10px] font-sans uppercase opacity-40">Пульс (уд/мин)</p>
                <input 
                  type="number"
                  value={avgHeartRate}
                  onChange={e => setAvgHeartRate(parseInt(e.target.value))}
                  className="bg-transparent border-0 text-xl font-light w-full focus:outline-none"
                />
              </div>
              <div className="bg-art-text/5 p-4 col-span-2 space-y-2">
                <p className="text-[10px] font-sans uppercase opacity-40">Вес (кг)</p>
                <input 
                  type="number" step="0.1"
                  value={weight}
                  onChange={e => setWeight(parseFloat(e.target.value))}
                  className="bg-transparent border-0 text-xl font-light w-full focus:outline-none"
                />
              </div>
            </div>
            {wearableConnected && (
              <button 
                onClick={simulateSync}
                disabled={isSyncing}
                className="mt-4 w-full py-3 border border-art-nature/20 text-art-nature text-[10px] font-sans font-bold uppercase tracking-art-wide hover:bg-art-nature/5 transition-all flex items-center justify-center gap-2"
              >
                <Zap size={12} className={cn(isSyncing && "animate-pulse")} />
                {isSyncing ? "Синхронизация..." : "Синхронизировать с Apple Watch"}
              </button>
            )}
          </section>

          <section>
            <h3 className="text-[10px] font-sans font-bold uppercase tracking-art text-art-text/30 mb-4">Заметки</h3>
            <textarea 
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Как прошел ваш день?"
              className="w-full h-24 bg-art-text/5 border-0 p-4 font-serif text-sm focus:outline-none focus:ring-1 focus:ring-art-accent/20 resize-none transition-all"
            />
          </section>
        </div>

        <Button onClick={() => onSave({ isPeriod, flow, mood, symptoms, notes, sleepHours, avgHeartRate, weight })} className="w-full">
          Сохранить состояние
        </Button>
      </motion.div>
    </motion.div>
  );
}

function Toggle({ label, checked, onChange }: { label: string, checked: boolean, onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between py-4 cursor-pointer">
      <span className="text-[10px] font-sans font-bold uppercase tracking-art text-art-text/60">{label}</span>
      <div 
        onClick={() => onChange(!checked)}
        className={cn(
          "w-10 h-5 flex items-center p-1 transition-colors",
          checked ? "bg-art-accent" : "bg-art-text/10"
        )}
      >
        <div className={cn("w-3 h-3 bg-white transition-transform", checked ? "translate-x-5" : "translate-x-0")} />
      </div>
    </label>
  );
}

function SettingsView({ settings, onUpdate }: { settings: UserSettings, onUpdate: (s: UserSettings) => void }) {
  const requestPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        alert('Пожалуйста, разрешите уведомления в настройках браузера.');
      }
    } else {
      alert('Ваш браузер не поддерживает уведомления.');
    }
  };

  const updateNotify = (key: keyof UserSettings['notifications'], value: boolean) => {
    onUpdate({
      ...settings,
      notifications: {
        ...settings.notifications,
        [key]: value
      }
    });
    if (value) requestPermission();
  };

  return (
    <div className="space-y-12">
      <h2 className="text-4xl font-light">Настройки</h2>
      
      <div className="space-y-12">
        <section className="space-y-8">
          <p className="text-[10px] font-sans font-bold uppercase tracking-art text-art-accent opacity-60">Параметры цикла</p>
          <div className="space-y-10">
            <div className="border-b border-art-text/10 pb-6">
              <label className="block text-[10px] font-sans font-bold uppercase tracking-art text-art-text/40 mb-4">Длительность цикла</label>
              <div className="flex items-center gap-6">
                <input 
                  type="range" min="20" max="45" 
                  value={settings.averageCycleLength}
                  onChange={(e) => onUpdate({ ...settings, averageCycleLength: parseInt(e.target.value) })}
                  className="flex-1 accent-art-accent h-[1px] bg-art-text/10"
                />
                <span className="text-2xl font-light italic w-8 text-right">{settings.averageCycleLength}</span>
              </div>
            </div>

            <div className="border-b border-art-text/10 pb-6">
              <label className="block text-[10px] font-sans font-bold uppercase tracking-art text-art-text/40 mb-4">Длительность периода</label>
              <div className="flex items-center gap-6">
                <input 
                  type="range" min="2" max="10" 
                  value={settings.averagePeriodLength}
                  onChange={(e) => onUpdate({ ...settings, averagePeriodLength: parseInt(e.target.value) })}
                  className="flex-1 accent-art-accent h-[1px] bg-art-text/10"
                />
                <span className="text-2xl font-light italic w-8 text-right">{settings.averagePeriodLength}</span>
              </div>
            </div>

            <div className="bg-art-accent/5 p-6 border border-art-accent/10">
              <div className="flex items-center gap-2 mb-4">
                <CalendarIcon size={12} className="text-art-accent" />
                <label className="block text-[10px] font-sans font-bold uppercase tracking-art text-art-accent">Начало последнего цикла</label>
              </div>
              <input 
                type="date"
                value={settings.lastPeriodStart}
                onChange={(e) => onUpdate({ ...settings, lastPeriodStart: e.target.value })}
                className="w-full bg-transparent border-b-2 border-art-accent/30 py-2 text-2xl font-light focus:outline-none focus:border-art-accent transition-colors cursor-pointer"
              />
              <p className="text-[9px] font-sans uppercase opacity-30 mt-4 leading-relaxed tracking-wider">
                Выберите первый день вашей последней менструации для точности прогнозов
              </p>
            </div>

            <div className="bg-art-text/5 p-6 border border-art-text/10">
              <div className="flex items-center gap-2 mb-4">
                <UserIcon size={12} className="text-art-text/40" />
                <label className="block text-[10px] font-sans font-bold uppercase tracking-art text-art-text/40">Дата рождения</label>
              </div>
              <input 
                type="date"
                value={settings.birthDate}
                onChange={(e) => onUpdate({ ...settings, birthDate: e.target.value })}
                className="w-full bg-transparent border-b-2 border-art-text/10 py-2 text-2xl font-light focus:outline-none focus:border-art-accent transition-colors cursor-pointer"
              />
              <p className="text-[9px] font-sans uppercase opacity-30 mt-4 leading-relaxed tracking-wider">
                Используется для персонализации рекомендаций и советов
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <div className="flex items-center gap-2 mb-4">
            <Bell size={14} className="text-art-accent" />
            <p className="text-[10px] font-sans font-bold uppercase tracking-art text-art-accent opacity-60">Уведомления</p>
          </div>
          <div className="border-t border-art-text/5 divide-y divide-art-text/5">
            <Toggle 
              label="Начало периода" 
              checked={settings.notifications.periodStart} 
              onChange={(v) => updateNotify('periodStart', v)} 
            />
            <Toggle 
              label="День овуляции" 
              checked={settings.notifications.ovulationDay} 
              onChange={(v) => updateNotify('ovulationDay', v)} 
            />
            <Toggle 
              label="Фертильное окно" 
              checked={settings.notifications.fertileWindow} 
              onChange={(v) => updateNotify('fertileWindow', v)} 
            />
          </div>
          <p className="text-[9px] font-sans leading-relaxed opacity-40 uppercase tracking-wider">
            Мы пришлем вам напоминание за день до события.
          </p>
        </section>

        <section className="space-y-8">
          <p className="text-[10px] font-sans font-bold uppercase tracking-art text-art-accent opacity-60">Здоровье и устройства</p>
          <div className="bg-art-text/5 p-8 border border-art-text/10">
            <div className="flex items-center justify-between mb-6">
              <div className="space-y-1">
                <h3 className="text-xl font-light italic">Apple Watch</h3>
                <p className="text-[10px] font-sans uppercase opacity-40">Сон, пульс и активность</p>
              </div>
              <div className={cn(
                "w-2 h-2 rounded-full shadow-[0_0_8px]",
                settings.wearableConnected ? "bg-art-nature shadow-art-nature/40" : "bg-art-text/20 shadow-transparent"
              )}></div>
            </div>
            
            <button 
              onClick={() => onUpdate({ ...settings, wearableConnected: !settings.wearableConnected })}
              className={cn(
                "w-full py-4 text-[10px] font-sans font-bold uppercase tracking-art-wide transition-all border",
                settings.wearableConnected 
                  ? "border-red-400/20 text-red-400 hover:bg-red-400/5" 
                  : "bg-art-text text-white border-art-text hover:bg-art-text/90"
              )}
            >
              {settings.wearableConnected ? "Отключить устройство" : "Подключить устройство"}
            </button>
          </div>
          <p className="text-[9px] font-sans leading-relaxed opacity-40 uppercase tracking-wider">
            Luna автоматически импортирует ваш сон и пульс для более точных прогнозов.
          </p>
        </section>
      </div>
      
      <div className="pt-8">
        <button className="text-[10px] font-sans font-bold uppercase tracking-art text-red-400 opacity-50 hover:opacity-100 transition-opacity underline underline-offset-4" onClick={() => {
           if(confirm('Вы уверены?')) {
             localStorage.clear();
             window.location.reload();
           }
        }}>
          Удалить все данные
        </button>
      </div>
    </div>
  );
}
