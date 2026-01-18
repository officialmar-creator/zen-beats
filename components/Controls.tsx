import React from 'react';
import { NatureSound, AudioSettings, NoiseColor } from '../types';

interface ControlsProps {
  settings: AudioSettings;
  updateSettings: (newSettings: Partial<AudioSettings>) => void;
  disabled: boolean;
}

const Controls: React.FC<ControlsProps> = ({ settings, updateSettings, disabled }) => {
  const toggleNature = (sound: NatureSound) => {
    if (sound === NatureSound.NONE) {
      updateSettings({ selectedNatures: [] });
      return;
    }
    let newNatures = [...settings.selectedNatures];
    if (newNatures.includes(sound)) {
      newNatures = newNatures.filter(n => n !== sound);
    } else {
      if (newNatures.length >= 2) newNatures.shift();
      newNatures.push(sound);
    }
    updateSettings({ selectedNatures: newNatures });
  };

  const brainwaveStates = [
    { label: 'Alpha', freq: 10, hz: '10Hz' },
    { label: 'Beta', freq: 15, hz: '15Hz' },
    { label: 'Delta', freq: 2, hz: '2Hz' },
    { label: 'Theta', freq: 5, hz: '5Hz' }
  ];

  const natureMeta: Record<NatureSound, { img: string }> = {
    [NatureSound.SEA]: { img: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80&w=400' }, 
    [NatureSound.RAIN]: { img: 'https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?auto=format&fit=crop&q=80&w=400' },
    [NatureSound.BIRDS]: { img: 'https://images.unsplash.com/photo-1550853024-fae8cd4be47f?auto=format&fit=crop&q=80&w=400' }, 
    [NatureSound.FOREST]: { img: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&q=80&w=400' },
    [NatureSound.WIND]: { img: 'https://images.unsplash.com/photo-1530906358829-e84b2769270f?auto=format&fit=crop&q=80&w=400' }, 
    [NatureSound.NIGHT]: { img: 'https://images.unsplash.com/photo-1501418611786-e29f9929fe03?auto=format&fit=crop&q=80&w=400' },
    [NatureSound.NONE]: { img: '' }
  };

  return (
    <div className="flex flex-col space-y-10 pb-10">
      
      {/* Brainwave Selection */}
      <section className="flex flex-col space-y-4">
        <h3 className="text-[10px] font-black uppercase text-slate-900 dark:text-slate-500 tracking-[0.2em] px-1">Target Brainwave</h3>
        <div className="grid grid-cols-4 bg-slate-200/50 dark:bg-slate-900/50 p-1 rounded-2xl gap-1 border border-slate-200 dark:border-slate-800">
          {brainwaveStates.map((state) => (
            <button
              key={state.label}
              onClick={() => updateSettings({ frequency: state.freq })}
              className={`flex flex-col items-center justify-center py-3 rounded-xl transition-all ${
                settings.frequency === state.freq 
                  ? 'bg-white dark:bg-slate-950 text-sky-700 dark:text-sky-400 shadow-lg dark:shadow-none border border-transparent dark:border-sky-500/30' 
                  : 'text-slate-600 dark:text-slate-600'
              } active:scale-95`}
            >
              <span className="text-[10px] font-black uppercase tracking-widest">{state.label}</span>
              <span className="text-[8px] font-bold opacity-70 mt-0.5">{state.hz}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Soundscapes Selection */}
      <section className="flex flex-col space-y-4">
        <h3 className="text-[10px] font-black uppercase text-slate-900 dark:text-slate-500 tracking-[0.2em] px-1">Ambient Landscapes</h3>
        <div className="grid grid-cols-2 gap-4">
          {Object.values(NatureSound).filter(s => s !== NatureSound.NONE).map((sound) => {
            const isActive = settings.selectedNatures.includes(sound);
            return (
              <button
                key={sound}
                onClick={() => toggleNature(sound)}
                className={`relative h-28 rounded-[24px] overflow-hidden transition-all border-2 flex items-center justify-center bg-slate-100 dark:bg-slate-900 ${
                  isActive ? 'border-sky-500 shadow-2xl ring-4 ring-sky-500/10' : 'border-transparent dark:border-slate-900'
                } active:scale-95`}
              >
                <div 
                  className="absolute inset-0 bg-cover bg-center"
                  style={{ backgroundImage: `url(${natureMeta[sound].img})` }}
                />
                <div className={`absolute inset-0 transition-opacity ${isActive ? 'bg-black/20' : 'bg-black/60'}`} />
                <span className={`relative text-[10px] font-black uppercase tracking-[0.2em] text-white drop-shadow-[0_4px_12px_rgba(0,0,0,1)] z-10 ${isActive ? 'scale-110' : 'opacity-90'}`}>
                  {sound}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Noise Texture Selection */}
      <section className="flex flex-col space-y-4">
        <h3 className="text-[10px] font-black uppercase text-slate-900 dark:text-slate-500 tracking-[0.2em] px-1">Static Texture</h3>
        <div className="grid grid-cols-5 gap-1.5 p-1 bg-slate-200/50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800">
          {Object.values(NoiseColor).map((color) => (
            <button
              key={color}
              onClick={() => updateSettings({ selectedNoise: color })}
              className={`py-3 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all ${
                settings.selectedNoise === color 
                  ? 'bg-white dark:bg-slate-950 text-sky-600 dark:text-sky-400 shadow-md dark:shadow-none border border-transparent dark:border-sky-500/20' 
                  : 'text-slate-600 dark:text-slate-600 hover:text-sky-600'
              }`}
            >
              {color === NoiseColor.NONE ? 'Off' : color}
            </button>
          ))}
        </div>
      </section>

      {/* Mixer Dashboard */}
      <section className="bg-white dark:bg-slate-950 p-8 rounded-[40px] border border-slate-200 dark:border-slate-800 shadow-2xl dark:shadow-none space-y-8 transition-colors duration-400">
        <div className="flex flex-col items-center space-y-1">
          <h3 className="text-[10px] font-black uppercase text-slate-900 dark:text-slate-400 tracking-[0.2em]">Mixer</h3>
        </div>
        
        <div className="space-y-8">
          <div className="space-y-3">
            <div className="flex justify-between items-center px-1">
              <span className="text-[10px] font-black uppercase text-slate-900 dark:text-slate-500 tracking-widest">Binaural Pulse</span>
              <span className="text-[12px] font-black text-sky-600 dark:text-sky-500">{Math.round(settings.binauralVolume * 200)}%</span>
            </div>
            <input
              type="range" min="0" max="0.5" step="0.01" value={settings.binauralVolume}
              onChange={(e) => updateSettings({ binauralVolume: parseFloat(e.target.value) })}
            />
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center px-1">
              <span className="text-[10px] font-black uppercase text-slate-900 dark:text-slate-500 tracking-widest">Atmosphere</span>
              <span className="text-[12px] font-black text-sky-600 dark:text-sky-500">{Math.round(settings.natureVolume * 200)}%</span>
            </div>
            <input
              type="range" min="0" max="0.5" step="0.01" value={settings.natureVolume}
              onChange={(e) => updateSettings({ natureVolume: parseFloat(e.target.value) })}
            />
          </div>

          <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
            <div className="space-y-3">
              <div className="flex justify-between items-center px-1">
                <span className="text-[10px] font-black uppercase text-slate-900 dark:text-slate-500 tracking-widest">Master Power</span>
                <span className="text-[12px] font-black text-sky-600 dark:text-sky-500">{Math.round(settings.masterVolume * 100)}%</span>
              </div>
              <input
                type="range" min="0" max="1" step="0.01" value={settings.masterVolume}
                onChange={(e) => updateSettings({ masterVolume: parseFloat(e.target.value) })}
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default Controls;