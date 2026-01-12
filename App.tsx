import React, { useState, useEffect, useCallback, useRef } from 'react';
import { audioService } from './services/audioService';
import { NatureSound, NoiseColor, AudioSettings, AudioState } from './types';
import Controls from './components/Controls';
import Visualizer from './components/Visualizer';

const App: React.FC = () => {
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
          text: 'Check out this 5Hz Theta meditation app for deep focus.',
          url: window.location.href,
        });
      } catch (err) {
        console.log('Error sharing:', err);
      }
    } else {
      // Fallback for browsers that don't support native share
      navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard!');
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

  const formatDurationLabel = (mins: number) => {
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  const ticks = [
    { val: 1, label: '1m' },
    { val: 30, label: '30m' },
    { val: 60, label: '1h' },
    { val: 90, label: '1.5h' },
    { val: 120, label: '2h' },
    { val: 150, label: '2.5h' },
    { val: 180, label: '3h' },
  ];

  return (
    <div className="min-h-screen flex flex-col w-full max-w-md mx-auto bg-slate-50 font-sans box-border selection:bg-sky-100 pb-12">
      <header className="sticky top-0 z-50 h-14 flex items-center justify-between px-4 shrink-0 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <h1 className="text-sm font-black tracking-[0.3em] text-slate-600 uppercase">
          Zen<span className="text-sky-600">Beats</span>
        </h1>
        <button 
          onClick={handleShare}
          className="p-2 text-slate-400 hover:text-sky-600 active:scale-90 transition-all"
          aria-label="Share App"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
        </button>
      </header>

      <main className="flex flex-col px-6 py-6 space-y-[25px]">
        {/* Duration Section */}
        <section className="flex flex-col shrink-0 px-2">
          <div className="flex justify-between items-end mb-4 px-1">
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Duration</span>
              <span className="text-2xl font-black text-slate-800 tracking-tight leading-none">
                {formatDurationLabel(settings.duration)}
              </span>
            </div>
            <span className="text-[10px] font-bold text-sky-600 uppercase bg-sky-50 px-2 py-1 rounded border border-sky-100">
              Session Length
            </span>
          </div>
          
          <div className="relative pt-1 pb-10">
            <input
              type="range" min="1" max="180" step="1" 
              value={settings.duration}
              disabled={state.isPlaying}
              onChange={(e) => updateSettings({ duration: parseInt(e.target.value) })}
              className={`w-full relative z-10 ${state.isPlaying ? 'opacity-30' : ''}`}
            />
            
            <div className="absolute top-8 left-0 w-full px-[14px] pointer-events-none">
              {ticks.map((tick) => {
                const position = ((tick.val - 1) / (180 - 1)) * 100;
                const isReached = settings.duration >= tick.val;
                return (
                  <div 
                    key={tick.val} 
                    className="absolute flex flex-col items-center"
                    style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
                  >
                    <div className={`w-px h-1.5 mb-2 ${isReached ? 'bg-sky-500' : 'bg-slate-300'}`} />
                    <span className={`text-[9px] font-bold uppercase whitespace-nowrap ${isReached ? 'text-sky-600' : 'text-slate-400'}`}>
                      {tick.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Timer Visualizer Display */}
        <div className="h-32 flex items-center bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden px-8 relative shrink-0">
           <div className="absolute inset-0 opacity-10 pointer-events-none">
             <Visualizer isPlaying={state.isPlaying} />
           </div>
           <div className="flex-1 z-10">
             <div className="text-5xl font-black text-slate-800 tabular-nums leading-none tracking-tight">
               {formatTime(state.timeLeft)}
             </div>
             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">
               {state.isPlaying ? 'Active Session' : 'Ready to start'}
             </p>
           </div>
           <button
             onClick={togglePlay}
             className={`w-16 h-16 rounded-full flex items-center justify-center transition-all transform active:scale-90 shadow-lg z-10 ${
               state.isPlaying ? 'bg-rose-500 text-white' : 'bg-sky-600 text-white'
             }`}
           >
             {state.isPlaying ? (
               <svg className="h-7 w-7" fill="currentColor" viewBox="0 0 24 24"><rect x="7" y="7" width="10" height="10" rx="2" /></svg>
             ) : (
               <svg className="h-8 w-8 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
             )}
           </button>
        </div>

        <div className="pb-8">
          <Controls settings={settings} updateSettings={updateSettings} disabled={false} />
        </div>
      </main>
    </div>
  );
};

export default App;