// js/stockfish-ai.js    
    
// ===================== STOCKFISH - MOTOR REAL =====================    
// Variables globales para el manejo del motor Stockfish    
let engine = null;    
let engineReady = false;   
let currentStockfishResolve = null;   
let currentStockfishTimeout = null;   
let stockfishIsProcessing = false;   
const stockfishCommandQueue = []; // La cola de comandos se puede usar si se necesitan múltiples solicitudes concurrentes, pero para este caso no es estrictamente necesario.  
    
/**    
 * Listener global para todos los mensajes que Stockfish envía desde el Web Worker.    
 *    
 * @param {MessageEvent} event - El evento de mensaje recibido de Stockfish Worker.    
 */    
function stockfishMessageListener(event) {    
    const data = event.data;  // En Web Workers, el mensaje viene en event.data    
    
    // Confirma que el motor está listo después de un comando 'isready'    
    if (data === 'readyok') {    
        console.log('✅ Stockfish reporta readyok.');    
        engineReady = true;    
        window.engineReady = true; // Hacer esta variable globalmente accesible    
        const coachMessageElem = document.getElementById('coachMessage');    
        if (coachMessageElem) {    
            coachMessageElem.innerHTML = '<strong>✅ Stockfish Real</strong> Motor profesional activado.';    
        }    
        // Ahora que el motor está realmente listo, enviamos los comandos UCI iniciales    
        sendStockfishCommand('ucinewgame');    
        // Si hay alguna evaluación pendiente o alguna UI que actualizar, lo haríamos aquí.  
        // En tu caso, updateUI() ya se encarga de esto después de initializeStockfishEngine.  
    }    
    // Los mensajes 'info' y 'bestmove' son manejados por el listener temporal en 'evaluateWithStockfish'    
    // cuando hay una evaluación activa. Si no hay evaluación activa, el listener global los ignora.    
    else if (data.startsWith('bestmove')) {    
        if (currentStockfishResolve) {    
            // El timeout ya debería haber sido limpiado por el listener temporal en evaluateWithStockfish    
            // stockfishIsProcessing también se limpia en la resolución.    
            const match = data.match(/bestmove (\S+)/);    
            const bestMove = match ? match[1] : null;    
            currentStockfishResolve({ bestMove: bestMove });    
            currentStockfishResolve = null; // Limpiar la referencia a la promesa resuelta    
        }    
    }    
    // Otros mensajes UCI no relacionados con info/bestmove (como id, uciok, etc.)    
    // podrían ser manejados aquí si fuera necesario.    
}    
    
/**    
 * Inicializa el motor Stockfish como un Web Worker.    
 * Esta función debe llamarse después de que el DOM esté listo (DOMContentLoaded).    
 */    
async function initializeStockfishEngine() {    
    try {    
        console.log('⏳ Intentando inicializar Stockfish como Web Worker...');  
          
        // Crear un nuevo Web Worker usando la URL del script de Stockfish.  
        // La URL debe ser la misma que la que usas en el script tag de index.html  
        engine = new Worker('https://cdn.jsdelivr.net/npm/stockfish@latest/src/stockfish.js');  
          
        // Asignar el listener global para mensajes del worker.  
        engine.onmessage = stockfishMessageListener;    
    
        // Manejar errores del worker  
        engine.onerror = (error) => {  
            console.error('Error en el Web Worker de Stockfish:', error);  
            // Informa al usuario sobre el fallo en la inicialización  
            const coachMessageElem = document.getElementById('coachMessage');    
            if (coachMessageElem) {    
                coachMessageElem.innerHTML = '<strong>⚠️ Stockfish No Disponible</strong> Error en el Worker. (Revisa la consola)';    
            }    
            engineReady = false;    
            window.engineReady = false;  
        };  
  
        // Enviar comandos UCI iniciales para configurar el motor  
        // Estos comandos se envían directamente al worker.  
        // Es importante enviar 'uci' y luego 'isready' para que el worker se inicialice.  
        sendStockfishCommand('uci');    
        sendStockfishCommand('isready'); // Esperar 'readyok' para confirmar que el motor está listo    
          
        // No necesitamos 'await engine.ready;' porque ya estamos manejando 'readyok' en el listener  
        // y configurando engineReady allí.  
  
    } catch (e) {    
        console.error('Error creando el Web Worker de Stockfish:', e);    
        engineReady = false;    
        window.engineReady = false;   
    
        const coachMessageElem = document.getElementById('coachMessage');    
        if (coachMessageElem) {    
            coachMessageElem.innerHTML = '<strong>⚠️ Stockfish No Disponible</strong> Fallo al crear Worker. (Revisa la consola)';    
        }    
    }    
}    
    
/**    
 * Envía un comando UCI al motor Stockfish de forma segura.    
 * Verifica si el motor está disponible antes de enviar el comando.    
 * @param {string} command - El comando UCI a enviar (ej. 'position fen ...', 'go depth ...').    
 */    
