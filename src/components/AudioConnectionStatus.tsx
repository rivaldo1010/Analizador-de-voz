import React from 'react';
import { Wifi, WifiOff } from 'lucide-react';
import { t } from '../config/language';

interface AudioConnectionStatusProps {
  isRecording: boolean;
  isListening: boolean;
}

const AudioConnectionStatus: React.FC<AudioConnectionStatusProps> = ({ isRecording, isListening }) => {
  const isConnected = isRecording && isListening;
  
  return (
    <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
      <h2 className="text-2xl font-bold text-purple-400 mb-6 flex items-center gap-2">
        {isConnected ? <Wifi className="w-6 h-6" /> : <WifiOff className="w-6 h-6" />}
        {t('connectionStatus')}
      </h2>

      <div className="flex flex-col gap-4">
        <div className={`p-4 rounded-lg border ${isConnected ? 'bg-green-900/30 border-green-500' : 'bg-red-900/30 border-red-500'}`}>
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></div>
            <span className="font-semibold">{t('audioConnection')}: {isConnected ? t('connected') : t('disconnected')}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className={`p-4 rounded-lg border ${isRecording ? 'bg-green-900/30 border-green-500' : 'bg-gray-800/30 border-gray-600'}`}>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${isRecording ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`}></div>
              <span className="font-semibold">{t('speaker')}: {isRecording ? t('active') : t('inactive')}</span>
            </div>
          </div>

          <div className={`p-4 rounded-lg border ${isListening ? 'bg-blue-900/30 border-blue-500' : 'bg-gray-800/30 border-gray-600'}`}>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${isListening ? 'bg-blue-400 animate-pulse' : 'bg-gray-500'}`}></div>
              <span className="font-semibold">{t('listener')}: {isListening ? t('active') : t('inactive')}</span>
            </div>
          </div>
        </div>

        <div className="text-center text-sm text-gray-400 mt-2">
          {isConnected 
            ? t('connectionEstablished')
            : t('connectionInstructions')}
        </div>
      </div>
    </div>
  );
};

export { AudioConnectionStatus };