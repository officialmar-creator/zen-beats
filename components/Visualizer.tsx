
import React, { useEffect, useRef } from 'react';

interface VisualizerProps {
  isPlaying: boolean;
}

const Visualizer: React.FC<VisualizerProps> = ({ isPlaying }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    let phase = 0;

    const animate = () => {
      ctx.clearRect(0, 0, rect.width, rect.height);
      const width = rect.width;
      const height = rect.height;
      const isDark = document.documentElement.classList.contains('dark');

      if (!isPlaying) {
        ctx.beginPath();
        ctx.strokeStyle = isDark ? 'rgba(56, 189, 248, 0.05)' : 'rgba(14, 165, 233, 0.1)';
        ctx.setLineDash([4, 4]);
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.stroke();
        ctx.setLineDash([]);
        return;
      }

      // 5Hz Primary Wave
      ctx.beginPath();
      const gradient = ctx.createLinearGradient(0, 0, width, 0);
      const color = isDark ? '56, 189, 248' : '14, 165, 233';
      const opacity = isDark ? 0.25 : 0.5;
      
      gradient.addColorStop(0, `rgba(${color}, 0)`);
      gradient.addColorStop(0.5, `rgba(${color}, ${opacity})`);
      gradient.addColorStop(1, `rgba(${color}, 0)`);
      
      ctx.strokeStyle = gradient;
      ctx.lineWidth = isDark ? 3 : 4;

      for (let x = 0; x < width; x++) {
        const wave = Math.sin(x * 0.02 + phase) * (height / 6);
        const y = height / 2 + wave;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Soft secondary wave
      ctx.beginPath();
      ctx.strokeStyle = isDark ? 'rgba(56, 189, 248, 0.05)' : 'rgba(14, 165, 233, 0.15)';
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x++) {
        const y = height / 2 + Math.cos(x * 0.01 + phase * 0.4) * (height / 4);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      phase += 0.03;
      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);

    return () => {
      if (requestRef.current !== null) cancelAnimationFrame(requestRef.current);
    };
  }, [isPlaying]);

  return (
    <div className="w-full h-full relative overflow-hidden bg-transparent">
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
};

export default Visualizer;
