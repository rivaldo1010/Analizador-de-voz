import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, MicOff, Play, Pause, BarChart3, Volume2, Brain, Activity } from 'lucide-react';
import { AudioUploader } from './components/AudioUploader';
import { ProfanityFilter } from './components/ProfanityFilter';
import { BloodPressureMonitor } from './components/BloodPressureMonitor';
import { AudioListener } from './components/AudioListener';
import { AudioConnectionStatus } from './components/AudioConnectionStatus';
import FrequencyBarsVisualizer from './components/FrequencyBarsVisualizer';
import { t, LANG } from './config/language';

interface AudioData {
  frequency: number;
  amplitude: number;
  pitch: number;
  volume: number;
}

function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [audioData, setAudioData] = useState<AudioData>({
    frequency: 0,
    amplitude: 0,
    pitch: 0,
    volume: 0
  });
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [profanityCount, setProfanityCount] = useState(0);
  const [profanityWords, setProfanityWords] = useState<string[]>([]);
  const [stressLevel, setStressLevel] = useState(0);
  const [isNervous, setIsNervous] = useState(false);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const recognitionRef = useRef<any>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const streamRef = useRef<MediaStream | null>(null);
  const restartTimeoutRef = useRef<number | undefined>();

  // Inicializar reconocimiento de voz con manejo de errores mejorado
  useEffect(() => {
    // Limpiar cualquier instancia previa
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // Ignorar errores al detener
      }
      recognitionRef.current = null;
    }
    
    // Verificar soporte del navegador
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      try {
        const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
        recognitionRef.current = new SpeechRecognition();
        
        // Configurar opciones
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;
        
        // Agregar manejo de errores para la creación del objeto
        if (!recognitionRef.current) {
          console.error('No se pudo crear el objeto de reconocimiento de voz');
          return;
        }
      recognitionRef.current.lang = LANG;
      recognitionRef.current.maxAlternatives = 1;

      recognitionRef.current.onresult = (event: any) => {
        let finalTranscript = '';
        let interimTranscript = '';

        // Procesar todos los resultados disponibles
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcriptPart = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcriptPart + ' ';
          } else {
            interimTranscript += transcriptPart;
          }
        }

        // Actualizar inmediatamente la transcripción
        if (finalTranscript) {
          setTranscript(prev => prev + finalTranscript);
        }
        setInterimTranscript(interimTranscript);
        
        // Forzar actualización del DOM para evitar retrasos en la UI
        requestAnimationFrame(() => {});
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Error de reconocimiento:', event.error);
        
        // Manejo mejorado de errores de reconocimiento
        if (isTranscribing) {
          // Diferentes tiempos de espera según el tipo de error
          let retryDelay = 1000; // Tiempo predeterminado
          
          if (event.error === 'network') {
            console.log('Error de red detectado, reintentando con retraso progresivo...');
            // Para errores de red, usamos un retraso más largo para dar tiempo a que se restablezca la conexión
            retryDelay = 3000;
          } else if (event.error === 'no-speech') {
            retryDelay = 1500;
          } else if (event.error === 'audio-capture') {
            retryDelay = 2000;
          }
          
          // Limpiar cualquier reinicio pendiente antes de programar uno nuevo
          if (restartTimeoutRef.current) {
            clearTimeout(restartTimeoutRef.current);
          }
          
          restartTimeoutRef.current = setTimeout(() => {
            if (isTranscribing && recognitionRef.current) {
              try {
                console.log(`Reintentando reconocimiento después de error: ${event.error}`);
                recognitionRef.current.start();
              } catch (e) {
                console.log('Error al reiniciar reconocimiento:', e);
              }
            }
          }, retryDelay);
        }
      };

      recognitionRef.current.onend = () => {
        console.log('Reconocimiento de voz finalizado');
        // Reiniciar automáticamente si aún estamos transcribiendo
        if (isTranscribing) {
          // Limpiar cualquier reinicio pendiente antes de programar uno nuevo
          if (restartTimeoutRef.current) {
            clearTimeout(restartTimeoutRef.current);
          }
          
          // Reiniciar inmediatamente para evitar interrupciones en la transcripción
          restartTimeoutRef.current = setTimeout(() => {
            if (recognitionRef.current && isTranscribing) {
              try {
                console.log('Reiniciando reconocimiento después de finalización...');
                recognitionRef.current.start();
              } catch (e) {
                console.log('Error al reiniciar reconocimiento:', e);
              }
            }
          }, 100); // Reducimos el tiempo de espera para una transcripción más continua
        }
      };

      recognitionRef.current.onstart = () => {
        console.log('Reconocimiento de voz iniciado');
      };
      
      console.log('Objeto de reconocimiento de voz inicializado correctamente');
      } catch (error) {
        console.error('Error al inicializar el reconocimiento de voz:', error);
        recognitionRef.current = null;
      }
    } else {
      console.warn('Este navegador no soporta reconocimiento de voz');
    }
    
    // Función de limpieza al desmontar el componente
    return () => {
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
      }
      
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // Ignorar errores al detener
        }
      }
    };
  }, [isTranscribing]);

  // Función mejorada para analizar frecuencias
  const analyzeAudio = useCallback(() => {
    if (!analyserRef.current) return;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const frequencyArray = new Float32Array(bufferLength);
    
    analyserRef.current.getByteFrequencyData(dataArray);
    analyserRef.current.getFloatFrequencyData(frequencyArray);

    // Calcular frecuencia dominante con mayor precisión
    let maxAmplitude = 0;
    let dominantFrequency = 0;
    const sampleRate = audioContextRef.current?.sampleRate || 44100;
    
    // Buscar pico de frecuencia más prominente
    for (let i = 1; i < bufferLength - 1; i++) {
      if (dataArray[i] > maxAmplitude && dataArray[i] > dataArray[i-1] && dataArray[i] > dataArray[i+1]) {
        maxAmplitude = dataArray[i];
        dominantFrequency = (i * sampleRate) / (bufferLength * 2);
      }
    }

    // Calcular volumen RMS
    const rms = Math.sqrt(dataArray.reduce((sum, value) => sum + value * value, 0) / bufferLength);
    
    // Calcular pitch usando autocorrelación mejorada
    const pitch = calculatePitchImproved(dataArray, sampleRate);

    const newAudioData = {
      frequency: Math.round(dominantFrequency),
      amplitude: Math.round(maxAmplitude),
      pitch: pitch > 0 ? Math.round(pitch) : 0,
      volume: Math.round(rms)
    };

    setAudioData(newAudioData);

    // Dibujar visualización mejorada
    drawVisualizationImproved(dataArray);

    if (isRecording) {
      animationRef.current = requestAnimationFrame(analyzeAudio);
    }
  }, [isRecording]);

  // Ajustar tamaño del canvas para evitar distorsión
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Ajustar tamaño del canvas al tamaño real del elemento
    const rect = canvas.getBoundingClientRect();
    if (canvas.width !== rect.width || canvas.height !== rect.height) {
      canvas.width = rect.width;
      canvas.height = rect.height;
    }
  }, []);

  // Función mejorada para calcular pitch
  const calculatePitchImproved = (buffer: Uint8Array, sampleRate: number): number => {
    const SIZE = buffer.length;
    const MAX_SAMPLES = Math.floor(SIZE / 2);
    let bestOffset = -1;
    let bestCorrelation = 0;
    let rms = 0;

    // Calcular RMS
    for (let i = 0; i < SIZE; i++) {
      const val = (buffer[i] - 128) / 128;
      rms += val * val;
    }
    rms = Math.sqrt(rms / SIZE);
    
    if (rms < 0.01) return -1;

    // Autocorrelación mejorada
    for (let offset = Math.floor(sampleRate / 800); offset < MAX_SAMPLES; offset++) {
      let correlation = 0;
      for (let i = 0; i < MAX_SAMPLES; i++) {
        correlation += Math.abs(((buffer[i] - 128) / 128) - ((buffer[i + offset] - 128) / 128));
      }
      correlation = 1 - (correlation / MAX_SAMPLES);
      
      if (correlation > 0.9 && correlation > bestCorrelation) {
        bestCorrelation = correlation;
        bestOffset = offset;
      }
    }
    
    return bestCorrelation > 0.01 ? sampleRate / bestOffset : -1;
  };

  // Función mejorada para dibujar la visualización
  const drawVisualizationImproved = (dataArray: Uint8Array) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Limpiar canvas con gradiente
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#000000');
    gradient.addColorStop(1, '#1a1a1a');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    const barWidth = (width / dataArray.length) * 2.5;
    let x = 0;

    // Dibujar barras con efectos mejorados
    for (let i = 0; i < dataArray.length; i++) {
      const barHeight = (dataArray[i] / 255) * height;
      
      // Gradiente de color dinámico
      const intensity = dataArray[i] / 255;
      const hue = (i / dataArray.length) * 360;
      
      const barGradient = ctx.createLinearGradient(0, height - barHeight, 0, height);
      barGradient.addColorStop(0, `hsla(${hue}, 100%, ${50 + intensity * 30}%, 0.8)`);
      barGradient.addColorStop(1, `hsla(${hue}, 100%, ${30 + intensity * 20}%, 1)`);
      
      ctx.fillStyle = barGradient;
      ctx.fillRect(x, height - barHeight, barWidth, barHeight);
      
      // Efecto de brillo en las barras más altas
      if (intensity > 0.7) {
        ctx.shadowColor = `hsl(${hue}, 100%, 50%)`;
        ctx.shadowBlur = 10;
        ctx.fillRect(x, height - barHeight, barWidth, barHeight);
        ctx.shadowBlur = 0;
      }
      
      x += barWidth + 1;
    }

    // Dibujar línea de forma de onda
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    for (let i = 0; i < dataArray.length; i++) {
      const y = height - (dataArray[i] / 255) * height;
      if (i === 0) {
        ctx.moveTo((i / dataArray.length) * width, y);
      } else {
        ctx.lineTo((i / dataArray.length) * width, y);
      }
    }
    ctx.stroke();
  };

  // Iniciar grabación mejorada
  const startRecording = async () => {
    try {
      // Detener cualquier stream anterior si existe
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100,
          channelCount: 1
        } 
      });
      
      // Guardar el stream para que esté disponible para el AudioListener
      streamRef.current = stream;

      // Configurar contexto de audio con mejor configuración
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        await audioContextRef.current.close();
      }

      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 44100
      });
      
      const source = audioContextRef.current.createMediaStreamSource(stream);
      
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 4096; // Mayor resolución
      analyserRef.current.smoothingTimeConstant = 0.3; // Menos suavizado para mejor respuesta
      analyserRef.current.minDecibels = -90;
      analyserRef.current.maxDecibels = -10;
      
      source.connect(analyserRef.current);

      setIsRecording(true);
      analyzeAudio();

    } catch (error) {
      console.error('Error al acceder al micrófono:', error);
      alert('Error al acceder al micrófono. Por favor, permite el acceso al micrófono.');
    }
  };

  // Detener grabación
  const stopRecording = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
    }
    
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    
    setIsRecording(false);
    setAudioData({ frequency: 0, amplitude: 0, pitch: 0, volume: 0 });
  };

  // Iniciar transcripción mejorada con manejo de errores robusto
  const startTranscription = () => {
    // Verificar si el navegador tiene soporte para reconocimiento de voz
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      alert('Tu navegador no soporta el reconocimiento de voz. Intenta con Chrome, Edge o Safari.');
      return;
    }
    
    // Limpiar cualquier reinicio pendiente antes de iniciar
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = undefined;
    }
    
    setIsTranscribing(true);
    
    try {
      // Detener cualquier reconocimiento previo
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // Ignorar errores al detener
        }
      }
      
      // Crear un nuevo objeto de reconocimiento para evitar problemas de estado
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      
      // Configurar opciones optimizadas para transcripción en tiempo real
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.maxAlternatives = 1;
      recognitionRef.current.lang = LANG;
      
      // Configurar manejadores de eventos
      recognitionRef.current.onresult = (event: any) => {
        let finalTranscript = '';
        let interimTranscript = '';

        // Procesar todos los resultados disponibles
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcriptPart = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcriptPart + ' ';
          } else {
            interimTranscript += transcriptPart;
          }
        }

        // Actualizar inmediatamente la transcripción
        if (finalTranscript) {
          setTranscript(prev => prev + finalTranscript);
        }
        setInterimTranscript(interimTranscript);
        
        // Forzar actualización del DOM para evitar retrasos en la UI
        requestAnimationFrame(() => {});
      };
      
      recognitionRef.current.onerror = (event: any) => {
        console.error('Error de reconocimiento:', event.error);
        
        // Manejo mejorado de errores de reconocimiento
        if (isTranscribing) {
          // Diferentes tiempos de espera según el tipo de error
          let retryDelay = 1000; // Tiempo predeterminado
          
          if (event.error === 'network') {
            console.log('Error de red detectado, reintentando con retraso progresivo...');
            // Para errores de red, usamos un retraso más largo para dar tiempo a que se restablezca la conexión
            retryDelay = 3000;
          } else if (event.error === 'no-speech') {
            retryDelay = 1500;
          } else if (event.error === 'audio-capture') {
            retryDelay = 2000;
          }
          
          // Limpiar cualquier reinicio pendiente antes de programar uno nuevo
          if (restartTimeoutRef.current) {
            clearTimeout(restartTimeoutRef.current);
          }
          
          restartTimeoutRef.current = setTimeout(() => {
            if (isTranscribing && recognitionRef.current) {
              try {
                console.log(`Reintentando reconocimiento después de error: ${event.error}`);
                recognitionRef.current.start();
              } catch (e) {
                console.log('Error al reiniciar reconocimiento:', e);
              }
            }
          }, retryDelay);
        }
      };
      
      recognitionRef.current.onend = () => {
        console.log('Reconocimiento de voz finalizado');
        // Reiniciar automáticamente si aún estamos transcribiendo
        if (isTranscribing) {
          // Limpiar cualquier reinicio pendiente antes de programar uno nuevo
          if (restartTimeoutRef.current) {
            clearTimeout(restartTimeoutRef.current);
          }
          
          // Reiniciar inmediatamente para evitar interrupciones en la transcripción
          restartTimeoutRef.current = setTimeout(() => {
            if (recognitionRef.current && isTranscribing) {
              try {
                console.log('Reiniciando reconocimiento después de finalización...');
                recognitionRef.current.start();
              } catch (e) {
                console.log('Error al reiniciar reconocimiento:', e);
              }
            }
          }, 100); // Reducimos el tiempo de espera para una transcripción más continua
        }
      };
      
      // Iniciar el reconocimiento
      recognitionRef.current.start();
      console.log('Reconocimiento iniciado correctamente');
      
    } catch (error) {
      console.error('Error al iniciar reconocimiento:', error);
      
      // Intentar recuperarse del error
      setTimeout(() => {
        try {
          // Intentar crear un nuevo objeto de reconocimiento
          const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
          recognitionRef.current = new SpeechRecognition();
          recognitionRef.current.continuous = true;
          recognitionRef.current.interimResults = true;
          recognitionRef.current.lang = LANG;
          recognitionRef.current.start();
          console.log('Reconocimiento recuperado después de error');
        } catch (retryError) {
          console.error('No se pudo recuperar del error de reconocimiento:', retryError);
          setIsTranscribing(false);
          alert('No se pudo iniciar el reconocimiento de voz. Por favor, recarga la página e intenta de nuevo.');
        }
      }, 500);
    }
  };

  // Detener transcripción con limpieza completa
  const stopTranscription = () => {
    console.log('Deteniendo transcripción...');
    setIsTranscribing(false);
    
    // Limpiar todos los timeouts pendientes
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = undefined;
    }
    
    // Detener el reconocimiento actual
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
        console.log('Reconocimiento detenido correctamente');
      } catch (error) {
        console.error('Error al detener reconocimiento:', error);
      }
    }
  };

  // Limpiar transcripción
  const clearTranscript = () => {
    setTranscript('');
    setInterimTranscript('');
  };

  // Manejar análisis de audio subido
  const handleAudioAnalysis = (data: any) => {
    setAudioData({
      frequency: data.frequency,
      amplitude: data.amplitude,
      pitch: data.pitch,
      volume: data.volume
    });

    if (data.dataArray && canvasRef.current) {
      drawVisualizationImproved(data.dataArray);
    }
  };

  // Manejar detección de profanidad
  const handleProfanityDetected = (count: number, words: string[]) => {
    setProfanityCount(count);
    setProfanityWords(words);
  };

  // Manejar cambios en el nivel de estrés
  const handleStressLevelChange = (level: number, nervous: boolean) => {
    setStressLevel(level);
    setIsNervous(nervous);
  };

  // Cleanup al desmontar
  useEffect(() => {
    return () => {
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8 p-8 bg-gradient-to-r from-green-900/50 to-blue-900/50 rounded-2xl border border-green-500/30">
          <h1 className="text-4xl font-bold text-green-400 mb-4 flex items-center justify-center gap-3">
            <Volume2 className="w-10 h-10" />
            {t('appTitle')}
          </h1>
          <p className="text-xl text-green-300">Análisis completo de audio, detección de estrés y transcripción inteligente</p>
        </div>

        {/* Panel de estado general */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className={`p-4 rounded-lg border ${isRecording ? 'bg-green-900/30 border-green-500' : 'bg-gray-800/30 border-gray-600'}`}>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${isRecording ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`}></div>
              <span className="font-semibold">Audio: {isRecording ? t('active') : t('inactive')}</span>
            </div>
          </div>

          <div className={`p-4 rounded-lg border ${isTranscribing ? 'bg-blue-900/30 border-blue-500' : 'bg-gray-800/30 border-gray-600'}`}>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${isTranscribing ? 'bg-blue-400 animate-pulse' : 'bg-gray-500'}`}></div>
              <span className="font-semibold">{t('transcript')}: {isTranscribing ? t('active') : t('inactive')}</span>
            </div>
          </div>

          <div className={`p-4 rounded-lg border ${profanityCount > 0 ? 'bg-red-900/30 border-red-500' : 'bg-gray-800/30 border-gray-600'}`}>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${profanityCount > 0 ? 'bg-red-400' : 'bg-green-400'}`}></div>
              <span className="font-semibold">{t('profanityCount')}: {profanityCount}</span>
            </div>
          </div>

          <div className={`p-4 rounded-lg border ${isNervous ? 'bg-orange-900/30 border-orange-500' : 'bg-gray-800/30 border-gray-600'}`}>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${isNervous ? 'bg-orange-400 animate-pulse' : 'bg-green-400'}`}></div>
              <span className="font-semibold">{t('state')}: {isNervous ? t('nervous') : t('calm')}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Controles de Audio en Tiempo Real */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
            <h2 className="text-2xl font-bold text-green-400 mb-6 flex items-center gap-2">
              <Mic className="w-6 h-6" />
              {t('realTimeAudio')}
            </h2>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              <button
                onClick={isRecording ? stopRecording : startRecording}
                className={`flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all ${
                  isRecording 
                    ? 'bg-red-600 hover:bg-red-700 text-white' 
                    : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
              >
                {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                {isRecording ? t('stopRecording') : t('startRecording')}
              </button>

              <button
                onClick={isTranscribing ? stopTranscription : startTranscription}
                className={`flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all ${
                  isTranscribing 
                    ? 'bg-red-600 hover:bg-red-700 text-white' 
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {isTranscribing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                {isTranscribing ? t('stopTranscription') : t('startTranscription')}
              </button>
            </div>

            {/* Datos de Audio como en la imagen */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-black/50 p-4 rounded-lg border border-green-500/30">
                <div className="text-green-400 font-semibold mb-1">{t('frequency')}</div>
                <div className="text-3xl font-mono text-green-300">{audioData.frequency} Hz</div>
              </div>
              
              <div className="bg-black/50 p-4 rounded-lg border border-blue-500/30">
                <div className="text-blue-400 font-semibold mb-1">{t('amplitude')}</div>
                <div className="text-3xl font-mono text-blue-300">{audioData.amplitude}</div>
              </div>
              
              <div className="bg-black/50 p-4 rounded-lg border border-purple-500/30">
                <div className="text-purple-400 font-semibold mb-1">{t('pitch')}</div>
                <div className="text-3xl font-mono text-purple-300">
                  {audioData.pitch > 0 ? `${audioData.pitch} Hz` : '0 Hz'}
                </div>
              </div>
              
              <div className="bg-black/50 p-4 rounded-lg border border-yellow-500/30">
                <div className="text-yellow-400 font-semibold mb-1">{t('volume')}</div>
                <div className="text-3xl font-mono text-yellow-300">{audioData.volume}</div>
              </div>
            </div>
          </div>

          {/* Transcripción */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
            <h2 className="text-2xl font-bold text-blue-400 mb-6 flex items-center gap-2">
              <Brain className="w-6 h-6" />
              Transcripción Inteligente
            </h2>
            
            <div className="mb-4">
              <button
                onClick={clearTranscript}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-all"
              >
                Limpiar Texto
              </button>
            </div>

            <div className="bg-black/50 border border-gray-600 rounded-lg p-4 min-h-[200px] max-h-[300px] overflow-y-auto">
              <div className="text-white leading-relaxed">
                {transcript}
                <span className="text-gray-400 italic">{interimTranscript}</span>
                {isTranscribing && (
                  <span className="inline-block w-2 h-5 bg-green-400 ml-1 animate-pulse"></span>
                )}
              </div>
            </div>
            
            <div className="mt-4 flex items-center justify-between">
              {isTranscribing && (
                <div className="flex items-center gap-2 text-green-400">
                  <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-sm">Transcribiendo continuamente...</span>
                </div>
              )}
              <div className="text-sm text-gray-400">
                {transcript.split(' ').filter(word => word.length > 0).length} palabras
              </div>
            </div>
          </div>
        </div>

        {/* Escucha de Audio */}
        <div className="mb-8">
          <AudioConnectionStatus isRecording={isRecording} isListening={isListening} />
          <AudioListener 
            isRecording={isRecording}
            audioStream={streamRef.current}
            isListening={isListening}
            setIsListening={setIsListening}
          />
        </div>

        {/* Subir Audio */}
        <div className="mb-8">
          <AudioUploader 
            onAudioAnalysis={handleAudioAnalysis}
            onTranscriptUpdate={setTranscript}
          />
        </div>

        {/* Filtro de Profanidad */}
        <div className="mb-8">
          <ProfanityFilter 
            transcript={transcript + ' ' + interimTranscript}
            onProfanityDetected={handleProfanityDetected}
          />
        </div>

        {/* Monitor de Presión Arterial */}
        <div className="mb-8">
          <BloodPressureMonitor 
            onStressLevelChange={handleStressLevelChange}
          />
        </div>

        {/* Visualización de Frecuencias */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
          <h2 className="text-2xl font-bold text-green-400 mb-6 flex items-center gap-2">
            <BarChart3 className="w-6 h-6" />
            {t('spectralVisualization')}
          </h2>
          
          <FrequencyBarsVisualizer />
          
          <div className="mt-4 text-sm text-gray-400 text-center">
            {t('spectralAnalysisDescription')}
          </div>
        </div>

        {/* Panel de análisis integral */}
        <div className="mt-8 bg-gradient-to-r from-purple-900/30 to-blue-900/30 rounded-xl p-6 border border-purple-500/30">
          <h2 className="text-2xl font-bold text-purple-400 mb-6 flex items-center gap-2">
            <Activity className="w-6 h-6" />
            {t('integralAnalysis')}
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-4xl mb-2">🎤</div>
              <div className="text-lg font-semibold text-white">{t('audio')}</div>
              <div className="text-sm text-gray-400">
                {isRecording ? t('analyzingFrequencies') : t('noAnalysis')}
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-4xl mb-2">🧠</div>
              <div className="text-lg font-semibold text-white">{t('behavior')}</div>
              <div className="text-sm text-gray-400">
                {profanityCount > 0 ? `${profanityCount} ${t('offensiveWords')}` : t('appropriateLanguage')}
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-4xl mb-2">❤️</div>
              <div className="text-lg font-semibold text-white">{t('physicalState')}</div>
              <div className="text-sm text-gray-400">
                {isNervous ? `${t('stress')}: ${stressLevel}%` : t('normalState')}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;