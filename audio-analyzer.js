// Archivo audio-analyzer.js - Implementación de análisis de audio

// Referencias a elementos del DOM
const audioInput = document.getElementById('audioFile');
const audioPlayer = document.getElementById('audioPlayer');
const audioPlayerContainer = document.getElementById('audioPlayerContainer');
const fileNameDisplay = document.getElementById('fileName');

// Variables para análisis de audio
let audioContext = null;
let analyser = null;
let audioSource = null;
let animationId = null;
let isPlaying = false;
let isAnalyzing = false; // Nueva variable global para controlar frecuencia
let audioNodeConnected = false;
let canvasContext = null;
let canvas = null;
let bufferLength = 0;
let dataArray = null;
let dominantFrequency = null;
let isTranscribing = false; // Variable para controlar si la transcripción está activa

// Variables para almacenamiento de datos
let transcriptData = []; // Almacena la transcripción
let profanityData = []; // Almacena palabras ofensivas detectadas
let frequencyData = []; // Almacena datos de frecuencia
let currentSessionId = null; // ID de la sesión actual
let uploadedFileName = ''; // Nombre del archivo cargado

// Inicializar canvas para visualización
function initializeCanvas() {
    // Crear canvas si no existe
    if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.width = 400;
        canvas.height = 200;
        canvas.style.backgroundColor = '#1a1a1a';
        canvas.style.borderRadius = '5px';
        canvas.style.marginTop = '20px';
        
        // Insertar canvas después del reproductor de audio
        audioPlayerContainer.appendChild(canvas);
        
        // Obtener contexto del canvas
        canvasContext = canvas.getContext('2d');
    }
    
    return canvasContext !== null;
}

// Configurar análisis de audio
async function setupAudioAnalysis() {
    try {
        console.log('Configurando análisis de audio...');
        
        // Verificar que el audio esté cargado
        if (!audioPlayer || audioPlayer.readyState === 0) {
            console.error('El elemento de audio no está listo');
            return false;
        }
        
        // Verificar si el navegador soporta AudioContext
        if (typeof AudioContext === 'undefined' && typeof webkitAudioContext === 'undefined') {
            console.error('AudioContext no es soportado por este navegador');
            alert('Su navegador no soporta análisis de audio. Intente con Chrome o Firefox.');
            return false;
        }
        
        // Crear AudioContext si no existe
        if (!audioContext) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            audioContext = new AudioContextClass();
        }
        
        // Reanudar contexto si está suspendido
        if (audioContext.state === 'suspended') {
            await audioContext.resume();
        }
        
        // Crear analizador si no existe
        if (!analyser) {
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 2048;
            bufferLength = analyser.frequencyBinCount;
            dataArray = new Uint8Array(bufferLength);
        }
        
        // Conectar nodo de audio solo si no está conectado
        if (!audioNodeConnected) {
            try {
                // Desconectar fuente anterior si existe
                if (audioSource) {
                    try {
                        audioSource.disconnect();
                    } catch (disconnectError) {
                        console.warn('Error al desconectar fuente anterior:', disconnectError);
                    }
                }
                
                // Crear nueva fuente desde el elemento de audio
                audioSource = audioContext.createMediaElementSource(audioPlayer);
                audioSource.connect(analyser);
                analyser.connect(audioContext.destination);
                audioNodeConnected = true;
                console.log('Nodo de audio conectado correctamente');
            } catch (sourceError) {
                console.error('Error al crear MediaElementAudioSource:', sourceError);
                
                // Estrategia de recuperación: intentar usar solo el analizador
                console.log('Intentando modo de análisis limitado...');
                
                // Si ya tenemos un analizador, podemos continuar con análisis limitado
                if (analyser) {
                    console.log('Continuando con análisis limitado (sin fuente conectada)');
                    return true; // Retornar éxito parcial
                }
                
                return false;
            }
        } else {
            console.log('Nodo de audio ya conectado, reutilizando conexión');
        }
        
        return true;
    } catch (error) {
        console.error('Error en setupAudioAnalysis:', error);
        alert(`Error al configurar análisis de audio: ${error.message}`);
        return false;
    }
}

// Analizar audio cargado
function analyzeUploadedAudio() {
    if (!analyser || !canvasContext) {
        console.warn('Analizador o canvas no disponibles');
        return;
    }
    
    try {
        // Verificar que tenemos datos de buffer
        if (!bufferLength || !dataArray) {
            console.warn('Buffer no inicializado');
            return;
        }
        
        // Obtener datos de frecuencia
        try {
            analyser.getByteFrequencyData(dataArray);
        } catch (error) {
            console.error('Error al obtener datos de frecuencia:', error);
            return;
        }
        
        // Verificar si hay datos de audio (incluso si el audio está reproduciéndose)
        const hasAudioData = dataArray.some(value => value > 0);
        if (!hasAudioData) {
            // Si no hay datos pero el audio está reproduciéndose, podría ser un problema de conexión
            if (isPlaying && audioPlayer && !audioPlayer.paused) {
                console.warn('No hay datos de audio aunque el audio está reproduciéndose');
            }
            // Limpiar canvas pero no detener análisis
            canvasContext.fillStyle = '#1a1a1a';
            canvasContext.fillRect(0, 0, canvas.width, canvas.height);
            return;
        }
        
        // Limpiar canvas
        canvasContext.fillStyle = '#1a1a1a';
        canvasContext.fillRect(0, 0, canvas.width, canvas.height);
        
        // Calcular ancho de cada barra
        const barWidth = (canvas.width / bufferLength) * 2.5;
        let barHeight;
        let x = 0;
        
        // Dibujar barras de frecuencia
        for (let i = 0; i < bufferLength; i++) {
            barHeight = dataArray[i] * 0.5;
            
            // Gradiente de color basado en la frecuencia
            const hue = (i / bufferLength) * 360;
            canvasContext.fillStyle = `hsl(${hue}, 100%, 50%)`;
            
            canvasContext.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
            x += barWidth + 1;
            
            // Salir si hemos llenado el ancho del canvas
            if (x > canvas.width) break;
        }
        
        // Calcular frecuencia dominante
        let maxValue = 0;
        let maxIndex = 0;
        
        for (let i = 0; i < bufferLength; i++) {
            if (dataArray[i] > maxValue) {
                maxValue = dataArray[i];
                maxIndex = i;
            }
        }
        
        // Convertir índice a frecuencia (Hz)
        // La fórmula es: frecuencia = índice * (frecuencia de muestreo / fftSize)
        // Asumimos una frecuencia de muestreo estándar de 44100 Hz
        const nyquist = audioContext.sampleRate / 2;
        dominantFrequency = Math.round((maxIndex * nyquist) / bufferLength);
        
        // Mostrar frecuencia dominante si es significativa (volumen suficiente)
        if (maxValue > 50) {
            // Crear o actualizar elemento para mostrar la frecuencia
            let freqDisplay = document.getElementById('dominantFrequency');
            if (!freqDisplay) {
                freqDisplay = document.createElement('div');
                freqDisplay.id = 'dominantFrequency';
                freqDisplay.style.textAlign = 'center';
                freqDisplay.style.color = '#4ade80'; // Verde
                freqDisplay.style.fontFamily = 'monospace';
                freqDisplay.style.fontSize = '18px';
                freqDisplay.style.marginTop = '10px';
                audioPlayerContainer.appendChild(freqDisplay);
            }
            
            freqDisplay.textContent = `Frecuencia dominante: ${dominantFrequency} Hz`;
        }
    } catch (error) {
        console.error('Error en analyzeUploadedAudio:', error);
    }
}

