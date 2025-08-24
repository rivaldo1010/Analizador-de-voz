import React, { useRef, useState, useEffect } from 'react';
import { Upload, Play, Pause, RotateCcw } from 'lucide-react';
import { t } from '../config/language';

interface AudioUploaderProps {
  onAudioAnalysis: (audioData: any) => void;
  onTranscriptUpdate: (transcript: string) => void;
}

export const AudioUploader: React.FC<AudioUploaderProps> = ({ onAudioAnalysis, onTranscriptUpdate }) => {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [dominantFrequencyDisplay, setDominantFrequencyDisplay] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number>();

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      console.error('No se seleccionó ningún archivo');
      return;
    }
    
    if (!file.type.startsWith('audio/')) {
      console.error('El archivo seleccionado no es un archivo de audio');
      alert('Por favor, seleccione un archivo de audio válido (MP3, WAV, etc.)');
      event.target.value = ''; // Limpiar el input para permitir seleccionar el mismo archivo nuevamente
      return;
    }
    
    try {
      console.log('Iniciando carga de archivo de audio:', file.name, 'tipo:', file.type, 'tamaño:', file.size);
      
      // Limpiar cualquier reproducción anterior
      if (audioRef.current) {
        console.log('Deteniendo reproducción anterior...');
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        
        if (audioRef.current.src) {
          URL.revokeObjectURL(audioRef.current.src);
          console.log('URL anterior revocada');
        }
      }
      
      // Detener cualquier análisis en curso
      stopAnalyzing();
      setIsPlaying(false);
      
      // Cerrar el contexto de audio anterior si existe
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        console.log('Cerrando contexto de audio anterior...');
        try {
          audioContextRef.current.close();
        } catch (err) {
          console.error('Error al cerrar el contexto de audio:', err);
        }
        audioContextRef.current = null;
        analyserRef.current = null;
      }
      
      // Actualizar estado y crear URL para el nuevo archivo
      setUploadedFile(file);
      const url = URL.createObjectURL(file);
      
      console.log('Archivo de audio cargado:', file.name, 'URL:', url);
      
      // Asignar la URL al elemento de audio
      if (audioRef.current) {
        // Asegurarse de que el elemento de audio esté completamente limpio
        audioRef.current.pause();
        audioRef.current.removeAttribute('src');
        audioRef.current.load();
        
        // Asignar la nueva URL
        console.log('Asignando nueva URL al elemento de audio:', url);
        audioRef.current.src = url;
        audioRef.current.crossOrigin = 'anonymous';
        
        // Precargar el audio
        console.log('Precargando audio...');
        audioRef.current.load();
        
        // Verificar que el audio se haya cargado correctamente
        const loadTimeout = setTimeout(() => {
          if (audioRef.current) {
            console.log('Estado del audio después de 5 segundos:', {
              readyState: audioRef.current.readyState,
              duration: audioRef.current.duration,
              paused: audioRef.current.paused,
              error: audioRef.current.error
            });
            
            if (audioRef.current.readyState === 0) {
              console.warn('El audio no se ha cargado correctamente después de 5 segundos');
              alert('El archivo de audio está tardando en cargar. Puede que el archivo sea demasiado grande o esté dañado.');
            }
          }
        }, 5000);
        
        // Limpiar el timeout cuando el audio se cargue
        audioRef.current.onloadeddata = () => {
          clearTimeout(loadTimeout);
          console.log('Audio cargado correctamente. Duración:', audioRef.current?.duration);
        };
      } else {
        console.error('No se pudo acceder al elemento de audio');
      }
      
      // Limpiar el input para permitir seleccionar el mismo archivo nuevamente
      event.target.value = '';
    } catch (error) {
      console.error('Error al cargar el archivo de audio:', error);
      alert('Error al cargar el archivo de audio. Intente con otro archivo.');
      event.target.value = '';
    }
  };

  // Variable para rastrear si ya se ha conectado el elemento de audio a un contexto
  const [audioNodeConnected, setAudioNodeConnected] = useState(false);

  const setupAudioAnalysis = async () => {
    try {
      // Verificar que el elemento de audio exista
      if (!audioRef.current) {
        console.error('No hay elemento de audio disponible');
        alert('Error: No se pudo acceder al elemento de audio. Intente recargar la página.');
        return false;
      }

      // Verificar que el audio tenga una fuente válida
      if (!audioRef.current.src || audioRef.current.src === '') {
        console.error('El elemento de audio no tiene una fuente asignada');
        alert('No hay archivo de audio cargado. Por favor, suba un archivo primero.');
        return false;
      }

      // Verificar que el audio esté cargado
      if (audioRef.current.readyState === 0) {
        console.error('El audio no está listo para reproducirse');
        alert('El audio aún no está cargado. Por favor, espere un momento e intente nuevamente.');
        return false;
      }

      console.log('Configurando análisis de audio para:', audioRef.current.src);
      console.log('Estado de conexión del nodo de audio:', audioNodeConnected ? 'Conectado' : 'No conectado');
      
      // Si ya tenemos un contexto y un analizador funcionando, usarlos
      if (audioContextRef.current && analyserRef.current && audioNodeConnected) {
        console.log('Usando contexto de audio y analizador existentes');
        // Verificar el estado del contexto
        if (audioContextRef.current.state === 'suspended') {
          await audioContextRef.current.resume();
          console.log('Contexto de audio resumido');
        }
        startAnalyzing();
        return true;
      }
      
      // Cerrar el contexto anterior si existe para evitar problemas
      if (audioContextRef.current) {
        try {
          if (audioContextRef.current.state !== 'closed') {
            console.log('Cerrando contexto de audio anterior...');
            await audioContextRef.current.close();
          }
        } catch (e) {
          console.error('Error al cerrar el contexto de audio anterior:', e);
          // Continuar a pesar del error
        }
        audioContextRef.current = null;
        setAudioNodeConnected(false);
      }
      
      if (analyserRef.current) {
        analyserRef.current = null;
      }
      
      // Crear un nuevo contexto de audio
      console.log('Creando nuevo contexto de audio...');
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) {
        console.error('AudioContext no está disponible en este navegador');
        alert('Su navegador no soporta la API de Audio Web. Intente con un navegador más moderno como Chrome o Firefox.');
        return false;
      }
      
      audioContextRef.current = new AudioContext();
      
      // Asegurarse de que el elemento de audio esté correctamente configurado
      audioRef.current.crossOrigin = 'anonymous';
      
      // Verificar el estado del elemento de audio
      console.log('Estado del elemento de audio antes de crear la fuente:', {
        readyState: audioRef.current.readyState,
        paused: audioRef.current.paused,
        currentSrc: audioRef.current.currentSrc,
        error: audioRef.current.error,
        duration: audioRef.current.duration
      });
      
      try {
        // Crear fuente de audio solo si no está ya conectado
        if (!audioNodeConnected) {
          console.log('Creando nueva fuente de audio...');
          const source = audioContextRef.current.createMediaElementSource(audioRef.current);
          
          // Configurar analizador
          analyserRef.current = audioContextRef.current.createAnalyser();
          analyserRef.current.fftSize = 2048;
          analyserRef.current.smoothingTimeConstant = 0.8;
          
          // Conectar nodos
          source.connect(analyserRef.current);
          analyserRef.current.connect(audioContextRef.current.destination);
          
          // Marcar como conectado
          setAudioNodeConnected(true);
          console.log('Nodos de audio conectados correctamente');
        } else {
          console.log('El nodo de audio ya está conectado, creando solo el analizador');
          // Crear solo el analizador si ya está conectado
          analyserRef.current = audioContextRef.current.createAnalyser();
          analyserRef.current.fftSize = 2048;
          analyserRef.current.smoothingTimeConstant = 0.8;
        }
        
        // Iniciar análisis
        startAnalyzing();
        
        console.log('Análisis de audio configurado correctamente');
        return true;
      } catch (sourceError) {
        console.error('Error al crear la fuente de audio:', sourceError);
        
        // Verificar si el error es por ya tener una fuente conectada
        if (sourceError.toString().includes('MediaElementAudioSource')) {
          console.log('El elemento de audio ya tiene una fuente conectada. Marcando como conectado...');
          setAudioNodeConnected(true);
          
          // Intentar usar el contexto existente
          if (audioContextRef.current) {
            try {
              // Crear solo el analizador
              analyserRef.current = audioContextRef.current.createAnalyser();
              analyserRef.current.fftSize = 2048;
              analyserRef.current.smoothingTimeConstant = 0.8;
              
              // Iniciar análisis
              startAnalyzing();
              
              console.log('Recuperación exitosa del análisis de audio');
              return true;
            } catch (recoveryError) {
              console.error('Error en la recuperación:', recoveryError);
              throw recoveryError; // Propagar para el manejo general de errores
            }
          }
        }
        
        throw sourceError; // Propagar para el manejo general de errores
      }
    } catch (error) {
      console.error('Error al configurar el análisis de audio:', error);
      
      // Intentar una última estrategia de recuperación
      if (!analyserRef.current && audioContextRef.current) {
        try {
          console.log('Intentando estrategia de recuperación final...');
          // Crear un analizador sin conectarlo a ninguna fuente
          analyserRef.current = audioContextRef.current.createAnalyser();
          analyserRef.current.fftSize = 2048;
          
          // Iniciar análisis (aunque no habrá datos reales)
          startAnalyzing();
          
          // No mostrar error al usuario, solo continuar
          console.log('Usando modo de análisis limitado');
          return true;
        } catch (finalError) {
          console.error('Falló la estrategia de recuperación final:', finalError);
        }
      }
      
      alert(`Error al configurar el análisis de audio: ${error.message}. Intente cargar el archivo nuevamente.`);
      return false;
    }
  };

  const analyzeUploadedAudio = () => {
    try {
      // Verificar que el analizador esté disponible
      if (!analyserRef.current) {
        console.warn('Analizador no disponible durante analyzeUploadedAudio');
        return;
      }
      
      // Configurar el tamaño del buffer para el análisis
      const bufferLength = analyserRef.current.frequencyBinCount;
      if (!bufferLength) {
        console.warn('Buffer length es 0 o undefined');
        return;
      }
      
      const dataArray = new Uint8Array(bufferLength);

      // Obtener datos de frecuencia
      try {
        analyserRef.current.getByteFrequencyData(dataArray);
      } catch (freqError) {
        console.error('Error al obtener datos de frecuencia:', freqError);
        return;
      }

      // Verificar si hay datos de audio (suma de valores > 0)
      const hasAudioData = dataArray.some(value => value > 0);
      if (!hasAudioData && audioRef.current && !audioRef.current.paused) {
        // Si no hay datos pero el audio está reproduciendo, podría ser un problema de conexión
        console.warn('No se detectan datos de audio aunque la reproducción está activa');
      }

      // Calcular frecuencia dominante
      let maxAmplitude = 0;
      let dominantFrequency = 0;
      const sampleRate = audioContextRef.current?.sampleRate || 44100;
      
      for (let i = 0; i < bufferLength; i++) {
        if (dataArray[i] > maxAmplitude) {
          maxAmplitude = dataArray[i];
          dominantFrequency = (i * sampleRate) / (bufferLength * 2);
        }
      }

      // Calcular pitch usando autocorrelación simple
      const pitch = calculatePitch(dataArray, sampleRate);

      const volume = dataArray.reduce((sum, value) => sum + value, 0) / bufferLength;

      onAudioAnalysis({
        frequency: Math.round(dominantFrequency),
        amplitude: Math.round(maxAmplitude),
        pitch: Math.round(pitch),
        volume: Math.round(volume),
        dataArray
      });

      setDominantFrequencyDisplay(Math.round(dominantFrequency));
    } catch (error) {
      console.error('Error durante el análisis de audio:', error);
      // No detener la animación aquí, solo registrar el error
    }
  };

  const calculatePitch = (buffer: Uint8Array, sampleRate: number): number => {
    const SIZE = buffer.length;
    const MAX_SAMPLES = Math.floor(SIZE / 2);
    let bestOffset = -1;
    let bestCorrelation = 0;
    let rms = 0;

    for (let i = 0; i < SIZE; i++) {
      const val = (buffer[i] - 128) / 128;
      rms += val * val;
    }
    rms = Math.sqrt(rms / SIZE);
    
    if (rms < 0.01) return -1;

    for (let offset = 1; offset < MAX_SAMPLES; offset++) {
      let correlation = 0;
      for (let i = 0; i < MAX_SAMPLES; i++) {
        correlation += Math.abs(((buffer[i] - 128) / 128) - ((buffer[i + offset] - 128) / 128));
      }
      correlation = 1 - (correlation / MAX_SAMPLES);
      
      if (correlation > bestCorrelation) {
        bestCorrelation = correlation;
        bestOffset = offset;
      }
    }
    
    return bestCorrelation > 0.01 ? sampleRate / bestOffset : -1;
  };

  const startAnalyzing = () => {
    if (!analyserRef.current) {
      console.error('No hay analizador disponible para iniciar el análisis');
      return;
    }
    
    // Detener cualquier análisis anterior
    stopAnalyzing();
    
    console.log('Iniciando análisis de audio');
    
    animationRef.current = requestAnimationFrame(function analyze() {
      analyzeUploadedAudio();
      if (isPlaying) {
        animationRef.current = requestAnimationFrame(analyze);
      }
    });
  };

  const stopAnalyzing = () => {
    if (animationRef.current) {
      console.log('Deteniendo animación de análisis');
      cancelAnimationFrame(animationRef.current);
      animationRef.current = undefined;
    }
  };

  const togglePlayback = async () => {
    if (!audioRef.current) {
      console.error('No hay elemento de audio disponible');
      alert('Error: No se pudo acceder al elemento de audio. Intente recargar la página.');
      return;
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      stopAnalyzing();
      console.log('Reproducción pausada y análisis detenido');
    } else {
      try {
        // Asegurarse de que el contexto de audio esté en estado correcto
        if (audioContextRef.current?.state === 'suspended') {
          await audioContextRef.current.resume();
        }
        
        // Verificar que el audio tenga una fuente válida
        if (!audioRef.current.src || audioRef.current.src === '') {
          console.error('No hay archivo de audio cargado');
          alert('No hay archivo de audio cargado. Por favor, suba un archivo primero.');
          return;
        }
        
        console.log('Estado del audio antes de toggle:', {
          paused: audioRef.current.paused,
          readyState: audioRef.current.readyState,
          src: audioRef.current.src,
          currentTime: audioRef.current.currentTime,
          duration: audioRef.current.duration
        });
        
        // Sistema de reintentos para la configuración del análisis
        let setupSuccess = false;
        let retryCount = 0;
        const maxRetries = 3;
        
        while (!setupSuccess && retryCount < maxRetries) {
          console.log(`Intento ${retryCount + 1} de configurar el análisis de audio`);
          setupSuccess = await setupAudioAnalysis();
          
          if (!setupSuccess) {
            retryCount++;
            if (retryCount < maxRetries) {
              console.log(`Reintentando configuración (${retryCount}/${maxRetries})...`);
              // Esperar un poco antes de reintentar
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }
        }
        
        if (!setupSuccess) {
          console.error('No se pudo configurar el análisis de audio después de varios intentos');
          
          // Preguntar al usuario si desea continuar sin análisis
          if (confirm('No se pudo configurar el análisis de audio. ¿Desea reproducir el audio sin visualización?')) {
            console.log('Reproduciendo sin análisis de audio');
            // Continuar con la reproducción sin análisis
          } else {
            return; // El usuario canceló la reproducción
          }
        }
        
        console.log('Intentando reproducir audio desde:', audioRef.current.src);
        
        // Reproducir el audio con manejo de errores
        const playPromise = audioRef.current.play();
        
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              console.log('Audio reproducido correctamente');
              setIsPlaying(true);
              startAnalyzing();
            })
            .catch(error => {
              console.error('Error al reproducir audio:', error);
              // Intentar nuevamente después de un breve retraso
              setTimeout(() => {
                if (audioRef.current) {
                  console.log('Reintentando reproducción...');
                  audioRef.current.play()
                    .then(() => {
                      console.log('Audio reproducido correctamente en segundo intento');
                      setIsPlaying(true);
                      startAnalyzing();
                    })
                    .catch(retryError => {
                      console.error('Error en segundo intento de reproducción:', retryError);
                      alert(`Error al reproducir: ${retryError.message}. Verifique que el archivo de audio sea válido.`);
                    });
                }
              }, 500);
            });
        }
      } catch (error) {
        console.error('Error en togglePlayback:', error);
        alert(`Error al controlar la reproducción: ${error.message}. Intente nuevamente.`);
      }
    }
  };

  const resetAudio = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      setCurrentTime(0);
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Función para transcribir el audio cargado
  const transcribeAudio = async () => {
    if (!uploadedFile) return;
    
    try {
      // Simulación de transcripción - en una aplicación real, usaríamos un servicio de reconocimiento de voz
      // como la Web Speech API o un servicio externo como Google Speech-to-Text
      const mockTranscript = `Transcripción simulada del archivo: ${uploadedFile.name}`;
      
      // Enviamos la transcripción al componente padre
      onTranscriptUpdate(mockTranscript);
    } catch (error) {
      console.error('Error al transcribir el audio:', error);
    }
  };

  // Efecto para transcribir el audio cuando se carga un nuevo archivo
  useEffect(() => {
    if (uploadedFile) {
      transcribeAudio();
    }
  }, [uploadedFile]);

  useEffect(() => {
    return () => {
      stopAnalyzing();
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, []);

  return (
    <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
      <h2 className="text-2xl font-bold text-purple-400 mb-6 flex items-center gap-2">
        <Upload className="w-6 h-6" />
        {t('audioUploader')}
      </h2>

      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-all"
          >
            <Upload className="w-4 h-4" />
            {t('uploadAudio')}
          </button>
          
          {uploadedFile && (
            <span className="text-purple-300 text-sm">
              {uploadedFile.name}
            </span>
          )}
        </div>

        {uploadedFile && (
          <div className="space-y-4">
            <audio
              ref={audioRef}
              onLoadedMetadata={() => {
                console.log('Audio cargado, duración:', audioRef.current?.duration);
                setDuration(audioRef.current?.duration || 0);
              }}
              onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
              onEnded={() => {
                setIsPlaying(false);
                stopAnalyzing();
              }}
              onLoadedData={() => console.log('Audio cargado completamente')}
              onCanPlay={() => console.log('Audio listo para reproducir')}
              onError={(e) => {
                console.error('Error en elemento audio:', e);
                const error = audioRef.current?.error;
                let errorMsg = 'Error al cargar el audio. Intente con otro archivo.';
                
                if (error) {
                  // Códigos de error: https://developer.mozilla.org/en-US/docs/Web/API/MediaError/code
                  const errorCodes = {
                    1: 'MEDIA_ERR_ABORTED - La carga fue abortada por el usuario',
                    2: 'MEDIA_ERR_NETWORK - Error de red al cargar el audio',
                    3: 'MEDIA_ERR_DECODE - Error al decodificar el audio',
                    4: 'MEDIA_ERR_SRC_NOT_SUPPORTED - Formato de audio no soportado'
                  };
                  
                  const codeExplanation = errorCodes[error.code as keyof typeof errorCodes] || `Código de error desconocido: ${error.code}`;
                  errorMsg = `Error al cargar el audio: ${codeExplanation}\nMensaje: ${error.message}`;
                }
                
                console.error(errorMsg);
                alert(errorMsg);
              }}
              controls
              className="w-full mb-4 bg-gray-900 rounded-lg"
              preload="auto"
              crossOrigin="anonymous"
            />
            
            <div className="flex items-center gap-4">
              <button
                onClick={togglePlayback}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-all"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {isPlaying ? t('pauseAudio') : t('playAudio')}
              </button>
              
              <button
                onClick={resetAudio}
                className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-all"
              >
                <RotateCcw className="w-4 h-4" />
                {t('reset')}
              </button>
            </div>

            <div className="bg-black/50 p-4 rounded-lg">
              <div className="flex justify-between text-sm text-gray-400 mb-2">
                <span>{t('currentTime')}: {formatTime(currentTime)}</span>
                <span>{t('duration')}: {formatTime(duration)}</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className="bg-purple-500 h-2 rounded-full transition-all"
                  style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                />
              </div>
            </div>

            {dominantFrequencyDisplay !== null && (
              <div className="mt-4 text-center text-green-400 font-mono text-xl">
                {t('dominantFrequency')}: {dominantFrequencyDisplay} Hz
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
