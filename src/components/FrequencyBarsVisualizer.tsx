import React, { useState, useEffect, useRef } from 'react';
import { t } from '../config/language';

const FrequencyBarsVisualizer: React.FC = () => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [dominantFrequency, setDominantFrequency] = useState<number | null>(null);
  const [voiceActive, setVoiceActive] = useState(false);
  const [voiceIntensity, setVoiceIntensity] = useState<'normal' | 'medium' | 'high'>('normal');
  const [showHelp, setShowHelp] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const microphoneRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);

  const frequencyBarsCount = 64;

  // Setup frequency bars divs refs
  const barsContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isAnalyzing) {
      // Cleanup on stop
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
      if (microphoneRef.current) {
        microphoneRef.current.disconnect();
        microphoneRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      setDominantFrequency(null);
      setVoiceActive(false);
      if (barsContainerRef.current) {
        const bars = barsContainerRef.current.querySelectorAll<HTMLDivElement>('.frequency-bar');
        bars.forEach(bar => {
          bar.style.height = '0px';
          bar.style.backgroundColor = 'hsl(120, 80%, 60%, 0)';
        });
      }
      return;
    }

    // Start audio context and analyser
    const startAnalyzing = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;

        const microphone = audioContext.createMediaStreamSource(stream);
        microphone.connect(analyser);

        audioContextRef.current = audioContext;
        analyserRef.current = analyser;
        microphoneRef.current = microphone;

        const bufferLength = analyser.frequencyBinCount;
        dataArrayRef.current = new Uint8Array(bufferLength);

        const bars = barsContainerRef.current?.querySelectorAll<HTMLDivElement>('.frequency-bar');
        const barCount = bars?.length || 0;

        const visualize = () => {
          if (!analyserRef.current || !dataArrayRef.current || !barsContainerRef.current) return;

          analyserRef.current.getByteFrequencyData(dataArrayRef.current);

          // Find dominant frequency
          let maxIndex = 0;
          let maxValue = 0;
          for (let i = 0; i < dataArrayRef.current.length; i++) {
            if (dataArrayRef.current[i] > maxValue && dataArrayRef.current[i] > 100) {
              maxValue = dataArrayRef.current[i];
              maxIndex = i;
            }
          }
          const sampleRate = audioContextRef.current?.sampleRate || 44100;
          const dominantFreq = Math.round(maxIndex * sampleRate / analyserRef.current.fftSize);
          setDominantFrequency(dominantFreq);

          // Voice detection thresholds - ajustados para mayor sensibilidad
          const voiceThreshold = 40; // Umbral más bajo para detectar voz normal
          const mediumVoiceThreshold = 120; // Umbral para voz alta
          const highVoiceThreshold = 180; // Umbral para gritos
          
          const voiceDetected = maxValue > voiceThreshold;
          setVoiceActive(voiceDetected);
          
          // Determine voice intensity level
          if (maxValue > highVoiceThreshold) {
            setVoiceIntensity('high'); // Gritando
          } else if (maxValue > mediumVoiceThreshold) {
            setVoiceIntensity('medium'); // Alzando la voz
          } else {
            setVoiceIntensity('normal'); // Hablando normal
          }

          // Update bars with enhanced visualization
          if (bars) {
            const step = Math.floor(dataArrayRef.current.length / barCount);
            for (let i = 0; i < barCount; i++) {
              // Usar un factor de amplificación para hacer las barras más visibles
              const value = dataArrayRef.current[i * step];
              // Amplificar la altura para barras más visibles
              const amplificationFactor = voiceActive ? 2.2 : 2;
              const height = Math.min(value * amplificationFactor, 190); // Limitar altura máxima
              bars[i].style.height = `${height}px`;

              const opacity = Math.min(1, value / 255);
              
              // Color based on voice intensity
              let color;
              if (voiceDetected) {
                if (voiceIntensity === 'high') {
                  color = `hsla(0, 80%, 60%, ${opacity})`; // Rojo para gritos
                } else if (voiceIntensity === 'medium') {
                  color = `hsla(60, 80%, 60%, ${opacity})`; // Amarillo para voz alzada
                } else {
                  color = `hsla(120, 80%, 60%, ${opacity})`; // Verde para voz normal
                }
              } else {
                color = `hsla(120, 80%, 60%, ${opacity * 0.5})`; // Verde apagado cuando no hay voz
              }
              
              bars[i].style.backgroundColor = color;
            }
          }

          animationFrameIdRef.current = requestAnimationFrame(visualize);
        };

        visualize();
      } catch (error) {
        console.error('Error accessing microphone:', error);
        setIsAnalyzing(false);
      }
    };

    startAnalyzing();

    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
      if (microphoneRef.current) {
        microphoneRef.current.disconnect();
        microphoneRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, [isAnalyzing]);

  const toggleAnalyzing = () => {
    setIsAnalyzing(prev => !prev);
  };

  return (
    <div className="bg-gray-800 rounded-xl p-6 shadow-lg mb-8 max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-emerald-400 mb-2">{t('voiceFrequencyAnalyzer')}</h1>
        <p className="text-gray-400">{t('realTimeVisualization')}</p>
        <button 
          onClick={() => setShowHelp(!showHelp)} 
          className="mt-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
        >
          {showHelp ? t('hideHelp') : t('showHelp')}
        </button>
        
        {showHelp && (
          <div className="mt-4 p-4 bg-gray-700 rounded-lg text-left text-sm">
            <h3 className="font-bold text-blue-400 mb-2">{t('howItWorks')}:</h3>
            <ul className="list-disc pl-5 space-y-2">
              <li><span className="text-green-500 font-bold">{t('green')}</span>: {t('normalVoice')}</li>
              <li><span className="text-yellow-400 font-bold">{t('yellow')}</span>: {t('loudVoice')}</li>
              <li><span className="text-red-500 font-bold">{t('red')}</span>: {t('shouting')}</li>
            </ul>
            <p className="mt-2">{t('speakToMicrophone')}</p>
          </div>
        )}
      </div>

      <div id="analyzerContainer" className="bg-gray-800 rounded-xl p-6 shadow-lg mb-8">
        <div id="statusIndicator" className="flex items-center mb-6">
          <div
            id="micStatus"
            className={`w-3 h-3 rounded-full mr-2 pulse-animation ${isAnalyzing ? 'bg-emerald-500' : 'bg-red-500'}`}
          ></div>
          <span id="statusText" className="text-sm text-gray-400">
            {isAnalyzing ? t('capturingAudio') : t('microphoneInactive')}
          </span>
        </div>

        <div
          id="frequencyBars"
          ref={barsContainerRef}
          className="bg-gray-700 rounded-lg p-4 mb-6 flex items-end"
          style={{ height: '200px' }}
        >
          {Array.from({ length: frequencyBarsCount }).map((_, i) => (
            <div
              key={i}
              className="frequency-bar bg-emerald-400 rounded-full"
              style={{ width: '3px', margin: '0 1px', height: '0px', verticalAlign: 'bottom' }}
            ></div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div id="currentFreq" className="bg-gray-700 p-4 rounded-lg">
            <h3 className="text-sm font-semibold text-gray-400 mb-2">{t('dominantFrequency').toUpperCase()}</h3>
            <p className="text-2xl font-bold text-emerald-400">{dominantFrequency !== null ? `${dominantFrequency} Hz` : '-- Hz'}</p>
          </div>
          <div
            id="voiceDetected"
            className={`bg-gray-700 p-4 rounded-lg ${voiceActive ? 'voice-detected' : ''}`}
          >
            <h3 className="text-sm font-semibold text-gray-400 mb-2">{t('voiceLevel').toUpperCase()}</h3>
            {voiceActive ? (
              <p className={`text-2xl font-bold ${voiceIntensity === 'high' ? 'text-red-500' : voiceIntensity === 'medium' ? 'text-yellow-400' : 'text-green-500'}`}>
                {voiceIntensity === 'high' ? t('shouting').toUpperCase() : voiceIntensity === 'medium' ? t('loudVoice').toUpperCase() : t('normal').toUpperCase()}
              </p>
            ) : (
              <p className="text-2xl font-bold text-gray-400">{t('inactive').toUpperCase()}</p>
            )}
          </div>
        </div>
        
        {/* Barra de intensidad de voz */}
        <div className="bg-gray-700 p-4 rounded-lg mb-4">
          <h3 className="text-sm font-semibold text-gray-400 mb-2">{t('voiceIntensity').toUpperCase()}</h3>
          <div className="w-full h-6 bg-gray-800 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-300 ${voiceIntensity === 'high' ? 'bg-red-500' : voiceIntensity === 'medium' ? 'bg-yellow-400' : 'bg-green-500'}`}
              style={{ 
                width: voiceActive ? 
                  (voiceIntensity === 'high' ? '100%' : voiceIntensity === 'medium' ? '66%' : '33%') : 
                  '0%' 
              }}
            ></div>
          </div>
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>{t('normal')}</span>
            <span>{t('loudVoice')}</span>
            <span>{t('shouting')}</span>
          </div>
        </div>

        <div className="mt-6 flex justify-center">
          <button
            id="toggleMic"
            onClick={toggleAnalyzing}
            className={`${isAnalyzing ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'} text-white font-bold py-3 px-6 rounded-lg transition-all flex items-center gap-2`}
          >
            {isAnalyzing ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                </svg>
                {t('stopAnalysis')}
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                </svg>
                {t('startAnalysis')}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FrequencyBarsVisualizer;