// Iniciar análisis
function startAnalyzing() {
    if (!initializeCanvas()) {
        console.error('No se pudo inicializar el canvas');
        return;
    }
    
    console.log('Iniciando análisis de audio...');
    
    try {
        // Detener animación anterior si existe
        if (animationId) {
            cancelAnimationFrame(animationId);
        }
        
        // Iniciar bucle de animación
        function analyze() {
            analyzeUploadedAudio();
            if (isPlaying) {
                animationId = requestAnimationFrame(analyze);
            }
        }
        
        animationId = requestAnimationFrame(analyze);
    } catch (error) {
        console.error('Error al iniciar análisis:', error);
    }
}

// Detener análisis
function stopAnalyzing() {
    if (animationId) {
        console.log('Deteniendo animación de análisis');
        cancelAnimationFrame(animationId);
        animationId = null;
    }
}

// Alternar reproducción
async function togglePlayback() {
    if (!audioPlayer) {
        console.error('No hay elemento de audio disponible');
        alert('Error: No se pudo acceder al elemento de audio. Intente recargar la página.');
        return;
    }
    
    if (isPlaying) {
        audioPlayer.pause();
        isPlaying = false;
        isAnalyzing = false;
        stopAnalyzing();
        console.log('Reproducción pausada y análisis detenido');
        
        // Actualizar botón de reproducción
        updatePlayButton();
    } else {
        try {
            // Asegurarse de que el contexto de audio esté en estado correcto
            if (audioContext && audioContext.state === 'suspended') {
                await audioContext.resume();
            }
            
            // Verificar que el audio tenga una fuente válida
            if (!audioPlayer.src || audioPlayer.src === '') {
                console.error('No hay archivo de audio cargado');
                alert('No hay archivo de audio cargado. Por favor, suba un archivo primero.');
                return;
            }
            
            console.log('Estado del audio antes de toggle:', {
                paused: audioPlayer.paused,
                readyState: audioPlayer.readyState,
                src: audioPlayer.src,
                currentTime: audioPlayer.currentTime,
                duration: audioPlayer.duration
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
            
            console.log('Intentando reproducir audio desde:', audioPlayer.src);
            
            // Reproducir el audio con manejo de errores
            const playPromise = audioPlayer.play();
            
            if (playPromise !== undefined) {
                playPromise
                    .then(() => {
                        console.log('Audio reproducido correctamente');
                        isPlaying = true;
                        isAnalyzing = true;
                        startAnalyzing();
                        
                        // Actualizar botón de reproducción
                        updatePlayButton();
                    })
                    .catch(error => {
                        console.error('Error al reproducir audio:', error);
                        // Intentar nuevamente después de un breve retraso
                        setTimeout(() => {
                            if (audioPlayer) {
                                console.log('Reintentando reproducción...');
                                audioPlayer.play()
                                    .then(() => {
                                        console.log('Audio reproducido correctamente en segundo intento');
                                        isPlaying = true;
                                        isAnalyzing = true;
                                        startAnalyzing();
                                        
                                        // Actualizar botón de reproducción
                                        updatePlayButton();
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
}

// Actualizar botón de reproducción
function updatePlayButton() {
    const playButton = document.getElementById('playButton');
    if (playButton) {
        if (isPlaying) {
            playButton.textContent = 'Pausar';
            playButton.classList.remove('bg-green-600', 'hover:bg-green-700');
            playButton.classList.add('bg-yellow-600', 'hover:bg-yellow-700');
        } else {
            playButton.textContent = 'Reproducir';
            playButton.classList.remove('bg-yellow-600', 'hover:bg-yellow-700');
            playButton.classList.add('bg-green-600', 'hover:bg-green-700');
        }
    }
}

// Reiniciar audio
function resetAudio() {
    if (audioPlayer) {
        audioPlayer.currentTime = 0;
        updateTimeDisplay();
    }
}

// Formatear tiempo (mm:ss)
function formatTime(time) {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// Actualizar visualización de tiempo
function updateTimeDisplay() {
    const currentTimeDisplay = document.getElementById('currentTime');
    const durationDisplay = document.getElementById('duration');
    const progressBar = document.getElementById('progressBar');
    
    if (currentTimeDisplay && durationDisplay && progressBar && audioPlayer) {
        const currentTime = audioPlayer.currentTime || 0;
        const duration = audioPlayer.duration || 0;
        
        currentTimeDisplay.textContent = formatTime(currentTime);
        durationDisplay.textContent = formatTime(duration);
        
        // Actualizar barra de progreso
        const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
        progressBar.style.width = `${progressPercent}%`;
    }
}

// Limpiar recursos de audio
function cleanupAudio() {
    stopAnalyzing();
    
    // Detener transcripción si está activa
    if (isTranscribing) {
        isTranscribing = false;
        const transcribeButton = document.getElementById('transcribeButton');
        if (transcribeButton) {
            transcribeButton.textContent = 'Iniciar Transcripción';
            transcribeButton.classList.remove('bg-red-600', 'hover:bg-red-700');
            transcribeButton.classList.add('bg-blue-600', 'hover:bg-blue-700');
        }
    }
    
    if (audioSource) {
        try {
            audioSource.disconnect();
        } catch (error) {
            console.warn('Error al desconectar fuente de audio:', error);
        }
        audioSource = null;
    }
    
    if (audioContext && audioContext.state !== 'closed') {
        try {
            audioContext.close();
        } catch (error) {
            console.warn('Error al cerrar contexto de audio:', error);
        }
        audioContext = null;
    }
    
    audioNodeConnected = false;
    analyser = null;
    bufferLength = 0;
    dataArray = null;
    dominantFrequency = null;
}

// Manejar carga de archivo
function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) {
        console.log('No se seleccionó ningún archivo');
        return;
    }
    
    console.log('Archivo seleccionado:', file.name, 'tipo:', file.type);
    
    // Verificar que sea un archivo de audio
    if (!file.type.startsWith('audio/')) {
        console.error('El archivo seleccionado no es un archivo de audio');
        alert('Por favor, seleccione un archivo de audio válido (MP3, WAV, etc.)');
        audioInput.value = ''; // Limpiar input
        return;
    }
    
    // Detener reproducción anterior si existe
    if (isPlaying) {
        audioPlayer.pause();
        isPlaying = false;
        stopAnalyzing();
    }
    
    // Detener transcripción si está activa
    if (isTranscribing) {
        isTranscribing = false;
        const transcribeButton = document.getElementById('transcribeButton');
        if (transcribeButton) {
            transcribeButton.textContent = 'Iniciar Transcripción';
            transcribeButton.classList.remove('bg-red-600', 'hover:bg-red-700');
            transcribeButton.classList.add('bg-blue-600', 'hover:bg-blue-700');
        }
        
        // Limpiar área de transcripción si existe
        const transcriptContent = document.getElementById('transcriptContent');
        if (transcriptContent) {
            transcriptContent.textContent = 'La transcripción aparecerá aquí...';
        }
    }
    
    // Limpiar recursos de audio anteriores
    cleanupAudio();
    
    // Crear URL para el archivo
    const fileURL = URL.createObjectURL(file);
    
    // Configurar reproductor de audio
    audioPlayer.src = fileURL;
    fileNameDisplay.textContent = file.name;
    audioPlayerContainer.style.display = 'block';
    
    // Configurar timeout para carga
    const loadTimeout = setTimeout(() => {
        console.warn('El audio está tardando demasiado en cargar');
        alert('El audio está tardando demasiado en cargar. Puede que el archivo sea muy grande o esté dañado.');
    }, 10000); // 10 segundos
    
    // Eventos de carga
    audioPlayer.onloadeddata = () => {
        console.log('Audio cargado completamente');
        clearTimeout(loadTimeout);
        
        // Crear elementos de UI para tiempo y progreso si no existen
        createTimeDisplay();
    };
    
    audioPlayer.oncanplay = () => {
        console.log('Audio listo para reproducir');
    };
    
    audioPlayer.onerror = (e) => {
        clearTimeout(loadTimeout);
        console.error('Error en elemento audio:', e);
        const error = audioPlayer.error;
        let errorMsg = 'Error al cargar el audio. Intente con otro archivo.';
        
        if (error) {
            // Códigos de error: https://developer.mozilla.org/en-US/docs/Web/API/MediaError/code
            const errorCodes = {
                1: 'MEDIA_ERR_ABORTED - La carga fue abortada por el usuario',
                2: 'MEDIA_ERR_NETWORK - Error de red al cargar el audio',
                3: 'MEDIA_ERR_DECODE - Error al decodificar el audio',
                4: 'MEDIA_ERR_SRC_NOT_SUPPORTED - Formato de audio no soportado'
            };
            
            const codeExplanation = errorCodes[error.code] || `Código de error desconocido: ${error.code}`;
            errorMsg = `Error al cargar el audio: ${codeExplanation}\nMensaje: ${error.message}`;
        }
        
        console.error(errorMsg);
        alert(errorMsg);
    };
    
    // Evento de actualización de tiempo
    audioPlayer.ontimeupdate = updateTimeDisplay;
    
    // Evento de finalización
    audioPlayer.onended = () => {
        isPlaying = false;
        isAnalyzing = false;
        stopAnalyzing();
        updatePlayButton();
    };
    
    // Limpiar input para permitir seleccionar el mismo archivo nuevamente
    audioInput.value = '';
}

// Crear elementos para mostrar tiempo y progreso
function createTimeDisplay() {
    // Verificar si ya existen
    if (document.getElementById('timeDisplay')) {
        return;
    }
    
    // Crear contenedor para tiempo y progreso
    const timeContainer = document.createElement('div');
    timeContainer.id = 'timeDisplay';
    timeContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    timeContainer.style.padding = '10px';
    timeContainer.style.borderRadius = '5px';
    timeContainer.style.marginTop = '10px';
    
    // Crear elementos para mostrar tiempo actual y duración
    const timeInfo = document.createElement('div');
    timeInfo.style.display = 'flex';
    timeInfo.style.justifyContent = 'space-between';
    timeInfo.style.fontSize = '14px';
    timeInfo.style.color = '#a0aec0';
    timeInfo.style.marginBottom = '5px';
    
    const currentTimeElement = document.createElement('span');
    currentTimeElement.id = 'currentTime';
    currentTimeElement.textContent = '0:00';
    
    const durationElement = document.createElement('span');
    durationElement.id = 'duration';
    durationElement.textContent = formatTime(audioPlayer.duration || 0);
    
    timeInfo.appendChild(currentTimeElement);
    timeInfo.appendChild(durationElement);
    
    // Crear barra de progreso
    const progressContainer = document.createElement('div');
    progressContainer.style.width = '100%';
    progressContainer.style.backgroundColor = '#4a5568';
    progressContainer.style.borderRadius = '9999px';
    progressContainer.style.height = '8px';
    
    const progressBarElement = document.createElement('div');
    progressBarElement.id = 'progressBar';
    progressBarElement.style.backgroundColor = '#9f7aea';
    progressBarElement.style.height = '8px';
    progressBarElement.style.borderRadius = '9999px';
    progressBarElement.style.width = '0%';
    progressBarElement.style.transition = 'width 0.1s';
    
    progressContainer.appendChild(progressBarElement);
    
    // Añadir elementos al contenedor
    timeContainer.appendChild(timeInfo);
    timeContainer.appendChild(progressContainer);
    
    // Añadir contenedor después del reproductor de audio
    audioPlayerContainer.appendChild(timeContainer);
    
    // Crear botones de control si no existen
    createControlButtons();
}

// Crear botones de control
function createControlButtons() {
    // Verificar si ya existen
    if (document.getElementById('controlButtons')) {
        return;
    }
    
    // Crear contenedor para botones
    const buttonContainer = document.createElement('div');
    buttonContainer.id = 'controlButtons';
    buttonContainer.style.display = 'flex';
    buttonContainer.style.gap = '10px';
    buttonContainer.style.marginTop = '15px';
    
    // Botón de reproducción/pausa
    const playButton = document.createElement('button');
    playButton.id = 'playButton';
    playButton.textContent = 'Reproducir';
    playButton.className = 'bg-green-600 hover:bg-green-700 text-white rounded-lg transition-all';
    playButton.style.padding = '8px 16px';
    playButton.style.border = 'none';
    playButton.style.cursor = 'pointer';
    playButton.style.flex = '1';
    playButton.onclick = togglePlayback;
    
    // Botón de reinicio
    const resetButton = document.createElement('button');
    resetButton.textContent = 'Reiniciar';
    resetButton.className = 'bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-all';
    resetButton.style.padding = '8px 16px';
    resetButton.style.border = 'none';
    resetButton.style.cursor = 'pointer';
    resetButton.style.flex = '1';
    resetButton.onclick = resetAudio;
    
    // Botón de transcripción
    const transcribeButton = document.createElement('button');
    transcribeButton.id = 'transcribeButton';
    transcribeButton.textContent = 'Iniciar Transcripción';
    transcribeButton.className = 'bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all';
    transcribeButton.style.padding = '8px 16px';
    transcribeButton.style.border = 'none';
    transcribeButton.style.cursor = 'pointer';
    transcribeButton.style.flex = '1';
    transcribeButton.onclick = toggleTranscription;
    
    // Botón de guardar
    const saveButton = document.createElement('button');
    saveButton.id = 'saveButton';
    saveButton.textContent = 'Guardar';
    saveButton.className = 'bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-all';
    saveButton.style.padding = '8px 16px';
    saveButton.style.border = 'none';
    saveButton.style.cursor = 'pointer';
    saveButton.style.flex = '1';
    saveButton.onclick = saveAllData;
    
    // Añadir botones al contenedor
    buttonContainer.appendChild(playButton);
    buttonContainer.appendChild(resetButton);
    buttonContainer.appendChild(transcribeButton);
    buttonContainer.appendChild(saveButton);
    
    // Añadir contenedor después del reproductor de audio
    audioPlayerContainer.appendChild(buttonContainer);
}

// Nueva función para alternar la transcripción con OpenAI Whisper
function toggleTranscription() {
    isTranscribing = !isTranscribing;

    // Actualizar botón
    const transcribeButton = document.getElementById('transcribeButton');
    if (transcribeButton) {
        if (isTranscribing) {
            transcribeButton.textContent = 'Detener Transcripción';
            transcribeButton.classList.remove('bg-blue-600', 'hover:bg-blue-700');
            transcribeButton.classList.add('bg-red-600', 'hover:bg-red-700');

            // Crear o actualizar área de transcripción
            let transcriptArea = document.getElementById('transcriptArea');
            if (!transcriptArea) {
                transcriptArea = document.createElement('div');
                transcriptArea.id = 'transcriptArea';
                transcriptArea.style.marginTop = '15px';
                transcriptArea.style.padding = '10px';
                transcriptArea.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
                transcriptArea.style.borderRadius = '5px';
                transcriptArea.style.color = '#ffffff';
                transcriptArea.style.minHeight = '100px';
                transcriptArea.style.maxHeight = '200px';
                transcriptArea.style.overflowY = 'auto';

                const transcriptTitle = document.createElement('div');
                transcriptTitle.textContent = 'Transcripción';
                transcriptTitle.style.fontWeight = 'bold';
                transcriptTitle.style.marginBottom = '5px';

                const transcriptContent = document.createElement('div');
                transcriptContent.id = 'transcriptContent';
                transcriptContent.textContent = 'La transcripción aparecerá aquí...';

                transcriptArea.appendChild(transcriptTitle);
                transcriptArea.appendChild(transcriptContent);

                audioPlayerContainer.appendChild(transcriptArea);
            }

            // Mostrar campo para pedir la API Key si no existe
            let apiKeyInput = document.getElementById('openaiApiKey');
            if (!apiKeyInput) {
                apiKeyInput = document.createElement('input');
                apiKeyInput.type = 'password';
                apiKeyInput.id = 'openaiApiKey';
                apiKeyInput.placeholder = 'Pega tu OpenAI API Key aquí';
                apiKeyInput.style.width = '100%';
                apiKeyInput.style.marginTop = '10px';
                apiKeyInput.style.padding = '8px';
                apiKeyInput.style.borderRadius = '5px';
                apiKeyInput.style.border = '1px solid #888';
                apiKeyInput.autocomplete = 'off';
                transcriptArea.appendChild(apiKeyInput);
            }

            // Botón para iniciar transcripción si se subió archivo
            let whisperBtn = document.getElementById('startWhisperBtn');
            if (!whisperBtn) {
                whisperBtn = document.createElement('button');
                whisperBtn.id = 'startWhisperBtn';
                whisperBtn.textContent = 'Enviar a Whisper';
                whisperBtn.className = 'bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-all';
                whisperBtn.style.padding = '8px 16px';
                whisperBtn.style.border = 'none';
                whisperBtn.style.cursor = 'pointer';
                whisperBtn.style.marginTop = '8px';
                transcriptArea.appendChild(whisperBtn);
            }
            whisperBtn.onclick = async () => {
                // Usar el archivo actualmente cargado
                const files = audioInput.files;
                if (!files || files.length === 0) {
                    alert('Carga primero un archivo de audio.');
                    return;
                }
                const audioFile = files[0];
                const apiKey = apiKeyInput.value.trim();
                if (!apiKey) {
                    alert('Ingresa tu API Key de OpenAI');
                    return;
                }
                transcriptContent.textContent = 'Transcribiendo... Esto puede tardar unos segundos.';
                try {
                    const formData = new FormData();
                    formData.append('file', audioFile);
                    formData.append('model', 'whisper-1');
                    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
                        method: 'POST',
                        headers: {
                            'Authorization': 'Bearer ' + apiKey
                        },
                        body: formData
                    });
                    if (!response.ok) {
                        throw new Error('Error en la transcripción. Código ' + response.status);
                    }
                    const data = await response.json();
                    const { text } = data;
                    transcriptContent.textContent = text;
                    transcriptData = [
                        {text: text.trim(), timestamp: new Date().toISOString(), isFinal: true}
                    ];
                    // Guardar automáticamente la sesión (transcripción)
                    saveSessionData();
                } catch (err) {
                    transcriptContent.textContent = 'Error al transcribir: ' + err.message;
                }
            };
        } else {
            transcribeButton.textContent = 'Iniciar Transcripción';
            transcribeButton.classList.remove('bg-red-600', 'hover:bg-red-700');
            transcribeButton.classList.add('bg-blue-600', 'hover:bg-blue-700');
        }
    }
}

// Iniciar reconocimiento de voz
let recognition = null;
function startSpeechRecognition() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        alert('Tu navegador no soporta reconocimiento de voz. Intenta con Chrome o Edge.');
        return;
    }
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.lang = 'es-ES';
    recognition.continuous = true;
    recognition.interimResults = true;
    
    recognition.onresult = function(event) {
        let interimTranscript = '';
        let finalTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            
            if (event.results[i].isFinal) {
                finalTranscript += transcript + ' ';
                // Guardar en el array de transcripción
                transcriptData.push({
                    text: transcript.trim(),
                    timestamp: new Date().toISOString(),
                    isFinal: true
                });
                
                // Verificar palabras ofensivas
                checkForProfanity(transcript);
            } else {
                interimTranscript += transcript;
            }
        }
        
        // Actualizar el área de transcripción
        const transcriptContent = document.getElementById('transcriptContent');
        if (transcriptContent) {
            // Mostrar transcripción completa
            const allTranscripts = transcriptData
                .filter(item => item.isFinal)
                .map(item => item.text)
                .join(' ');
                
            transcriptContent.innerHTML = `<span>${allTranscripts}</span>`;
            if (interimTranscript) {
                transcriptContent.innerHTML += `<span style="color: #a0aec0"> ${interimTranscript}</span>`;
            }
        }
    };
    
    recognition.onerror = function(event) {
        console.error('Error en reconocimiento de voz:', event.error);
    };
    
    recognition.onend = function() {
        // Reiniciar si aún estamos transcribiendo
        if (isTranscribing) {
            recognition.start();
        }
    };
    
    try {
        recognition.start();
    } catch (error) {
        console.error('Error al iniciar reconocimiento de voz:', error);
    }
}

// Detener reconocimiento de voz
function stopSpeechRecognition() {
    if (recognition) {
        recognition.stop();
        recognition = null;
    }
}

// Verificar palabras ofensivas
function checkForProfanity(text) {
    // Lista básica de palabras ofensivas en español
    const profanityList = [
        'mierda', 'puta', 'cabrón', 'joder', 'coño', 'gilipollas',
        'idiota', 'imbécil', 'pendejo', 'estúpido', 'maricón', 'puto', "culo", "mama huevo",'mierda', 'joder',
        'coño', 'puta', 'puto', 'cabrón', 'cabron', 'gilipollas', 'idiota', 'imbécil', 'estúpido', 'estupido','pendejo', 'mamón', 'mamon', 
        'hijo de puta', 'hdp', 'fuck', 'shit', 'damn', 'bitch', 'asshole',
        'bastard', 'crap', 'hell', 'piss', 'dickhead', 'motherfucker', "idiota", "chucha", "mama verga"
    ];
    
    const lowerText = text.toLowerCase();
    const words = lowerText.split(/\s+/);
    
    words.forEach(word => {
        if (profanityList.some(badWord => word.includes(badWord))) {
            // Guardar palabra ofensiva detectada
            profanityData.push({
                word: word,
                context: text,
                timestamp: new Date().toISOString()
            });
            
            console.log('Palabra ofensiva detectada:', word);
        }
    });
}

// Función para guardar los datos de la sesión actual
function saveSessionData() {
    if (!currentSessionId) {
        currentSessionId = generateSessionId();
    }
    
    const sessionData = {
        id: currentSessionId,
        fileName: uploadedFileName,
        date: new Date().toISOString(),
        transcript: transcriptData,
        profanity: profanityData,
        frequency: frequencyData
    };
    
    // Guardar en localStorage
    saveToLocalStorage('session_' + currentSessionId, sessionData);
    
    // Actualizar lista de sesiones
    const sessions = getSessionsList();
    if (!sessions.includes(currentSessionId)) {
        sessions.push(currentSessionId);
        saveToLocalStorage('sessions_list', sessions);
    }
    
    console.log('Sesión guardada:', currentSessionId);
    return currentSessionId;
}

// Generar ID único para la sesión
function generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Guardar datos en localStorage
function saveToLocalStorage(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
        return true;
    } catch (error) {
        console.error('Error al guardar en localStorage:', error);
        return false;
    }
}

// Obtener datos de localStorage
function getFromLocalStorage(key) {
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    } catch (error) {
        console.error('Error al obtener de localStorage:', error);
        return null;
    }
}

// Obtener lista de sesiones guardadas
function getSessionsList() {
    const sessions = getFromLocalStorage('sessions_list');
    return Array.isArray(sessions) ? sessions : [];
}

// Cargar datos de una sesión específica
function loadSessionData(sessionId) {
    return getFromLocalStorage('session_' + sessionId);
}

// Crear interfaz para visualizar sesiones guardadas
function createSessionsViewer() {
    // Limpiar contenedor principal
    audioPlayerContainer.innerHTML = '';
    
    // Crear contenedor para el visor de sesiones
    const sessionsContainer = document.createElement('div');
    sessionsContainer.id = 'sessionsContainer';
    sessionsContainer.style.width = '100%';
    sessionsContainer.style.padding = '20px';
    sessionsContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.2)';
    sessionsContainer.style.borderRadius = '10px';
    
    // Título
    const title = document.createElement('h2');
    title.textContent = 'Sesiones Guardadas';
    title.style.color = '#ffffff';
    title.style.marginBottom = '20px';
    title.style.textAlign = 'center';
    sessionsContainer.appendChild(title);
    
    // Botón para volver
    const backButton = document.createElement('button');
    backButton.textContent = 'Volver al Analizador';
    backButton.className = 'bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded';
    backButton.style.marginBottom = '20px';
    backButton.onclick = function() {
        location.reload(); // Recargar la página para volver al analizador
    };
    sessionsContainer.appendChild(backButton);
    
    // Contenedor de carpetas
    const foldersContainer = document.createElement('div');
    foldersContainer.style.display = 'flex';
    foldersContainer.style.justifyContent = 'space-around';
    foldersContainer.style.flexWrap = 'wrap';
    foldersContainer.style.gap = '20px';
    
    // Crear carpetas
    const folders = [
        { name: 'Transcripciones', icon: '📝', type: 'transcript' },
        { name: 'Palabras Ofensivas', icon: '⚠️', type: 'profanity' },
        { name: 'Frecuencias', icon: '📊', type: 'frequency' },
        { name: 'Audio', icon: '🔊', type: 'audio' }
    ];
    
    folders.forEach(folder => {
        const folderElement = createFolderElement(folder);
        foldersContainer.appendChild(folderElement);
    });
    
    sessionsContainer.appendChild(foldersContainer);
    
    // Contenedor para mostrar el contenido de las carpetas
    const contentContainer = document.createElement('div');
    contentContainer.id = 'folderContentContainer';
    contentContainer.style.marginTop = '30px';
    contentContainer.style.padding = '15px';
    contentContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
    contentContainer.style.borderRadius = '5px';
    contentContainer.style.minHeight = '200px';
    contentContainer.style.color = '#ffffff';
    contentContainer.style.display = 'none'; // Inicialmente oculto
    
    sessionsContainer.appendChild(contentContainer);
    audioPlayerContainer.appendChild(sessionsContainer);
}

// Crear elemento de carpeta
function createFolderElement(folder) {
    const folderElement = document.createElement('div');
    folderElement.className = 'folder';
    folderElement.style.width = '120px';
    folderElement.style.height = '120px';
    folderElement.style.backgroundColor = 'rgba(59, 130, 246, 0.3)';
    folderElement.style.borderRadius = '10px';
    folderElement.style.display = 'flex';
    folderElement.style.flexDirection = 'column';
    folderElement.style.alignItems = 'center';
    folderElement.style.justifyContent = 'center';
    folderElement.style.cursor = 'pointer';
    folderElement.style.transition = 'transform 0.2s, background-color 0.2s';
    
    // Icono
    const icon = document.createElement('div');
    icon.textContent = folder.icon;
    icon.style.fontSize = '40px';
    icon.style.marginBottom = '10px';
    
    // Nombre
    const name = document.createElement('div');
    name.textContent = folder.name;
    name.style.color = '#ffffff';
    name.style.textAlign = 'center';
    
    folderElement.appendChild(icon);
    folderElement.appendChild(name);
    
    // Efecto hover
    folderElement.onmouseover = function() {
        this.style.transform = 'scale(1.05)';
        this.style.backgroundColor = 'rgba(59, 130, 246, 0.5)';
    };
    
    folderElement.onmouseout = function() {
        this.style.transform = 'scale(1)';
        this.style.backgroundColor = 'rgba(59, 130, 246, 0.3)';
    };
    
    // Abrir carpeta al hacer clic
    folderElement.onclick = function() {
        openFolder(folder.type);
    };
    
    return folderElement;
}

// Abrir carpeta y mostrar su contenido
function openFolder(folderType) {
    const contentContainer = document.getElementById('folderContentContainer');
    contentContainer.style.display = 'block';
    contentContainer.innerHTML = '';
    
    // Título de la carpeta
    const folderTitle = document.createElement('h3');
    let titleText = '';
    
    switch (folderType) {
        case 'transcript':
            titleText = '📝 Transcripciones';
            break;
        case 'profanity':
            titleText = '⚠️ Palabras Ofensivas';
            break;
        case 'frequency':
            titleText = '📊 Frecuencias';
            break;
        case 'audio':
            titleText = '🔊 Audio';
            break;
    }
    
    folderTitle.textContent = titleText;
    folderTitle.style.marginBottom = '15px';
    folderTitle.style.borderBottom = '1px solid rgba(255, 255, 255, 0.3)';
    folderTitle.style.paddingBottom = '10px';
    contentContainer.appendChild(folderTitle);
    
    // Obtener lista de sesiones
    const sessions = getSessionsList();
    
    if (sessions.length === 0) {
        const emptyMessage = document.createElement('p');
        emptyMessage.textContent = 'No hay sesiones guardadas.';
        emptyMessage.style.textAlign = 'center';
        emptyMessage.style.padding = '20px';
        contentContainer.appendChild(emptyMessage);
        return;
    }
    
    // Crear lista de sesiones
    const sessionsList = document.createElement('div');
    sessionsList.style.display = 'flex';
    sessionsList.style.flexDirection = 'column';
    sessionsList.style.gap = '10px';
    
    // Cargar y mostrar datos de cada sesión
    sessions.forEach(sessionId => {
        const sessionData = loadSessionData(sessionId);
        if (sessionData) {
            const sessionElement = createSessionElement(sessionData, folderType);
            if (sessionElement) {
                sessionsList.appendChild(sessionElement);
            }
        }
    });
    
    contentContainer.appendChild(sessionsList);
}

// Crear elemento para una sesión
function createSessionElement(sessionData, folderType) {
    // Verificar si hay datos para este tipo de carpeta
    let hasData = false;
    switch (folderType) {
        case 'transcript':
            hasData = sessionData.transcript && sessionData.transcript.length > 0;
            break;
        case 'profanity':
            hasData = sessionData.profanity && sessionData.profanity.length > 0;
            break;
        case 'frequency':
            hasData = sessionData.frequency && sessionData.frequency.length > 0;
            break;
        case 'audio':
            hasData = sessionData.fileName;
            break;
    }
    
    if (!hasData) return null;
    
    // Crear elemento de sesión
    const sessionElement = document.createElement('div');
    sessionElement.className = 'session-item';
    sessionElement.style.backgroundColor = 'rgba(0, 0, 0, 0.2)';
    sessionElement.style.padding = '10px';
    sessionElement.style.borderRadius = '5px';
    sessionElement.style.cursor = 'pointer';
    
    // Fecha formateada
    const date = new Date(sessionData.date);
    const formattedDate = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
    
    // Título de la sesión
    const sessionTitle = document.createElement('div');
    sessionTitle.style.fontWeight = 'bold';
    sessionTitle.style.marginBottom = '5px';
    sessionTitle.textContent = `Sesión: ${formattedDate}`;
    
    // Información adicional
    const sessionInfo = document.createElement('div');
    sessionInfo.style.fontSize = '0.9em';
    sessionInfo.style.color = '#a0aec0';
    
    if (sessionData.fileName) {
        sessionInfo.textContent = `Archivo: ${sessionData.fileName}`;
    }
    
    sessionElement.appendChild(sessionTitle);
    sessionElement.appendChild(sessionInfo);
    
    // Expandir/contraer al hacer clic
    let isExpanded = false;
    const contentDiv = document.createElement('div');
    contentDiv.style.display = 'none';
    contentDiv.style.marginTop = '10px';
    contentDiv.style.padding = '10px';
    contentDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.2)';
    contentDiv.style.borderRadius = '5px';
    
    // Llenar contenido según el tipo de carpeta
    switch (folderType) {
        case 'transcript':
            fillTranscriptContent(contentDiv, sessionData);
            break;
        case 'profanity':
            fillProfanityContent(contentDiv, sessionData);
            break;
        case 'frequency':
            fillFrequencyContent(contentDiv, sessionData);
            break;
        case 'audio':
            fillAudioContent(contentDiv, sessionData);
            break;
    }
    
    sessionElement.appendChild(contentDiv);
    
    sessionElement.onclick = function() {
        isExpanded = !isExpanded;
        contentDiv.style.display = isExpanded ? 'block' : 'none';
    };
    
    return sessionElement;
}

// Llenar contenido de transcripción
function fillTranscriptContent(container, sessionData) {
    if (!sessionData.transcript || sessionData.transcript.length === 0) {
        container.textContent = 'No hay datos de transcripción disponibles.';
        return;
    }
    
    const transcriptText = document.createElement('div');
    const fullText = sessionData.transcript
        .filter(item => item.isFinal)
        .map(item => item.text)
        .join(' ');
    
    transcriptText.textContent = fullText || 'No hay transcripción disponible.';
    container.appendChild(transcriptText);
}

// Llenar contenido de palabras ofensivas
function fillProfanityContent(container, sessionData) {
    if (!sessionData.profanity || sessionData.profanity.length === 0) {
        container.textContent = 'No se detectaron palabras ofensivas.';
        return;
    }
    
    const profanityList = document.createElement('ul');
    profanityList.style.listStyleType = 'none';
    profanityList.style.padding = '0';
    
    sessionData.profanity.forEach(item => {
        const listItem = document.createElement('li');
        listItem.style.marginBottom = '5px';
        listItem.style.padding = '5px';
        listItem.style.borderBottom = '1px solid rgba(255, 255, 255, 0.1)';
        
        const word = document.createElement('span');
        word.textContent = `"${item.word}"`;
        word.style.color = '#f56565';
        word.style.fontWeight = 'bold';
        
        const context = document.createElement('span');
        context.textContent = ` - Contexto: "${item.context}"`;
        
        listItem.appendChild(word);
        listItem.appendChild(context);
        profanityList.appendChild(listItem);
    });
    
    container.appendChild(profanityList);
}

// Llenar contenido de frecuencias
function fillFrequencyContent(container, sessionData) {
    if (!sessionData.frequency || sessionData.frequency.length === 0) {
        container.textContent = 'No hay datos de frecuencia disponibles.';
        return;
    }
    
    // Crear gráfico de frecuencias (simplificado)
    const chartContainer = document.createElement('div');
    chartContainer.style.width = '100%';
    chartContainer.style.height = '150px';
    chartContainer.style.position = 'relative';
    chartContainer.style.marginTop = '10px';
    
    // Aquí se podría implementar un gráfico real con una biblioteca como Chart.js
    // Por ahora, mostramos un gráfico simplificado
    
    const frequencyData = sessionData.frequency;
    const maxFreq = Math.max(...frequencyData.map(f => f.value));
    
    for (let i = 0; i < Math.min(frequencyData.length, 50); i++) {
        const bar = document.createElement('div');
        const height = (frequencyData[i].value / maxFreq) * 100;
        
        bar.style.position = 'absolute';
        bar.style.bottom = '0';
        bar.style.left = `${(i / 50) * 100}%`;
        bar.style.width = '1.5%';
        bar.style.height = `${height}%`;
        bar.style.backgroundColor = `hsl(${240 - (height * 2.4)}, 100%, 50%)`;
        
        chartContainer.appendChild(bar);
    }
    
    container.appendChild(chartContainer);
}

// Llenar contenido de audio
function fillAudioContent(container, sessionData) {
    if (!sessionData.fileName) {
        container.textContent = 'No hay información de audio disponible.';
        return;
    }
    
    const audioInfo = document.createElement('div');
    audioInfo.textContent = `Nombre del archivo: ${sessionData.fileName}`;
    container.appendChild(audioInfo);
    
    // Nota: No podemos reproducir el audio directamente ya que no lo guardamos,
    // solo guardamos el nombre del archivo
    const noteElement = document.createElement('p');
    noteElement.style.marginTop = '10px';
    noteElement.style.fontStyle = 'italic';
    noteElement.style.color = '#a0aec0';
    noteElement.textContent = 'Nota: Para reproducir este audio, deberás cargarlo nuevamente en el analizador.';
    
    container.appendChild(noteElement);
}

// Función para capturar datos de frecuencia durante el análisis
function captureFrequencyData() {
    if (!analyser || !isAnalyzing) return;
    
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(dataArray);
    
    // Guardar datos de frecuencia cada cierto intervalo (por ejemplo, cada 5 segundos)
    const now = Date.now();
    const lastCaptureTime = frequencyData.length > 0 ? 
        new Date(frequencyData[frequencyData.length - 1].timestamp).getTime() : 0;
    
    if (now - lastCaptureTime >= 5000) { // 5 segundos
        // Tomar una muestra reducida para no almacenar demasiados datos
        const sampleSize = 50;
        const step = Math.floor(dataArray.length / sampleSize);
        const sampledData = [];
        
        for (let i = 0; i < sampleSize; i++) {
            sampledData.push(dataArray[i * step]);
        }
        
        frequencyData.push({
            timestamp: new Date().toISOString(),
            data: sampledData,
            dominantFrequency: findDominantFrequency(dataArray),
            value: Math.max(...sampledData) // Para visualización simplificada
        });
    }
}

// Función para encontrar la frecuencia dominante
function findDominantFrequency(dataArray) {
    if (!dataArray || !analyser) return 0;
    
    let maxValue = 0;
    let maxIndex = 0;
    
    for (let i = 0; i < dataArray.length; i++) {
        if (dataArray[i] > maxValue) {
            maxValue = dataArray[i];
            maxIndex = i;
        }
    }
    
    // Convertir el índice a frecuencia en Hz
    return maxIndex * audioContext.sampleRate / (analyser.fftSize * 2);
}

// Botón para ver sesiones guardadas
function createSessionsButton() {
    const sessionsButton = document.createElement('button');
    sessionsButton.id = 'sessionsButton';
    sessionsButton.textContent = 'Ver Sesiones Guardadas';
    sessionsButton.className = 'bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded';
    sessionsButton.style.marginLeft = '10px';
    sessionsButton.onclick = createSessionsViewer;
    
    return sessionsButton;
}

// Modificar la función createControlButtons para incluir el botón de sesiones
const originalCreateControlButtons = createControlButtons;
createControlButtons = function() {
    const buttonsContainer = originalCreateControlButtons();
    
    // Agregar botón de sesiones
    const sessionsButton = createSessionsButton();
    buttonsContainer.appendChild(sessionsButton);
    
    return buttonsContainer;
};

// Modificar startAnalyzing para capturar datos de frecuencia
const originalStartAnalyzing = startAnalyzing;
startAnalyzing = function() {
    const result = originalStartAnalyzing();
    
    // Iniciar captura de datos de frecuencia
    if (isAnalyzing) {
        // Capturar datos de frecuencia periódicamente
        setInterval(captureFrequencyData, 1000); // Cada segundo verificamos si debemos capturar
    }
    
    return result;
};

// Modificar handleFileUpload para inicializar la sesión
const originalHandleFileUpload = handleFileUpload;
handleFileUpload = function(event) {
    // Limpiar datos de la sesión anterior
    transcriptData = [];
    profanityData = [];
    frequencyData = [];
    currentSessionId = generateSessionId();
    
    // Guardar nombre del archivo
    const file = event.target.files[0];
    if (file) {
        uploadedFileName = file.name;
    }
    
    // Llamar a la función original
    return originalHandleFileUpload(event);
};

// Función para guardar todos los datos (transcripción, audio y captura de frecuencias)
async function saveAllData() {
    try {
        // Verificar si hay datos para guardar
        if (!audioPlayer || !audioPlayer.src) {
            alert('No hay audio cargado para guardar.');
            return;
        }
        
        // Crear objeto para almacenar todos los datos
        const allData = {
            timestamp: new Date().toISOString(),
            fileName: uploadedFileName || 'audio_sin_nombre.mp3'
        };
        
        // 1. Guardar transcripción
        if (transcriptData.length > 0) {
            const transcriptionText = transcriptData
                .filter(item => item.isFinal)
                .map(item => item.text)
                .join(' ');
            
            allData.transcription = transcriptionText;
            
            // Crear y descargar archivo de texto con la transcripción
            const transcriptBlob = new Blob([transcriptionText], { type: 'text/plain' });
            const transcriptURL = URL.createObjectURL(transcriptBlob);
            downloadFile(transcriptURL, 'transcripcion.txt');
        } else {
            console.log('No hay datos de transcripción para guardar');
        }
        
        // 2. Guardar captura de las frecuencias (canvas)
        if (canvas) {
            try {
                const imageURL = canvas.toDataURL('image/png');
                allData.frequencyImage = imageURL;
                
                // Descargar imagen
                downloadFile(imageURL, 'frecuencias.png');
            } catch (canvasError) {
                console.error('Error al capturar imagen del canvas:', canvasError);
            }
        } else {
            console.log('No hay visualización de frecuencias para guardar');
        }
        
        // 3. Guardar audio
        if (audioPlayer && audioPlayer.src) {
            try {
                // Obtener el blob del audio actual
                const audioResponse = await fetch(audioPlayer.src);
                const audioBlob = await audioResponse.blob();
                
                // Crear URL y descargar
                const audioURL = URL.createObjectURL(audioBlob);
                downloadFile(audioURL, uploadedFileName || 'audio_guardado.mp3');
            } catch (audioError) {
                console.error('Error al guardar el audio:', audioError);
                alert('No se pudo guardar el archivo de audio.');
            }
        }
        
        // Guardar en localStorage para referencia futura
        if (currentSessionId) {
            saveSessionData();
        }
        
        // Mostrar mensaje de éxito
        alert('Datos guardados correctamente. Revisa tus descargas.');
        
    } catch (error) {
        console.error('Error al guardar los datos:', error);
        alert(`Error al guardar: ${error.message}`);
    }
}

// Función auxiliar para descargar archivos
function downloadFile(url, filename) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 100);
}

// Inicializar eventos
audioInput.addEventListener('change', handleFileUpload);

// Limpiar recursos al cerrar la página
window.addEventListener('beforeunload', cleanupAudio);