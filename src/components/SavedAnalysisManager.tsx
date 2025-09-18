import React, { useState } from 'react';
import { Download, Trash2, FolderOpen, Calendar, FileText, BarChart3 } from 'lucide-react';

interface AudioData {
  frequency: number;
  amplitude: number;
  pitch: number;
  volume: number;
  timestamp: number;
  frequencyData?: Uint8Array;
}

interface SavedAnalysis {
  id: string;
  name: string;
  timestamp: Date;
  audioData: AudioData[];
  transcript: string;
  profanityCount: number;
  profanityWords: string[];
  frequencyImage?: string;
  voiceDistribution?: { normal: number; medium: number; high: number };
}

interface SavedAnalysisManagerProps {
  savedAnalyses: SavedAnalysis[];
  onDownload: (analysis: SavedAnalysis) => void;
  onDelete: (id: string) => void;
}

export const SavedAnalysisManager: React.FC<SavedAnalysisManagerProps> = ({
  savedAnalyses,
  onDownload,
  onDelete
}) => {
  const [expandedAnalysis, setExpandedAnalysis] = useState<string | null>(null);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getAnalysisStats = (analysis: SavedAnalysis) => {
    const duration = analysis.audioData.length > 0 
      ? (analysis.audioData[analysis.audioData.length - 1].timestamp - analysis.audioData[0].timestamp) / 1000
      : 0;
    
    const avgFrequency = analysis.audioData.length > 0
      ? Math.round(analysis.audioData.reduce((sum, data) => sum + data.frequency, 0) / analysis.audioData.length)
      : 0;

    return {
      duration: Math.round(duration),
      avgFrequency,
      dataPoints: analysis.audioData.length,
      wordCount: analysis.transcript.split(' ').filter(word => word.length > 0).length
    };
  };

  const toggleExpanded = (id: string) => {
    setExpandedAnalysis(expandedAnalysis === id ? null : id);
  };

  return (
    <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
      <h2 className="text-2xl font-bold text-blue-400 mb-6 flex items-center gap-2">
        <FolderOpen className="w-6 h-6" />
        Análisis Guardados ({savedAnalyses.length})
      </h2>

      {savedAnalyses.length === 0 ? (
        <div className="text-center text-gray-400 py-12">
          <FolderOpen className="w-16 h-16 mx-auto mb-4 text-gray-500" />
          <p className="text-lg mb-2">No hay análisis guardados</p>
          <p className="text-sm">Guarda tu primer análisis para verlo aquí</p>
        </div>
      ) : (
        <div className="space-y-4">
          {savedAnalyses.map((analysis) => {
            const stats = getAnalysisStats(analysis);
            const isExpanded = expandedAnalysis === analysis.id;

            return (
              <div
                key={analysis.id}
                className="bg-black/50 border border-gray-600 rounded-lg p-4 transition-all hover:border-blue-500/50"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-white">{analysis.name}</h3>
                      <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded">
                        {stats.dataPoints} puntos
                      </span>
                      {analysis.profanityCount > 0 && (
                        <span className="text-xs bg-red-600 text-white px-2 py-1 rounded">
                          {analysis.profanityCount} palabras inapropiadas
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-gray-400">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {formatDate(analysis.timestamp)}
                      </div>
                      <div className="flex items-center gap-1">
                        <BarChart3 className="w-4 h-4" />
                        {stats.avgFrequency} Hz promedio
                      </div>
                      <div className="flex items-center gap-1">
                        <FileText className="w-4 h-4" />
                        {stats.wordCount} palabras
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleExpanded(analysis.id)}
                      className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded text-sm transition-all"
                    >
                      {isExpanded ? 'Ocultar' : 'Ver detalles'}
                    </button>
                    
                    <button
                      onClick={() => onDownload(analysis)}
                      className="flex items-center gap-1 px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm transition-all"
                    >
                      <Download className="w-4 h-4" />
                      Descargar
                    </button>
                    
                    <button
                      onClick={() => onDelete(analysis.id)}
                      className="flex items-center gap-1 px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                      Eliminar
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-gray-600">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Estadísticas detalladas */}
                      <div className="space-y-3">
                        <h4 className="font-semibold text-blue-400">Estadísticas de Audio</h4>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="bg-gray-700/50 p-2 rounded">
                            <div className="text-gray-400">Duración</div>
                            <div className="text-white font-mono">{stats.duration}s</div>
                          </div>
                          <div className="bg-gray-700/50 p-2 rounded">
                            <div className="text-gray-400">Puntos de datos</div>
                            <div className="text-white font-mono">{stats.dataPoints}</div>
                          </div>
                          <div className="bg-gray-700/50 p-2 rounded">
                            <div className="text-gray-400">Freq. promedio</div>
                            <div className="text-white font-mono">{stats.avgFrequency} Hz</div>
                          </div>
                          <div className="bg-gray-700/50 p-2 rounded">
                            <div className="text-gray-400">Palabras</div>
                            <div className="text-white font-mono">{stats.wordCount}</div>
                          </div>
                        </div>
                        {analysis.voiceDistribution && (
                          <div className="text-sm mt-2">
                            <div className="text-gray-400 mb-1">Distribución de niveles de voz</div>
                            <div className="flex items-center gap-4">
                              <span className="text-green-400">Normal: {analysis.voiceDistribution.normal}%</span>
                              <span className="text-yellow-400">Alzando la voz: {analysis.voiceDistribution.medium}%</span>
                              <span className="text-red-400">Gritando: {analysis.voiceDistribution.high}%</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Transcripción */}
                      <div className="space-y-3">
                        <h4 className="font-semibold text-blue-400">Transcripción</h4>
                        <div className="bg-gray-700/50 p-3 rounded max-h-32 overflow-y-auto">
                          <p className="text-sm text-gray-300">
                            {analysis.transcript || 'Sin transcripción disponible'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Imagen de frecuencias guardada */}
                    {analysis.frequencyImage && (
                      <div className="mt-4">
                        <h4 className="font-semibold text-emerald-400 mb-2">Imagen de frecuencias</h4>
                        <img
                          src={analysis.frequencyImage}
                          alt="Frecuencias guardadas"
                          className="max-h-48 border border-gray-700 rounded"
                        />
                        <div className="mt-2">
                          <a
                            href={analysis.frequencyImage}
                            download={`frecuencias_${analysis.name}.png`}
                            className="text-sm text-emerald-400 hover:underline"
                          >
                            Descargar imagen
                          </a>
                        </div>
                      </div>
                    )}

                    {/* Palabras inapropiadas */}
                    {analysis.profanityWords.length > 0 && (
                      <div className="mt-4">
                        <h4 className="font-semibold text-red-400 mb-2">Palabras Inapropiadas Detectadas</h4>
                        <div className="flex flex-wrap gap-2">
                          {analysis.profanityWords.map((word, index) => (
                            <span
                              key={index}
                              className="bg-red-600/20 border border-red-500 text-red-300 px-2 py-1 rounded text-sm"
                            >
                              {word}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};