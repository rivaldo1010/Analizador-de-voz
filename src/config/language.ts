// Configuración de idioma para la aplicación

export const LANG = __LANG__ || 'es-ES';

export const translations = {
  'es-ES': {
    // Textos generales
    appTitle: 'Analizador Profesional de Audio',
    loading: 'Cargando...',
    error: 'Error',
    success: 'Éxito',
    active: 'Activo',
    inactive: 'Inactivo',
    state: 'Estado',
    
    // Botones y acciones
    startRecording: 'Iniciar grabación',
    stopRecording: 'Detener grabación',
    startTranscription: 'Iniciar transcripción',
    stopTranscription: 'Detener transcripción',
    uploadAudioBtn: 'Subir audio',
    
    // Análisis de audio
    realTimeAudio: 'Audio en Tiempo Real',
    frequency: 'Frecuencia',
    amplitude: 'Amplitud',
    pitch: 'Tono',
    volume: 'Volumen',
    stressLevel: 'Nivel de estrés',
    nervousState: 'Nervioso',
    calmState: 'Calmado',
    
    // Transcripción
    transcript: 'Transcripción',
    interimTranscript: 'Transcripción provisional',
    profanityCount: 'Palabras inapropiadas',
    profanityDetected: 'Palabras inapropiadas detectadas',
    
    // Escucha de audio
    audioListener: 'Escucha de Audio',
    startListening: 'Iniciar escucha',
    stopListening: 'Detener escucha',
    listeningStatus: 'Estado de escucha',
    noAudioStreamAvailable: 'No hay transmisión de audio disponible',
    
    // Estado de conexión
    connectionStatus: 'Estado de Conexión',
    audioConnection: 'Conexión de audio',
    connected: 'Conectado',
    disconnected: 'Desconectado',
    speaker: 'Emisor',
    listener: 'Receptor',
    connectionEstablished: 'Conexión establecida. La transmisión de audio está activa.',
    connectionInstructions: 'Para establecer conexión, active tanto el emisor como el receptor de audio.',
    
    // Visualización
    spectralVisualization: 'Visualización Espectral',
    spectralAnalysisDescription: 'Análisis espectral en tiempo real con detección de frecuencias dominantes',
    
    // Análisis integral
    integralAnalysis: 'Análisis Integral del Usuario',
    audio: 'Audio',
    analyzingFrequencies: 'Analizando frecuencias',
    noAnalysis: 'Sin análisis',
    behavior: 'Comportamiento',
    offensiveWords: 'palabras ofensivas',
    appropriateLanguage: 'Lenguaje apropiado',
    physicalState: 'Estado Físico',
    stress: 'Estrés',
    normalState: 'Estado normal',
    
    // Filtro de profanidad
    profanityFilter: 'Filtro de Palabras Ofensivas',
    filterStatus: 'Estado del Filtro',
    deactivateFilter: 'Desactivar Filtro',
    activateFilter: 'Activar Filtro',
    detectedWords: 'Palabras Detectadas',
    alertLevel: 'Nivel de Alerta',
    clearList: 'Limpiar Lista',
    
    // Carga de audio
    audioUploader: 'Cargador de Audio',
    uploadAudio: 'Cargar Audio',
    selectAudioFile: 'Seleccionar archivo de audio',
    playAudio: 'Reproducir',
    pauseAudio: 'Pausar',
    reset: 'Reiniciar',
    currentTime: 'Tiempo actual',
    duration: 'Duración',
    dominantFrequency: 'Frecuencia dominante',
    noFileSelected: 'Ningún archivo seleccionado',
    dragAndDrop: 'Arrastra y suelta un archivo de audio aquí o haz clic para seleccionar',
    
    // Monitor de presión arterial
    bloodPressureMonitor: 'Monitor de Presión Arterial',
    connectDevice: 'Conectar dispositivo',
    disconnectDevice: 'Desconectar dispositivo',
    connecting: 'Conectando...',
    deviceStatus: 'Estado del dispositivo',
    currentReading: 'Lectura actual',
    systolic: 'Sistólica',
    diastolic: 'Diastólica',
    heartRate: 'Frecuencia cardíaca',
    bpm: 'ppm',
    mmHg: 'mmHg',
    stressAnalysis: 'Nivel de Estrés',
    readingHistory: 'Historial de lecturas',
    time: 'Hora',
    deviceNotConnected: 'Dispositivo no conectado',
    connectDeviceToStart: 'Conecta tu máquina de presión arterial para comenzar el monitoreo',
    emotionalState: 'Estado Emocional',
    calm: 'CALMADO',
    nervous: 'NERVIOSO',
    // Categorías de presión arterial
    hypertensiveCrisis: 'Crisis Hipertensiva',
    hypertension: 'Hipertensión',
    highPressure: 'Presión Alta',
    elevated: 'Elevada',
    normal: 'Normal',
    
    // Mensajes
    microphoneAccessDenied: 'Acceso al micrófono denegado',
    browserNotSupported: 'Su navegador no soporta esta funcionalidad',
    processingAudio: 'Procesando audio...',
    noSpeechDetected: 'No se detectó voz',
    networkError: 'Error de red',
    audioCaptureError: 'Error al capturar audio',
    
    // FrequencyBarsVisualizer
    voiceFrequencyAnalyzer: 'Analizador de Frecuencias de Voz',
    realTimeVisualization: 'Visualización en tiempo real del espectro de frecuencia de tu voz',
    showHelp: 'Mostrar ayuda',
    hideHelp: 'Ocultar ayuda',
    howItWorks: 'Cómo funciona',
    green: 'Verde',
    yellow: 'Amarillo',
    red: 'Rojo',
    normalVoice: 'Voz normal - Estás hablando a un volumen adecuado',
    loudVoice: 'Voz alta - Estás alzando la voz',
    shouting: 'Gritando - Tu voz está a un nivel muy alto',
    speakToMicrophone: 'Habla al micrófono para ver cómo cambian los colores según la intensidad de tu voz',
    capturingAudio: 'Capturando audio...',
    microphoneInactive: 'Micrófono inactivo',
    voiceLevel: 'Nivel de voz',
    voiceIntensity: 'Intensidad de voz',
    startAnalysis: 'Iniciar Análisis',
    stopAnalysis: 'Detener Análisis',
  },
};

// Función para obtener traducciones
export const t = (key: keyof typeof translations['es-ES']) => {
  return translations[LANG as keyof typeof translations]?.[key] || key;
};