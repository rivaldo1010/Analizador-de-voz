import React, { useState, useEffect, useRef } from 'react';
import { Heart, Activity, AlertCircle, Wifi, WifiOff } from 'lucide-react';
import { t } from '../config/language';

interface BloodPressureData {
  systolic: number;
  diastolic: number;
  heartRate: number;
  timestamp: Date;
}

interface BloodPressureMonitorProps {
  onStressLevelChange: (stressLevel: number, isNervous: boolean) => void;
}

export const BloodPressureMonitor: React.FC<BloodPressureMonitorProps> = ({ onStressLevelChange }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [currentReading, setCurrentReading] = useState<BloodPressureData | null>(null);
  const [readings, setReadings] = useState<BloodPressureData[]>([]);
  const [stressLevel, setStressLevel] = useState(0);
  const [isNervous, setIsNervous] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const intervalRef = useRef<number>();

  // Simular conexión con máquina de presión arterial
  const connectToDevice = async () => {
    setConnectionStatus('connecting');
    
    // Simular proceso de conexión
    setTimeout(() => {
      setIsConnected(true);
      setConnectionStatus('connected');
      startMonitoring();
    }, 2000);
  };

  const disconnectFromDevice = () => {
    setIsConnected(false);
    setConnectionStatus('disconnected');
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
  };

  // Simular lecturas de presión arterial
  const generateReading = (): BloodPressureData => {
    // Simular variaciones realistas
    const baseSystolic = 120 + Math.random() * 40; // 120-160
    const baseDiastolic = 80 + Math.random() * 20;  // 80-100
    const baseHeartRate = 70 + Math.random() * 30;  // 70-100
    
    return {
      systolic: Math.round(baseSystolic),
      diastolic: Math.round(baseDiastolic),
      heartRate: Math.round(baseHeartRate),
      timestamp: new Date()
    };
  };

  const startMonitoring = () => {
    intervalRef.current = setInterval(() => {
      const newReading = generateReading();
      setCurrentReading(newReading);
      
      setReadings(prev => {
        const updated = [...prev, newReading].slice(-10); // Mantener últimas 10 lecturas
        return updated;
      });

      // Calcular nivel de estrés basado en la presión arterial
      const stressScore = calculateStressLevel(newReading);
      setStressLevel(stressScore);
      
      const nervous = stressScore > 60;
      setIsNervous(nervous);
      onStressLevelChange(stressScore, nervous);
      
    }, 3000); // Lectura cada 3 segundos
  };

  const calculateStressLevel = (reading: BloodPressureData): number => {
    // Algoritmo para calcular estrés basado en presión arterial y frecuencia cardíaca
    let stress = 0;
    
    // Presión sistólica
    if (reading.systolic > 140) stress += 30;
    else if (reading.systolic > 130) stress += 20;
    else if (reading.systolic > 120) stress += 10;
    
    // Presión diastólica
    if (reading.diastolic > 90) stress += 25;
    else if (reading.diastolic > 85) stress += 15;
    else if (reading.diastolic > 80) stress += 5;
    
    // Frecuencia cardíaca
    if (reading.heartRate > 100) stress += 25;
    else if (reading.heartRate > 90) stress += 15;
    else if (reading.heartRate > 80) stress += 10;
    
    // Variabilidad (si hay lecturas previas)
    if (readings.length > 0) {
      const lastReading = readings[readings.length - 1];
      const systolicChange = Math.abs(reading.systolic - lastReading.systolic);
      const heartRateChange = Math.abs(reading.heartRate - lastReading.heartRate);
      
      if (systolicChange > 20) stress += 10;
      if (heartRateChange > 15) stress += 10;
    }
    
    return Math.min(stress, 100);
  };

  const getBloodPressureCategory = (systolic: number, diastolic: number): { category: string; color: string } => {
    if (systolic >= 180 || diastolic >= 120) {
      return { category: t('hypertensiveCrisis'), color: 'text-red-500' };
    } else if (systolic >= 140 || diastolic >= 90) {
      return { category: t('hypertension'), color: 'text-red-400' };
    } else if (systolic >= 130 || diastolic >= 80) {
      return { category: t('highPressure'), color: 'text-orange-400' };
    } else if (systolic >= 120) {
      return { category: t('elevated'), color: 'text-yellow-400' };
    } else {
      return { category: t('normal'), color: 'text-green-400' };
    }
  };

  const getStressColor = (level: number): string => {
    if (level >= 80) return 'text-red-500';
    if (level >= 60) return 'text-orange-500';
    if (level >= 40) return 'text-yellow-500';
    return 'text-green-500';
  };

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return (
    <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
      <h2 className="text-2xl font-bold text-blue-400 mb-6 flex items-center gap-2">
        <Heart className="w-6 h-6" />
        {t('bloodPressureMonitor')}
      </h2>

      {/* Estado de conexión */}
      <div className="mb-6 bg-black/50 p-4 rounded-lg border border-blue-500/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isConnected ? <Wifi className="w-5 h-5 text-green-400" /> : <WifiOff className="w-5 h-5 text-red-400" />}
            <span className="font-semibold text-white">
              {t('deviceStatus')}: {connectionStatus === 'connecting' ? t('connecting') : isConnected ? 'Conectado' : 'Desconectado'}
            </span>
          </div>
          
          <button
            onClick={isConnected ? disconnectFromDevice : connectToDevice}
            disabled={connectionStatus === 'connecting'}
            className={`px-4 py-2 rounded-lg font-semibold transition-all ${
              isConnected 
                ? 'bg-red-600 hover:bg-red-700 text-white' 
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            } ${connectionStatus === 'connecting' ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {connectionStatus === 'connecting' ? t('connecting') : isConnected ? t('disconnectDevice') : t('connectDevice')}
          </button>
        </div>
      </div>

      {/* Lectura actual */}
      {currentReading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-black/50 p-4 rounded-lg border border-red-500/30">
            <div className="text-red-400 font-semibold mb-1">{t('systolic')}</div>
            <div className="text-3xl font-mono text-red-300">{currentReading.systolic}</div>
            <div className="text-sm text-gray-400">{t('mmHg')}</div>
          </div>
          
          <div className="bg-black/50 p-4 rounded-lg border border-blue-500/30">
            <div className="text-blue-400 font-semibold mb-1">{t('diastolic')}</div>
            <div className="text-3xl font-mono text-blue-300">{currentReading.diastolic}</div>
            <div className="text-sm text-gray-400">{t('mmHg')}</div>
          </div>
          
          <div className="bg-black/50 p-4 rounded-lg border border-green-500/30">
            <div className="text-green-400 font-semibold mb-1">{t('heartRate')}</div>
            <div className="text-3xl font-mono text-green-300">{currentReading.heartRate}</div>
            <div className="text-sm text-gray-400">{t('bpm')}</div>
          </div>
        </div>
      )}

      {/* Análisis de estrés */}
      {currentReading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-black/50 p-4 rounded-lg border border-purple-500/30">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-5 h-5 text-purple-400" />
              <span className="text-purple-400 font-semibold">{t('stressAnalysis')}</span>
            </div>
            <div className={`text-3xl font-bold ${getStressColor(stressLevel)}`}>
              {stressLevel}%
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
              <div
                className={`h-2 rounded-full transition-all duration-500 ${
                  stressLevel >= 80 ? 'bg-red-500' :
                  stressLevel >= 60 ? 'bg-orange-500' :
                  stressLevel >= 40 ? 'bg-yellow-500' : 'bg-green-500'
                }`}
                style={{ width: `${stressLevel}%` }}
              />
            </div>
          </div>
          
          <div className="bg-black/50 p-4 rounded-lg border border-yellow-500/30">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-5 h-5 text-yellow-400" />
              <span className="text-yellow-400 font-semibold">{t('emotionalState')}</span>
            </div>
            <div className={`text-2xl font-bold ${isNervous ? 'text-red-400' : 'text-green-400'}`}>
              {isNervous ? t('nervous') : t('calm')}
            </div>
            <div className="text-sm text-gray-400 mt-1">
              {getBloodPressureCategory(currentReading.systolic, currentReading.diastolic).category}
            </div>
          </div>
        </div>
      )}

      {/* Historial de lecturas */}
      {readings.length > 0 && (
        <div className="bg-black/50 p-4 rounded-lg border border-gray-600">
          <h3 className="text-lg font-semibold text-white mb-3">{t('readingHistory')}</h3>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {readings.slice(-5).reverse().map((reading, index) => (
              <div key={index} className="flex justify-between items-center text-sm bg-gray-700/50 p-2 rounded">
                <span className="text-gray-300">
                  {reading.timestamp.toLocaleTimeString()}
                </span>
                <span className="text-white font-mono">
                  {reading.systolic}/{reading.diastolic} - {reading.heartRate} bpm
                </span>
                <span className={getBloodPressureCategory(reading.systolic, reading.diastolic).color}>
                  {getBloodPressureCategory(reading.systolic, reading.diastolic).category}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!isConnected && (
        <div className="text-center text-gray-400 py-8">
          <Heart className="w-16 h-16 mx-auto mb-4 text-gray-500" />
          <p className="text-lg mb-2">{t('deviceNotConnected')}</p>
          <p className="text-sm">{t('connectDeviceToStart')}</p>
        </div>
      )}
    </div>
  );
};