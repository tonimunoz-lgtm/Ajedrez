// js/stockfish-ai.js (VERSIÓN COMPLETA ARREGLADA)

// ===================== STOCKFISH - MOTOR REAL =====================  
// Variables globales para el manejo del motor Stockfish  
let engine = null;  
let engineReady = false;
let currentStockfishResolve = null;
let currentStockfishTimeout = null;
let stockfishIsProcessing = false;

const stockfishCommandQueue = [];

/**  
 * Listener global para todos los mensajes que Stockfish envía.
 */  
function stockfishMessageListener(message) {  
    const data = typeof message === 'string' ? message : message.data;  

    if (data === 'readyok') {  
        console.log('✅ Stockfish reporta readyok.');  
    }
    else if (data.startsWith('bestmove')) {  
        if (currentStockfishResolve) {  
            const match = data.match(/bestmove (\S+)/);  
            const bestMove = match ? match[1] : null;  
            currentStockfishResolve({ bestMove: bestMove });  
            currentStockfishResolve = null;  
        }  
    }  
}

/**  
 * Inicializa el motor Stockfish. Debe llamarse después de que 'stockfish.js'  
 * se haya cargado y el DOM esté listo (DOMContentLoaded).
 */  
async function initializeStockfishEngine() {    
    try {  
        console.log('Iniciando Stockfish...');  
        console.log('Tipo de window.StockfishMv antes de instanciar:', typeof window.StockfishMv);  
          
        // **CORRECCIÓN CLAVE AQUÍ:**  
        // Asumiendo que window.StockfishMv es la función constructora para el Web Worker.  
        // Debes llamarla para obtener la INSTANCIA del worker.  
        if (typeof window.StockfishMv === 'function') {  
            engine = window.StockfishMv(); // ¡Aquí creamos la instancia del Worker!  
            console.log('✅ Instancia de Stockfish Worker creada.');  
        } else if (window.StockfishMv && typeof window.StockfishMv.postMessage === 'function') {  
            // En algunos casos (menos comunes), StockfishMv ya podría ser la instancia del worker.  
            engine = window.StockfishMv;  
            console.log('✅ StockfishMv ya es la instancia del Worker.');  
        } else {  
            throw new Error('window.StockfishMv no es una función para crear el worker, ni una instancia de worker válida.');  
        }  
  
        if (!engine || typeof engine.postMessage !== 'function') {  
            throw new Error('El objeto "engine" no es una instancia de Worker válida o no tiene el método postMessage.');  
        }  
  
        console.log('✅ Motor Stockfish obtenido y verificado.');  
  
        // Asignar el listener global inmediatamente  
        // Este listener será el 'default' cuando evaluateWithStockfish no esté activo.  
        engine.onmessage = stockfishMessageListener;  
  
        // Establecer engineReady a true  
        engineReady = true;  
        window.engineReady = true; // Para acceso global si es necesario  
  
        console.log('✅ Stockfish WASM cargado y listo.');  
  
        const coachMessageElem = document.getElementById('coachMessage');  
        if (coachMessageElem) {  
            coachMessageElem.innerHTML = '<strong>✅ Stockfish Real</strong> Motor profesional activado.';  
        }  
  
        // Comandos UCI iniciales para configurar el motor  
        sendStockfishCommand('uci');  
        sendStockfishCommand('isready');  
        sendStockfishCommand('ucinewgame');  
  
    } catch (e) {  
        console.error('❌ Error inicializando Stockfish:', e);  
        engineReady = false;  
        window.engineReady = false;  
  
        const coachMessageElem = document.getElementById('coachMessage');  
        if (coachMessageElem) {  
            coachMessageElem.innerHTML = '<strong>⚠️ Stockfish No Disponible</strong> Usando análisis local. Error: ' + e.message;  
        }  
    }  
}
/**  
 * Envía un comando UCI al motor Stockfish de forma segura.
 */  
function sendStockfishCommand(command) {  
    if (!engine || !engineReady) {
        console.warn('Stockfish no está listo para recibir comandos.');
        return;
    }
    
    if (typeof engine.postMessage === 'function') {
        console.log('Enviando comando:', command);
        engine.postMessage(command);
    } else {
        console.warn('engine.postMessage no es una función');
    }
}

