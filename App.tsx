
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { audioService } from './services/audioService';
import { NatureSound, NoiseColor, AudioSettings, AudioState } from './types';
import Controls from './components/Controls';
import Visualizer from './components/Visualizer';

const App: React.FC = () => {
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('zenbeats-theme');
    return saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  const [settings, setSettings] = useState<AudioSettings>({
    binauralVolume: 0.5,
    natureVolume: 0.5,
    noiseVolume: 0.2,
    masterVolume: 0.6,
    frequency: 5, 
    selectedNatures: [NatureSound.SEA],
    selectedNoise: NoiseColor.NONE,
    duration: 30,
  });

  const [state, setState] = useState<AudioState>({
    isPlaying: false,
    timeLeft: 30 * 60,
  });

  const timerRef = useRef<number | null>(null);
  const endTimeRef = useRef<number | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
    localStorage.setItem('zenbeats-theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  useEffect(() => {
    if (state.isPlaying) {
      audioService.setBinauralVolume(settings.binauralVolume);
      audioService.setNatureVolume(settings.natureVolume);
      audioService.setNoiseVolume(settings.noiseVolume);
      audioService.setMasterVolume(settings.masterVolume);
      audioService.updateFrequency(settings.frequency);
      audioService.updateNatures(settings.selectedNatures);
      audioService.updateNoise(settings.selectedNoise);
    }
  }, [settings, state.isPlaying]);

  const togglePlay = useCallback(async () => {
    if (state.isPlaying) {
      audioService.stop();
      setState(prev => ({ ...prev, isPlaying: false }));
      if (timerRef.current) clearInterval(timerRef.current);
    } else {
      await audioService.start(
        settings.selectedNatures, 
        settings.selectedNoise, 
        settings.frequency, 
        settings.masterVolume
      );
      
      const sessionDurationMs = settings.duration * 60 * 1000;
      endTimeRef.current = Date.now() + sessionDurationMs;

      setState(prev => ({ 
        ...prev, 
        isPlaying: true, 
        timeLeft: settings.duration * 60 
      }));

      timerRef.current = window.setInterval(() => {
        if (!endTimeRef.current) return;
        const now = Date.now();
        const remaining = Math.max(0, Math.floor((endTimeRef.current - now) / 1000));
        setState(prev => {
          if (remaining <= 0) {
            audioService.stop();
            if (timerRef.current) clearInterval(timerRef.current);
            return { ...prev, isPlaying: false, timeLeft: 0 };
          }
          return { ...prev, timeLeft: remaining };
        });
      }, 500);
    }
  }, [state.isPlaying, settings]);

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'ZenBeats',
          text: 'Check out this 5Hz Theta meditation app.',
          url: window.location.href,
        });
      } catch (err) {}
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('Link copied!');
    }
  };

  const updateSettings = (newSettings: Partial<AudioSettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      if (newSettings.duration !== undefined && !state.isPlaying) {
        setState(s => ({ ...s, timeLeft: newSettings.duration! * 60 }));
      }
      return updated;
    });
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const ticks = [
    { val: 1, label: '1m' },
    { val: 30, label: '30m' },
    { val: 60, label: '1h' },
    { val: 120, label: '2h' },
    { val: 180, label: '3h' },
  ];

  return (
    <div className="min-h-screen flex flex-col w-full max-w-md mx-auto font-sans box-border selection:bg-sky-100 pb-12 transition-colors duration-400">
      <header className="sticky top-0 z-50 h-16 flex items-center justify-between px-4 shrink-0 bg-white/70 dark:bg-slate-950/70 backdrop-blur-xl border-b border-slate-200 dark:border-slate-900">
        <div className="flex items-center gap-1">
          <button 
            onClick={() => setShowInstallGuide(true)}
            className="p-2 text-slate-500 dark:text-slate-400 hover:text-sky-600 active:scale-90 transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </button>
          <button 
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-2 text-slate-500 dark:text-amber-500/80 hover:text-sky-600 active:scale-90 transition-all"
          >
            {isDarkMode ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
        </div>

        <h1 className="text-sm font-black tracking-[0.3em] text-slate-900 dark:text-slate-100 uppercase">
          Zen<span className="text-sky-600">Beats</span>
        </h1>
        
        <button 
          onClick={handleShare}
          className="p-2 text-slate-500 dark:text-slate-400 hover:text-sky-600 active:scale-90 transition-all"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
        </button>
      </header>

      {showInstallGuide && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-md">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[32px] p-8 shadow-2xl relative text-slate-900 dark:text-white border border-transparent dark:border-slate-800">
            <button onClick={() => setShowInstallGuide(false)} className="absolute top-4 right-4 p-2 opacity-50"><svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            <div className="text-center space-y-4">
              <h2 className="text-xl font-black uppercase tracking-tight">Add to Phone</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Install for full-screen background play.</p>
              <div className="space-y-6 pt-6 text-left">
                <p className="text-sm"><span className="font-bold text-sky-600 mr-2">iOS</span> Tap Share → "Add to Home Screen"</p>
                <p className="text-sm"><span className="font-bold text-sky-600 mr-2">Android</span> Tap menu → "Install App"</p>
              </div>
              <button onClick={() => setShowInstallGuide(false)} className="w-full mt-8 bg-sky-600 text-white font-black uppercase py-4 rounded-2xl">Got it</button>
            </div>
          </div>
        </div>
      )}

      <main className="flex flex-col px-6 py-6 space-y-8 no-scrollbar overflow-y-auto">
        {/* Duration Section */}
        <section className="flex flex-col shrink-0">
          <div className="flex justify-between items-end mb-4">
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase text-slate-900 dark:text-slate-500 tracking-widest mb-1">Duration</span>
              <span className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight leading-none">
                {settings.duration}m
              </span>
            </div>
          </div>
          
          <div className="relative pt-1 pb-10">
            <input
              type="range" min="1" max="180" step="1" 
              value={settings.duration}
              disabled={state.isPlaying}
              onChange={(e) => updateSettings({ duration: parseInt(e.target.value) })}
              className={`w-full relative z-10 ${state.isPlaying ? 'opacity-30' : ''}`}
            />
            <div className="absolute top-8 left-0 w-full px-1 pointer-events-none flex justify-between">
              {ticks.map((tick) => (
                <div key={tick.val} className="flex flex-col items-center">
                  <div className={`w-px h-1 mb-2 bg-slate-300 dark:bg-slate-700`} />
                  <span className={`text-[9px] font-black uppercase ${settings.duration >= tick.val ? 'text-sky-600 dark:text-sky-500' : 'text-slate-400 dark:text-slate-600'}`}>{tick.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Timer Display - SOLID SLATE-900 GREY IN DARK MODE */}
        <div className="h-40 flex items-center bg-white dark:bg-slate-900 rounded-[40px] border border-slate-200 dark:border-slate-800 shadow-2xl dark:shadow-none overflow-hidden px-8 relative shrink-0">
           <div className="absolute inset-0 pointer-events-none">
             <Visualizer isPlaying={state.isPlaying} />
           </div>
           <div className="flex-1 z-10">
             <div className="text-6xl font-black text-slate-900 dark:text-slate-100 tabular-nums leading-none tracking-tighter">
               {formatTime(state.timeLeft)}
             </div>
             <p className="text-[10px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-[0.2em] mt-3">
               {state.isPlaying ? 'Flowing Deep' : 'Ready to start'}
             </p>
           </div>
           <button
             onClick={togglePlay}
             className={`w-20 h-20 rounded-full flex items-center justify-center transition-all transform active:scale-90 shadow-xl z-10 ${
               state.isPlaying ? 'bg-rose-500/90 text-white' : 'bg-sky-600 text-white'
             }`}
           >
             {state.isPlaying ? (
               <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 24 24"><rect x="7" y="7" width="10" height="10" rx="2" /></svg>
             ) : (
               <svg className="h-9 w-9 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
             )}
           </button>
        </div>

        <Controls settings={settings} updateSettings={updateSettings} disabled={false} />
      </main>
    </div>
  );
};

export default App;
