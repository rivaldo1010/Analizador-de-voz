import React, { useState, useEffect } from 'react';
import { AlertTriangle, Shield, X } from 'lucide-react';
import { t } from '../config/language';

interface ProfanityFilterProps {
  transcript: string;
  onProfanityDetected: (count: number, words: string[]) => void;
}

export const ProfanityFilter: React.FC<ProfanityFilterProps> = ({ transcript, onProfanityDetected }) => {
  const [profanityWords, setProfanityWords] = useState<string[]>([]);
  const [profanityCount, setProfanityCount] = useState(0);
  const [isFilterActive, setIsFilterActive] = useState(true);

  // Lista de palabras ofensivas (expandible)
  const profanityList = [
        'mierda', 'puta', 'cabrón', 'joder', 'coño', 'gilipollas',
        'idiota', 'imbécil', 'pendejo', 'estúpido', 'maricón', 'puto', "culo", "mama huevo",'mierda', 'joder',
        'coño', 'puta', 'puto', 'cabrón', 'cabron', 'gilipollas', 'idiota', 'imbécil', 'estúpido', 'estupido','pendejo', 'mamón', 'mamon', 
        'hijo de puta', 'hdp', 'fuck', 'shit', 'damn', 'bitch', 'asshole',
        'bastard', 'crap', 'hell', 'piss', 'dickhead', 'motherfucker', "idiota", "chucha", "mama verga"
    ];

  useEffect(() => {
    if (!isFilterActive || !transcript) return;

    // Agregar logs para depuración
    console.log('Transcript recibido:', transcript);

    const words = transcript.toLowerCase().split(/\s+/);
    console.log('Palabras separadas:', words);
    
    const detectedProfanity: string[] = [];
    
    words.forEach(word => {
      // Limpiar palabra de puntuación
      const cleanWord = word.replace(/[^\w\s]/gi, '');
      console.log('Palabra limpia:', cleanWord, 'Está en la lista:', profanityList.includes(cleanWord));
      
      if (profanityList.includes(cleanWord)) {
        if (!detectedProfanity.includes(cleanWord)) {
          detectedProfanity.push(cleanWord);
          console.log('Palabra ofensiva detectada:', cleanWord);
        }
      }
    });
    
    console.log('Palabras ofensivas detectadas:', detectedProfanity);

    setProfanityWords(detectedProfanity);
    setProfanityCount(detectedProfanity.length);
    onProfanityDetected(detectedProfanity.length, detectedProfanity);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcript, isFilterActive]);

  const clearProfanityList = () => {
    setProfanityWords([]);
    setProfanityCount(0);
    onProfanityDetected(0, []);
  };

  const removeProfanityWord = (wordToRemove: string) => {
    const updatedWords = profanityWords.filter(word => word !== wordToRemove);
    setProfanityWords(updatedWords);
    setProfanityCount(updatedWords.length);
    onProfanityDetected(updatedWords.length, updatedWords);
  };

  return (
    <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
      <h2 className="text-2xl font-bold text-red-400 mb-6 flex items-center gap-2">
        <Shield className="w-6 h-6" />
        {t('profanityFilter')}
      </h2>

      {/* Control del filtro */}
      <div className="flex items-center justify-between mb-6 bg-black/50 p-4 rounded-lg border border-red-500/30">
        <div className="flex items-center gap-3">
          <div className={`w-4 h-4 rounded-full ${isFilterActive ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`}></div>
          <span className="font-semibold text-white">
            {t('filterStatus')}: {isFilterActive ? t('active') : t('inactive')}
          </span>
        </div>
        
        <button
          onClick={() => setIsFilterActive(!isFilterActive)}
          className={`px-4 py-2 rounded-lg font-semibold transition-all ${
            isFilterActive 
              ? 'bg-red-600 hover:bg-red-700 text-white' 
              : 'bg-green-600 hover:bg-green-700 text-white'
          }`}
        >
          {isFilterActive ? t('deactivateFilter') : t('activateFilter')}
        </button>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-black/50 p-4 rounded-lg border border-red-500/30">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <span className="text-red-400 font-semibold">{t('detectedWords')}</span>
          </div>
          <div className="text-3xl font-mono text-red-300">{profanityCount}</div>
        </div>
        
        <div className="bg-black/50 p-4 rounded-lg border border-orange-500/30">
          <div className="text-orange-400 font-semibold mb-2">{t('alertLevel')}</div>
          <div className={`text-2xl font-bold ${
            profanityCount === 0 ? 'text-green-400' :
            profanityCount <= 2 ? 'text-yellow-400' :
            profanityCount <= 5 ? 'text-orange-400' : 'text-red-400'
          }`}>
            {profanityCount === 0 ? 'LIMPIO' :
            profanityCount <= 2 ? 'BAJO' :
            profanityCount <= 5 ? 'MEDIO' : 'ALTO'}
          </div>
        </div>
      </div>

      {/* Lista de palabras detectadas */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-red-300">Palabras Ofensivas Detectadas</h3>
          {profanityWords.length > 0 && (
            <button
              onClick={clearProfanityList}
              className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded text-sm transition-all"
            >
              {t('clearList')}
            </button>
          )}
        </div>
        
        <div className="bg-black/50 border border-red-500/30 rounded-lg p-4 min-h-[100px]">
          {profanityWords.length === 0 ? (
            <div className="text-center text-gray-400 py-8">
              <Shield className="w-12 h-12 mx-auto mb-2 text-green-400" />
              <p>No se han detectado palabras ofensivas</p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {profanityWords.map((word, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 bg-red-600/20 border border-red-500 text-red-300 px-3 py-1 rounded-full text-sm"
                >
                  <span className="font-mono">{word}</span>
                  <button
                    onClick={() => removeProfanityWord(word)}
                    className="hover:bg-red-500 rounded-full p-1 transition-all"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Indicador visual del nivel de profanidad */}
      <div className="mt-6">
        <div className="flex justify-between text-sm text-gray-400 mb-2">
          <span>Nivel de Profanidad</span>
          <span>{profanityCount}/10+</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all duration-500 ${
              profanityCount === 0 ? 'bg-green-500' :
              profanityCount <= 2 ? 'bg-yellow-500' :
              profanityCount <= 5 ? 'bg-orange-500' : 'bg-red-500'
            }`}
            style={{ width: `${Math.min((profanityCount / 10) * 100, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
};