// ===================== EVALUAR CON STOCKFISH REAL =====================  

/**  
 * Realiza una evaluación de la posición actual del juego usando Stockfish.
 */  
function evaluateWithStockfish(depth = 20, customTimeout = 5000) {  
    return new Promise((resolve) => {
        if (!engineReady || !engine) {
            console.warn('Stockfish no está listo');
            resolve({ score: 0, bestMove: null, depth: 0, pv: [] });
            return;
        }

        if (stockfishIsProcessing) {
            console.warn("Stockfish ya está procesando. Ignorando nueva solicitud.");
            resolve({ score: 0, bestMove: null, depth: 0, pv: [] });
            return;
        }

        let currentScore = 0;
        let currentDepth = 0;
        let currentPv = [];
        let currentBestMove = null;

        currentStockfishResolve = ({ bestMove, score = currentScore, depth = currentDepth, pv = currentPv }) => {
            clearTimeout(currentStockfishTimeout);
            currentStockfishResolve = null;
            stockfishIsProcessing = false;
            resolve({ score, bestMove, depth, pv });
        };

        currentStockfishTimeout = setTimeout(() => {
            console.warn('Stockfish timeout. Forzando detención y resolución.');
            sendStockfishCommand('stop');
            currentStockfishResolve({ bestMove: currentBestMove, score: currentScore, depth: currentDepth, pv: currentPv });
        }, customTimeout);

        const originalOnMessage = engine.onmessage;

        engine.onmessage = (message) => {
            const data = typeof message === 'string' ? message : message.data;

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

                engine.onmessage = originalOnMessage;
                currentStockfishResolve({ bestMove: currentBestMove });
            } else {
                originalOnMessage(message);
            }
        };

        try {
            sendStockfishCommand('position fen ' + window.game.fen());
            sendStockfishCommand('go depth ' + depth);
            stockfishIsProcessing = true;
        } catch (e) {
            console.error('Error al enviar comando a Stockfish:', e);
            clearTimeout(currentStockfishTimeout);
            engine.onmessage = originalOnMessage;
            currentStockfishResolve({ score: 0, bestMove: null, depth: 0, pv: [] });
        }
    });
}

// ===================== OBTENER MEJOR MOVIMIENTO =====================  

/**  
 * Solicita el mejor movimiento a Stockfish para la posición actual.
 */  
async function getBestMoveStockfish(depth = 20) {  
    const customTimeout = 2000 + (depth * 250);

    const result = await evaluateWithStockfish(depth, customTimeout);

    if (!result.bestMove) {
        console.warn('Stockfish no pudo encontrar un bestMove, usando movimiento aleatorio.');
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

    console.warn('Stockfish sugirió un movimiento no válido:', result.bestMove);
    const moves = window.game.moves({ verbose: true });
    return moves.length > 0 ? moves[Math.floor(Math.random() * moves.length)] : null;
}

// ===================== IA JUEGA CON STOCKFISH =====================  

/**  
 * Calcula el movimiento de la IA usando Stockfish.
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
        console.error("La instancia global 'game' (Chess.js) no está disponible.");
        return;
    }

    const result = await evaluateWithStockfish(displayDepth, displayTimeout);

    const currentScoreElem = document.getElementById('currentScoreDisplay');
    if (currentScoreElem) {
        currentScoreElem.textContent = result.score !== undefined ? result.score.toFixed(2) : 'N/A';
    }

    const currentDepthElem = document.getElementById('currentDepthDisplay');
    if (currentDepthElem) {
        currentDepthElem.textContent = result.depth !== undefined ? result.depth : 'N/A';
    }

    const currentPVElem = document.getElementById('currentPVDisplay');
    if (currentPVElem) {
        currentPVElem.textContent = result.pv && result.pv.length > 0 ? result.pv.join(' ') : 'N/A';
    }

    const bestMoveSuggestionElem = document.getElementById('bestMoveSuggestionDisplay');
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
