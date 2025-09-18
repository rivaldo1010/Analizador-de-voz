import React, { useRef, useState, useEffect } from 'react';
import { Upload, Play, Pause, RotateCcw } from 'lucide-react';
import { t, LANG } from '../config/language';

interface AudioUploaderProps {
  onAudioAnalysis: (audioData: any) => void;
  onTranscriptUpdate: (transcript: string) => void;
  shouldPlayForTranscription?: boolean;
}

export const AudioUploader: React.FC<AudioUploaderProps> = ({ onAudioAnalysis, onTranscriptUpdate, shouldPlayForTranscription }) => {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [dominantFrequencyDisplay, setDominantFrequencyDisplay] = useState<number | null>(null);
  const [sttLoading, setSttLoading] = useState(false);
  const [apiKey, setApiKey] = useState<string>(() => localStorage.getItem('openai_api_key') || '');

  const audioRef = useRef<HTMLAudioElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number>();
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [audioNodeConnected, setAudioNodeConnected] = useState(false);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    setIsLoading(true);
    
    const file = event.target.files?.[0];
    if (!file) {
      setIsLoading(false);
      return;
    }
    
    if (!file.type.startsWith('audio/')) {
      setUploadError('Por favor, seleccione un archivo de audio válido (MP3, WAV, etc.)');
      event.target.value = '';
      setIsLoading(false);
      return;
    }
    
    try {
      // Parar reproducción anterior
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        if (audioRef.current.src) {
          URL.revokeObjectURL(audioRef.current.src);
        }
      }
      stopAnalyzing();
      setIsPlaying(false);
      
      // Cerrar contexto previo
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        try { audioContextRef.current.close().catch(() => {}); } catch {}
        audioContextRef.current = null;
        analyserRef.current = null;
      }
      
      setUploadedFile(file);
      const url = URL.createObjectURL(file);
      
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.removeAttribute('src');
        audioRef.current.load();
        audioRef.current.src = url;
        audioRef.current.crossOrigin = 'anonymous';
        audioRef.current.load();
        
        const loadTimeout = setTimeout(() => {
          setIsLoading(false);
          if (audioRef.current && audioRef.current.readyState === 0) {
            setUploadError('El archivo de audio está tardando en cargar. Puede que el archivo sea demasiado grande o esté dañado.');
          }
        }, 5000);
        
        audioRef.current.onloadeddata = () => {
          clearTimeout(loadTimeout);
          setIsLoading(false);
          (async () => {
            const ok = await setupAudioAnalysis();
            if (ok && audioRef.current) {
              try {
                audioRef.current.muted = true; // autoplay permitido
                const p = audioRef.current.play();
                if (p) await p;
                setIsPlaying(true);
                startAnalyzing();
              } catch {}
            }
          })();
        };
      } else {
        setUploadError('No se pudo acceder al elemento de audio');
        setIsLoading(false);
      }
      event.target.value = '';
    } catch (error) {
      setUploadError('Error al cargar el archivo de audio. Intente con otro archivo.');
      event.target.value = '';
      setIsLoading(false);
    }
  };

  const setupAudioAnalysis = async () => {
    try {
      if (!audioRef.current) return false;
      if (!audioRef.current.src) return false;
      if (audioRef.current.readyState === 0) return false;
      
      if (audioContextRef.current && analyserRef.current && audioNodeConnected) {
        if (audioContextRef.current.state === 'suspended') await audioContextRef.current.resume();
        startAnalyzing();
        return true;
      }
      
      if (audioContextRef.current) {
        try { if (audioContextRef.current.state !== 'closed') await audioContextRef.current.close(); } catch {}
        audioContextRef.current = null;
        setAudioNodeConnected(false);
      }
      analyserRef.current = null;
      
      const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextCtor) {
        alert('Su navegador no soporta la API de Audio Web.');
        return false;
      }
      audioContextRef.current = new AudioContextCtor();
      audioRef.current.crossOrigin = 'anonymous';
      
      try {
        if (!audioNodeConnected) {
          const source = audioContextRef.current.createMediaElementSource(audioRef.current);
          analyserRef.current = audioContextRef.current.createAnalyser();
          analyserRef.current.fftSize = 2048;
          analyserRef.current.smoothingTimeConstant = 0.8;
          source.connect(analyserRef.current);
          analyserRef.current.connect(audioContextRef.current.destination);
          setAudioNodeConnected(true);
        } else {
          analyserRef.current = audioContextRef.current.createAnalyser();
          analyserRef.current.fftSize = 2048;
          analyserRef.current.smoothingTimeConstant = 0.8;
        }
        startAnalyzing();
        return true;
      } catch (e: any) {
        if (String(e).includes('MediaElementAudioSource')) {
          setAudioNodeConnected(true);
          if (audioContextRef.current) {
            analyserRef.current = audioContextRef.current.createAnalyser();
            analyserRef.current.fftSize = 2048;
            analyserRef.current.smoothingTimeConstant = 0.8;
            startAnalyzing();
            return true;
          }
        }
        throw e;
      }
    } catch (e) {
      if (!analyserRef.current && audioContextRef.current) {
        try {
          analyserRef.current = audioContextRef.current.createAnalyser();
          analyserRef.current.fftSize = 2048;
          startAnalyzing();
          return true;
        } catch {}
      }
      return false;
    }
  };

  const analyzeUploadedAudio = () => {
    try {
      if (!analyserRef.current) return;
      const bufferLength = analyserRef.current.frequencyBinCount;
      if (!bufferLength) return;
      const dataArray = new Uint8Array(bufferLength);
      analyserRef.current.getByteFrequencyData(dataArray);
      
      let maxAmplitude = 0;
      let dominantFrequency = 0;
      const sampleRate = audioContextRef.current?.sampleRate || 44100;
      for (let i = 0; i < bufferLength; i++) {
        if (dataArray[i] > maxAmplitude) {
          maxAmplitude = dataArray[i];
          dominantFrequency = (i * sampleRate) / (bufferLength * 2);
        }
      }
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
    } catch {}
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
    if (!analyserRef.current) return;
    stopAnalyzing();
    animationRef.current = requestAnimationFrame(function analyze() {
      analyzeUploadedAudio();
      const el = audioRef.current;
      if (el && !el.paused && !el.ended) {
        animationRef.current = requestAnimationFrame(analyze);
      }
    });
  };

  const stopAnalyzing = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = undefined;
    }
  };

  const togglePlayback = async () => {
    if (!audioRef.current) {
      alert('Error: No se pudo acceder al elemento de audio.');
      return;
    }
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      stopAnalyzing();
    } else {
      try {
        if (audioContextRef.current?.state === 'suspended') await audioContextRef.current.resume();
        if (!audioRef.current.src) {
          alert('No hay archivo de audio cargado.');
          return;
        }
        let setupSuccess = false;
        for (let i = 0; i < 3 && !setupSuccess; i++) {
          setupSuccess = await setupAudioAnalysis();
          if (!setupSuccess) await new Promise(r => setTimeout(r, 500));
        }
        const p = audioRef.current.play();
        if (p) await p;
        setIsPlaying(true);
        startAnalyzing();
      } catch (error: any) {
        alert(`Error al reproducir: ${error?.message || error}`);
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

  // Transcripción local en navegador con Whisper (CDN) como fallback sin API key
  const transcribeLocally = async () => {
    if (!uploadedFile) {
      alert('No hay archivo de audio cargado.');
      return;
    }
    try {
      setSttLoading(true);
      // @ts-ignore - import dinámico desde CDN
      const mod = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.5.0');
      const pipeline = mod.pipeline || (mod as any).pipeline;
      const asr = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny');
      const out = await asr(uploadedFile, {
        chunk_length_s: 30,
        return_timestamps: false,
        // ISO code: 'es' si LANG='es-ES'
        language: (LANG && typeof LANG === 'string' ? LANG.split('-')[0] : 'es')
      });
      const text: string = out?.text || '';
      if (!text) throw new Error('Sin texto devuelto por Whisper local.');
      onTranscriptUpdate(text);
    } catch (e) {
      console.error('Fallo de transcripción local:', e);
      alert('No se pudo transcribir localmente. Pruebe con API key o otro archivo.');
    } finally {
      setSttLoading(false);
    }
  };

  // Transcribir archivo con OpenAI (Whisper/gpt-4o-mini-transcribe)
  const transcribeUploadedFile = async () => {
    if (!uploadedFile) {
      alert('No hay archivo de audio cargado.');
      return;
    }
    if (!apiKey) {
      // Fallback local si no hay API key
      return await transcribeLocally();
    }
    try {
      setSttLoading(true);
      const fileForUpload = new File([uploadedFile], uploadedFile.name || 'audio.wav', { type: uploadedFile.type || 'audio/wav' });

      const tryModel = async (model: string) => {
        const form = new FormData();
        form.append('file', fileForUpload);
        form.append('model', model);
        if (LANG) form.append('language', LANG);
        form.append('temperature', '0');
        const resp = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}` },
          body: form,
        });
        return resp;
      };

      let resp = await tryModel('gpt-4o-mini-transcribe');
      if (!resp.ok) {
        resp = await tryModel('whisper-1');
      }
      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`Error de STT: ${resp.status} ${resp.statusText} - ${errText}`);
      }
      const data = await resp.json();
      const text: string = data.text || '';
      if (!text) throw new Error('La respuesta de STT no contiene texto.');
      onTranscriptUpdate(text);
    } catch (e: any) {
      console.error('Fallo de transcripción:', e);
      alert('No se pudo transcribir el archivo. Revise su API key y el tipo de archivo.');
    } finally {
      setSttLoading(false);
    }
  };

  // Al iniciar transcripción desde la app: reproducir desmuteado y, si hay API key, lanzar STT
  useEffect(() => {
    const el = audioRef.current;
    if (!el || !uploadedFile) return;
    if (shouldPlayForTranscription) {
      el.muted = false;
      el.play().then(() => {
        setIsPlaying(true);
        startAnalyzing();
        if (!sttLoading) transcribeUploadedFile();
      }).catch(() => {});
    } else {
      el.muted = true;
    }
  }, [shouldPlayForTranscription, uploadedFile, apiKey]);

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
        {uploadError && (
          <div className="p-3 bg-red-900/50 border border-red-500 rounded-lg">
            <p className="text-red-300 text-sm">{uploadError}</p>
            <button
              onClick={() => setUploadError(null)}
              className="mt-2 px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs"
            >
              Cerrar
            </button>
          </div>
        )}

        <div className="flex items-center gap-4 flex-wrap">
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            onChange={handleFileUpload}
            disabled={isLoading}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Upload className="w-4 h-4" />
            {isLoading ? 'Cargando...' : t('uploadAudio')}
          </button>
          {uploadedFile && (
            <span className="text-purple-300 text-sm break-all">
              {uploadedFile.name}
            </span>
          )}

          {/* API Key OpenAI para STT opcional */}
          <div className="flex items-center gap-2">
            <input
              type="password"
              placeholder="API Key OpenAI (opcional)"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              onBlur={() => localStorage.setItem('openai_api_key', apiKey)}
              className="px-2 py-1 rounded bg-gray-900 border border-gray-600 text-sm text-gray-200 w-64"
            />
            <button
              onClick={() => localStorage.setItem('openai_api_key', apiKey)}
              className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded text-xs"
            >
              Guardar clave
            </button>
          </div>
        </div>

        {uploadedFile && (
          <div className="space-y-4">
            <audio
              ref={audioRef}
              onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
              onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
              onEnded={() => { setIsPlaying(false); stopAnalyzing(); }}
              onLoadedData={() => {}}
              onCanPlay={() => {}}
              onError={(e) => {
                const error = audioRef.current?.error;
                let errorMsg = 'Error al cargar el audio. Intente con otro archivo.';
                if (error) {
                  const errorCodes: Record<number, string> = {
                    1: 'MEDIA_ERR_ABORTED - La carga fue abortada',
                    2: 'MEDIA_ERR_NETWORK - Error de red',
                    3: 'MEDIA_ERR_DECODE - Error al decodificar',
                    4: 'MEDIA_ERR_SRC_NOT_SUPPORTED - Formato no soportado'
                  };
                  const codeExplanation = errorCodes[error.code] || `Código desconocido: ${error.code}`;
                  errorMsg = `Error al cargar el audio: ${codeExplanation}`;
                }
                alert(errorMsg);
              }}
              controls
              className="w-full mb-4 bg-gray-900 rounded-lg"
              preload="auto"
              crossOrigin="anonymous"
            />
            <div className="flex items-center gap-4 flex-wrap">
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
              <button
                onClick={transcribeUploadedFile}
                disabled={sttLoading}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all disabled:opacity-50"
              >
                {sttLoading ? 'Transcribiendo…' : 'Transcribir archivo'}
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
