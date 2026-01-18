
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
    const updateSize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    
    updateSize();

    let phase = 0;
    const TWO_PI = Math.PI * 2;

    const animate = () => {
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;
      
      ctx.clearRect(0, 0, width, height);
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
      const color = isDark ? '56, 189, 248' : '14, 165, 233';
      const opacity = isDark ? 0.25 : 0.4;
      
      const gradient = ctx.createLinearGradient(0, 0, width, 0);
      gradient.addColorStop(0, `rgba(${color}, 0)`);
      gradient.addColorStop(0.5, `rgba(${color}, ${opacity})`);
      gradient.addColorStop(1, `rgba(${color}, 0)`);
      
      ctx.strokeStyle = gradient;
      ctx.lineWidth = isDark ? 2 : 3;

      // Draw with slightly fewer points for CPU optimization
      const step = 2;
      for (let x = 0; x < width; x += step) {
        const wave = Math.sin(x * 0.02 + phase) * (height / 6);
        const y = height / 2 + wave;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Soft secondary wave
      ctx.beginPath();
      ctx.strokeStyle = isDark ? 'rgba(56, 189, 248, 0.03)' : 'rgba(14, 165, 233, 0.1)';
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 4) {
        const y = height / 2 + Math.cos(x * 0.01 + phase * 0.4) * (height / 4);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Keep phase in reasonable range to avoid precision artifacts over hours
      phase = (phase + 0.025) % TWO_PI;
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
