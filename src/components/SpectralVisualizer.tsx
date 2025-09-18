import React, { useRef, useEffect } from 'react';

interface AudioData {
  frequency: number;
  amplitude: number;
  pitch: number;
  volume: number;
  timestamp: number;
  frequencyData?: Uint8Array;
}

interface SpectralVisualizerProps {
  audioData: AudioData;
  isRecording: boolean;
}

export const SpectralVisualizer: React.FC<SpectralVisualizerProps> = ({ audioData, isRecording }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Ajustar tamaño del canvas
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    const drawSpectrum = () => {
      if (!audioData.frequencyData || !isRecording) {
        // Limpiar canvas cuando no hay datos
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Dibujar texto indicativo
        ctx.fillStyle = '#666666';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Sin datos de audio', canvas.width / 2, canvas.height / 2);
        return;
      }

      const width = canvas.width;
      const height = canvas.height;
      const dataArray = audioData.frequencyData;
      const bufferLength = dataArray.length;

      // Limpiar canvas con gradiente
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, '#000000');
      gradient.addColorStop(1, '#1a1a1a');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      // Configurar parámetros para el análisis espectral
      const sampleRate = 44100; // Frecuencia de muestreo estándar
      const nyquist = sampleRate / 2;
      const frequencyResolution = nyquist / bufferLength;

      // Dibujar el espectro de frecuencias
      const barWidth = width / bufferLength;
      
      for (let i = 0; i < bufferLength; i++) {
        const amplitude = dataArray[i];
        const frequency = i * frequencyResolution;
        
        // Calcular altura de la barra basada en la amplitud
        const barHeight = (amplitude / 255) * height * 0.8;
        
        // Color basado en la frecuencia
        let hue = 0;
        if (frequency < 300) {
          hue = 240; // Azul para frecuencias bajas (graves)
        } else if (frequency < 2000) {
          hue = 120; // Verde para frecuencias medias
        } else if (frequency < 8000) {
          hue = 60;  // Amarillo para frecuencias altas
        } else {
          hue = 0;   // Rojo para frecuencias muy altas
        }
        
        const intensity = amplitude / 255;
        const saturation = 70 + intensity * 30;
        const lightness = 30 + intensity * 40;
        
        ctx.fillStyle = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
        ctx.fillRect(i * barWidth, height - barHeight, barWidth - 1, barHeight);
        
        // Resaltar frecuencia dominante
        if (Math.abs(frequency - audioData.frequency) < frequencyResolution * 2 && audioData.frequency > 0) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(i * barWidth, height - barHeight - 10, barWidth - 1, 5);
        }
      }

      // Dibujar información de frecuencias en tiempo real
      ctx.fillStyle = '#ffffff';
      ctx.font = '14px monospace';
      ctx.textAlign = 'left';
      
      // Etiquetas de frecuencia
      const frequencyLabels = [100, 500, 1000, 2000, 5000, 10000];
      frequencyLabels.forEach(freq => {
        if (freq < nyquist) {
          const x = (freq / nyquist) * width;
          ctx.fillStyle = '#888888';
          ctx.fillRect(x, 0, 1, height);
          ctx.fillStyle = '#ffffff';
          ctx.fillText(`${freq}Hz`, x + 2, 15);
        }
      });

      // Información actual
      ctx.fillStyle = '#00ff00';
      ctx.font = '16px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`Frecuencia dominante: ${audioData.frequency} Hz`, width - 10, 30);
      ctx.fillText(`Amplitud: ${audioData.amplitude}`, width - 10, 50);
      ctx.fillText(`Tono: ${audioData.pitch} Hz`, width - 10, 70);
      ctx.fillText(`Volumen: ${audioData.volume}`, width - 10, 90);

      // Dibujar línea de frecuencia dominante
      if (audioData.frequency > 0) {
        const x = (audioData.frequency / nyquist) * width;
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
        
        // Etiqueta de frecuencia dominante
        ctx.fillStyle = '#ff0000';
        ctx.font = '12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${audioData.frequency}Hz`, x, height - 10);
      }
    };

    drawSpectrum();
    
    if (isRecording) {
      animationRef.current = requestAnimationFrame(() => drawSpectrum());
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [audioData, isRecording]);

  return (
    <div className="mb-6">
      <canvas
        ref={canvasRef}
        width={800}
        height={300}
        className="w-full bg-black rounded-lg border border-green-500/30"
        style={{ maxHeight: '300px' }}
      />
      <div className="mt-2 text-xs text-gray-400 text-center">
        Análisis espectral en tiempo real - Las líneas verticales indican frecuencias de referencia
      </div>
    </div>
  );
};