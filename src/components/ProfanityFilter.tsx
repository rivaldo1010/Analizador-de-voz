import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Shield, X } from 'lucide-react';
import { t } from '../config/language';

interface ProfanityFilterProps {
  transcript: string;
  onProfanityDetected: (count: number, words: string[]) => void;
}

// Normaliza texto: minúsculas, sin acentos, convierte leet-speak común y limpia símbolos
const normalizeText = (text: string) => {
  const leet = (s: string) =>
    s
      .replace(/[@áàäâ]/gi, 'a')
      .replace(/[éèëê]/gi, 'e')
      .replace(/[íìïî]/gi, 'i')
      .replace(/[óòöô]/gi, 'o')
      .replace(/[úùüû]/gi, 'u')
      .replace(/ñ/gi, 'n')
      .replace(/0/g, 'o')
      .replace(/[1!|]/g, 'i')
      .replace(/3/g, 'e')
      .replace(/4/g, 'a')
      .replace(/5|\$/g, 's')
      .replace(/7/g, 't')
      .replace(/8/g, 'b')
      .replace(/9/g, 'g');

  // Quitar acentos por si quedaron, dejar letras, números y espacios
  return leet(
    text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
  )
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

// Construye un regex robusto para un término base (permite separadores, letras repetidas y sufijos comunes)
const buildFlexiblePattern = (term: string): RegExp => {
  // Termino ya en minúsculas y sin acentos (usamos normalizeText sobre el término)
  const clean = term.toLowerCase().trim();

  // Permitir cualquier separador entre letras y letras repetidas
  // p+[^a-z0-9]*u+[^a-z0-9]*t+[^a-z0-9]*a+
  const letters = clean.split('');
  let core = '';
  for (const ch of letters) {
    if (/[a-z0-9]/.test(ch)) {
      core += `${ch}+[^a-z0-9]*`;
    } else if (ch === ' ') {
      core += `[^a-z0-9]*`; // espacios o separadores
    }
  }
  // Sufijos típicos en español para variaciones (plural, diminutivos, aumentativos, género)
  const suffix = '(?:s|es|ito|ita|itos|itas|azo|aza|azos|azas|on|ona|ones|onas|ote|ota|otes|otas|udo|uda|udos|udas){0,2}';

  // Aceptar prefijos como re-, super-, muy- entre separadores
  const prefix = '(?:re|recontra|recontra|super|muy)?[^a-z0-9]*';

  const pattern = `${prefix}${core}${suffix}`;
  return new RegExp(pattern, 'gi');
};

// Cuenta ocurrencias no solapadas de un patrón en un texto
const countMatches = (re: RegExp, text: string) => {
  let m: RegExpExecArray | null;
  let count = 0;
  re.lastIndex = 0;
  while ((m = re.exec(text)) !== null) {
    count++;
    // evitar bucles infinitos en cero-length matches
    if (m.index === re.lastIndex) re.lastIndex++;
  }
  return count;
};

// Lista semilla (sin "quemar" miles de entradas). Se amplían variantes vía regex flexible
const SEED_PROFANITIES = [
  'mierda', 'puta', 'puto', 'cabron', 'cabrón', 'joder', 'coño', 'gilipollas',
  'idiota', 'imbecil', 'imbécil', 'pendejo', 'estupido', 'estúpido', 'maricon', 'maricón',
  'mamon', 'mamón', 'mamahuevo', 'mama huevo', 'mama verga', 'chucha', 'culo',
  'hijo de puta', 'hdp',
  'fuck', 'shit', 'damn', 'bitch', 'asshole', 'bastard', 'crap', 'hell', 'piss', 'dickhead', 'motherfucker'
];

export const ProfanityFilter: React.FC<ProfanityFilterProps> = ({ transcript, onProfanityDetected }) => {
  const [profanityWords, setProfanityWords] = useState<string[]>([]); // únicos detectados (base)
  const [profanityCount, setProfanityCount] = useState(0); // ocurrencias totales
  const [isFilterActive, setIsFilterActive] = useState(true);

  // Prepara términos base normalizados y sus patrones
  const baseTerms = useMemo(() => {
    const set = new Set(
      SEED_PROFANITIES.map(w => normalizeText(w))
        .filter(Boolean)
    );
    return Array.from(set);
  }, []);

  const patterns = useMemo(() => {
    return baseTerms.map(t => ({ term: t, re: buildFlexiblePattern(t) }));
  }, [baseTerms]);

  useEffect(() => {
    if (!isFilterActive || !transcript) {
      setProfanityWords([]);
      setProfanityCount(0);
      onProfanityDetected(0, []);
      return;
    }

    const normalized = normalizeText(transcript);

    let total = 0;
    const detected = new Set<string>();

    // Buscar con patrones flexibles en todo el texto (cuenta ocurrencias)
    for (const { term, re } of patterns) {
      const c = countMatches(re, normalized);
      if (c > 0) {
        total += c;
        detected.add(term);
      }
    }

    // Actualizar estado/UI
    const uniqueWords = Array.from(detected).sort();
    setProfanityWords(uniqueWords);
    setProfanityCount(total);
    onProfanityDetected(total, uniqueWords);
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
    // Nota: al quitar de la lista visual no re-contamos ocurrencias; mantenemos el total global
    onProfanityDetected(profanityCount, updatedWords);
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
          <div className="text-xs text-gray-400 mt-1">Ocurrencias totales</div>
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