function sendStockfishCommand(command) {    
    if (!engine) { // Comprobamos solo si el worker existe    
        console.warn('Stockfish Worker no está inicializado para recibir comandos.');    
        return;    
    }    
    engine.postMessage(command);    
}    
    
// ===================== EVALUAR CON STOCKFISH REAL =====================    
    
/**    
 * Realiza una evaluación de la posición actual del juego usando Stockfish.    
 * Devuelve una promesa que se resuelve con el score, bestMove, profundidad alcanzada y la PV.    
 * Es crucial que solo haya una evaluación activa a la vez para evitar sobrescribir el listener.    
 * @param {number} depth - La profundidad de análisis deseada.    
 * @param {number} customTimeout - Tiempo máximo en milisegundos para la evaluación.    
 * @returns {Promise<object>} - Un objeto con { score, bestMove, depth, pv }.    
 */    
function evaluateWithStockfish(depth = 20, customTimeout = 5000) {    
    return new Promise((resolve) => {    
        // Si el motor no está listo, resuelve inmediatamente con valores por defecto.    
        if (!engineReady || !engine) {    
            console.warn('Stockfish no está listo para evaluar.');  
            resolve({ score: 0, bestMove: null, depth: 0, pv: [] });    
            return;    
        }    
    
        // Si ya hay una evaluación en curso, ignora la nueva solicitud para evitar conflictos.    
        if (stockfishIsProcessing) {    
            console.warn("Stockfish ya está procesando un comando 'go'. Ignorando nueva solicitud.");    
            resolve({ score: 0, bestMove: null, depth: 0, pv: [] });    
            return;    
        }    
    
        // Variables para almacenar la información de la evaluación actual    
        let currentScore = 0;    
        let currentDepth = 0;    
        let currentPv = [];    
        let currentBestMove = null;   
    
        // Almacenar la función 'resolve' de esta promesa.    
        currentStockfishResolve = ({ bestMove, score = currentScore, depth = currentDepth, pv = currentPv }) => {    
            clearTimeout(currentStockfishTimeout);   
            currentStockfishResolve = null;    
            stockfishIsProcessing = false;   
            engine.onmessage = stockfishMessageListener; // Restaurar el listener global después de cada evaluación    
            resolve({ score, bestMove, depth, pv });    
        };    
    
        // Establecer un timeout si Stockfish tarda demasiado en responder.    
        currentStockfishTimeout = setTimeout(() => {    
            console.warn('Stockfish timeout. Forzando detención y resolución.');    
            sendStockfishCommand('stop');    
            currentStockfishResolve({ bestMove: currentBestMove, score: currentScore, depth: currentDepth, pv: currentPv });    
        }, customTimeout);    
    
        // Sobrescribe temporalmente el listener para esta evaluación específica.    
        engine.onmessage = (event) => {    
            const data = event.data;    
    
            if (data.startsWith('info')) {    
                const scoreMatch = data.match(/score (cp|mate) (-?\d+)/);    
                if (scoreMatch) {    
                    if (scoreMatch[1] === 'cp') {    
                        currentScore = parseInt(scoreMatch[2]) / 100;    
                    } else if (scoreMatch[1] === 'mate') {    
                        currentScore = scoreMatch[2] > 0 ? 9999 : -9999;    
                    }    
                }    
                const depthMatch = data.match(/depth (\d+)/);    
                if (depthMatch) {    
                    currentDepth = parseInt(depthMatch[1]);    
                }    
                const pvMatch = data.match(/pv (.+)/);    
                if (pvMatch) {    
                    currentPv = pvMatch[1].split(' ');    
                }    
            } else if (data.startsWith('bestmove')) {    
                const match = data.match(/bestmove (\S+)/);    
                currentBestMove = match ? match[1] : null;    
                currentStockfishResolve({ bestMove: currentBestMove });    
            } else {    
                // Otros mensajes no relacionados con info/bestmove se pasan al listener global.    
                // En este caso, el listener global también maneja readyok y bestmove si no hay una evaluación activa.  
                // Podríamos llamar a stockfishMessageListener(event) aquí si quisieramos que el listener global procesara otros mensajes durante la evaluación.  
                // Sin embargo, para no complicar, asumimos que 'info' y 'bestmove' son los únicos relevantes durante evaluateWithStockfish.  
            }    
        };    
    
        try {    
            sendStockfishCommand('position fen ' + window.game.fen());    
            sendStockfishCommand('go depth ' + depth);    
            stockfishIsProcessing = true;    
        } catch (e) {    
            console.error('Error al enviar comando a Stockfish Worker:', e);    
            clearTimeout(currentStockfishTimeout);    
            engine.onmessage = stockfishMessageListener; // Restaurar el listener global    
            currentStockfishResolve({ score: 0, bestMove: null, depth: 0, pv: [] });    
        }    
    });    
}    
    
// ===================== OBTENER MEJOR MOVIMIENTO =====================    
    
