import React, { useState, useRef, useEffect } from 'react';
import { Volume2, VolumeX, Headphones } from 'lucide-react';
import { t } from '../config/language';

interface AudioListenerProps {
  isRecording: boolean;
  audioStream: MediaStream | null;
  isListening?: boolean;
  setIsListening?: (isListening: boolean) => void;
}

const AudioListener: React.FC<AudioListenerProps> = ({ 
  isRecording, 
  audioStream, 
  isListening: externalIsListening, 
  setIsListening: externalSetIsListening 
}) => {
  const [internalIsListening, setInternalIsListening] = useState(false);
  
  // Usar estado interno o externo según lo que se proporcione
  const isListening = externalIsListening !== undefined ? externalIsListening : internalIsListening;
  const setIsListening = externalSetIsListening || setInternalIsListening;
  const [volume, setVolume] = useState(0.5);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  // Inicializar el elemento de audio cuando el componente se monta
  useEffect(() => {
    audioElementRef.current = new Audio();
    audioElementRef.current.autoplay = true;
    audioElementRef.current.volume = volume;

    return () => {
      if (audioElementRef.current) {
        audioElementRef.current.pause();
        audioElementRef.current.srcObject = null;
      }
    };
  }, []);

  // Actualizar el volumen cuando cambia
  useEffect(() => {
    if (audioElementRef.current) {
      audioElementRef.current.volume = volume;
    }
  }, [volume]);

  // Conectar o desconectar el stream de audio cuando cambia el estado de escucha
  useEffect(() => {
    if (!audioStream) return;

    if (isListening && audioElementRef.current) {
      // Detener cualquier reproducción anterior
      audioElementRef.current.pause();
      
      // Limpiar cualquier fuente anterior
      if (audioElementRef.current.srcObject) {
        audioElementRef.current.srcObject = null;
      }
      
      // Asignar el nuevo stream y reproducir
      audioElementRef.current.srcObject = audioStream;
      
      // Reproducir con manejo de errores mejorado
      const playPromise = audioElementRef.current.play();
      
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.error('Error al reproducir audio:', error);
          // Intentar nuevamente después de un breve retraso
          setTimeout(() => {
            if (audioElementRef.current && isListening) {
              audioElementRef.current.play().catch(e => {
                console.error('Error en segundo intento de reproducción:', e);
                alert('No se pudo reproducir el audio. Verifique los permisos del micrófono.');
              });
            }
          }, 500);
        });
      }
    } else if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.srcObject = null;
    }
  }, [isListening, audioStream]);

  // Manejar el inicio/parada de la escucha
  const toggleListening = () => {
    if (!audioStream) {
      alert(t('noAudioStreamAvailable'));
      return;
    }
    setIsListening(!isListening);
  };

  // Manejar cambios en el volumen
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
  };

  return (
    <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
      <h2 className="text-2xl font-bold text-blue-400 mb-6 flex items-center gap-2">
        <Headphones className="w-6 h-6" />
        {t('audioListener')}
      </h2>

      <div className="flex flex-col gap-4">
        <button
          onClick={toggleListening}
          disabled={!isRecording}
          className={`flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all ${
            !isRecording
              ? 'bg-gray-600 cursor-not-allowed opacity-50'
              : isListening
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {isListening ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          {isListening ? t('stopListening') : t('startListening')}
        </button>

        <div className="flex items-center gap-4">
          <span className="text-white">{t('volume')}:</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={handleVolumeChange}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
          />
          <span className="text-white w-10 text-right">{Math.round(volume * 100)}%</span>
        </div>

        <div className={`p-4 rounded-lg border ${isListening ? 'bg-blue-900/30 border-blue-500' : 'bg-gray-800/30 border-gray-600'}`}>
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${isListening ? 'bg-blue-400 animate-pulse' : 'bg-gray-500'}`}></div>
            <span className="font-semibold">{t('listeningStatus')}: {isListening ? t('active') : t('inactive')}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export { AudioListener };