/**    
 * Solicita el mejor movimiento a Stockfish para la posición actual.    
 * @param {number} depth - La profundidad de análisis para encontrar el mejor movimiento.    
 * @returns {Promise<object | null>} - Un objeto de movimiento chess.js (con from, to, promotion)    
 *                                      o null si no se pudo encontrar un movimiento válido.    
 */    
async function getBestMoveStockfish(depth = 20) {    
    const customTimeout = 2000 + (depth * 250);    
    const result = await evaluateWithStockfish(depth, customTimeout);    
    
    if (!result.bestMove) {    
        console.warn('Stockfish no pudo encontrar un bestMove, usando movimiento legal aleatorio como fallback.');    
        const moves = window.game.moves({ verbose: true });    
        return moves.length > 0 ? moves[Math.floor(Math.random() * moves.length)] : null;    
    }    
    
    const from = result.bestMove.substring(0, 2);    
    const to = result.bestMove.substring(2, 4);    
    const promotion = result.bestMove.length > 4 ? result.bestMove[4].toLowerCase() : undefined;    
    
    const tempGame = new Chess(window.game.fen());    
    const moveObj = tempGame.move({ from, to, promotion });    
    
    if (moveObj) {    
        return moveObj;    
    }    
    
    console.warn('Stockfish sugirió un movimiento no válido o con promoción incorrecta:', result.bestMove);    
    const moves = window.game.moves({ verbose: true });    
    return moves.length > 0 ? moves[Math.floor(Math.random() * moves.length)] : null;    
}    
    
// ===================== IA JUEGA CON STOCKFISH =====================    
    
/**    
 * Calcula el movimiento de la IA usando Stockfish.    
 * Esta función SOLO calcula y devuelve el movimiento, no lo aplica al juego ni actualiza la UI.    
 * La aplicación del movimiento y la actualización de la UI deben manejarse en 'game.js'.    
 * @returns {Promise<object | null>} - El objeto de movimiento chess.js para la IA, o null si el juego ha terminado o no se encontró movimiento.    
 */    
async function makeAIMove() {    
    if (window.game.game_over()) {    
        return null;    
    }    
    
    const difficultyElem = document.getElementById('difficulty');    
    const difficulty = difficultyElem ? parseInt(difficultyElem.value) : 3;    
    
    const depthMap = {    
        1: 6,     
        2: 10,    
        3: 14,    
        4: 18,    
        5: 22     
    };    
    
    const depth = depthMap[difficulty] || 14;    
    
    console.log(`IA pensando con profundidad ${depth} (dificultad: ${difficulty})...`);    
    
    const aiMoveObj = await getBestMoveStockfish(depth);    
    
    if (!aiMoveObj) {    
        console.error("La IA no pudo encontrar un movimiento válido.");    
    }    
    return aiMoveObj;    
}    
    
    
// ===================== FUNCIONES DE UTILIDAD DE UI =====================    
    
/**    
 * Actualiza el panel de evaluación de Stockfish en la interfaz principal.    
 */    
async function updateEvaluationDisplay() {    
    const displayDepth = 12;    
    const displayTimeout = 2000;    
    
    if (!window.game || typeof window.game.fen !== 'function') {    
        console.error("La instancia global 'game' (Chess.js) no está disponible o no es válida para la evaluación.");    
        return;    
    }    
    
    const result = await evaluateWithStockfish(displayDepth, displayTimeout);    
    
    const currentScoreElem = document.getElementById('currentScoreDisplay');    
    const currentDepthElem = document.getElementById('currentDepthDisplay');    
    const currentPVElem = document.getElementById('currentPVDisplay');    
    const bestMoveSuggestionElem = document.getElementById('bestMoveSuggestionDisplay');    
    
    if (currentScoreElem) {    
        currentScoreElem.textContent = result.score !== undefined ? result.score.toFixed(2) : 'N/A';    
    }    
    if (currentDepthElem) {    
        currentDepthElem.textContent = result.depth !== undefined ? result.depth : 'N/A';    
    }    
    if (currentPVElem) {    
        currentPVElem.textContent = result.pv && result.pv.length > 0 ? result.pv.join(' ') : 'N/A';    
    }    
    if (bestMoveSuggestionElem) {    
        bestMoveSuggestionElem.textContent = result.bestMove ? result.bestMove : 'N/A';    
    }    
    
    const evalScoreDiv = document.getElementById('evalScore');    
    if (evalScoreDiv) {    
        evalScoreDiv.textContent = result.score !== undefined ? result.score.toFixed(1) : '0.0';    
    }    
    if (typeof window.updateEvalBar === 'function') {    
        window.updateEvalBar(result.score);    
    }    
}    
    
// ===================== EXPORTAR GLOBALES =====================    
window.initializeStockfishEngine = initializeStockfishEngine;    
window.getBestMoveStockfish = getBestMoveStockfish;    
window.makeAIMove = makeAIMove;    
window.evaluateWithStockfish = evaluateWithStockfish;    
window.updateEvaluationDisplay = updateEvaluationDisplay;    
window.engineReady = engineReady;   
