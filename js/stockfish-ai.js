// js/stockfish-ai.js    
    
// ===================== STOCKFISH - MOTOR REAL =====================    
// Variables globales para el manejo del motor Stockfish    
let engine = null;    
let engineReady = false;   
let currentStockfishResolve = null;   
let currentStockfishTimeout = null;   
let stockfishIsProcessing = false;   
const stockfishCommandQueue = [];   
    
/**    
 * Listener global para todos los mensajes que Stockfish envía desde el Web Worker.    
 *    
 * @param {MessageEvent} event - El evento de mensaje recibido de Stockfish Worker.    
 */    
function stockfishMessageListener(event) {    
    const data = event.data;    
    
    // Confirma que el motor está listo después de un comando 'isready'    
    if (data === 'readyok') {    
        console.log('✅ Stockfish reporta readyok.');    
        engineReady = true;    
        window.engineReady = true;   
        const coachMessageElem = document.getElementById('coachMessage');    
        if (coachMessageElem) {    
            coachMessageElem.innerHTML = '<strong>✅ Stockfish Real</strong> Motor profesional activado.';    
        }    
        sendStockfishCommand('ucinewgame');  
        if (typeof window.updateUI === 'function') {  
            window.updateUI();   
        }  
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
 * Inicializa el motor Stockfish como un Web Worker.    
 */    
async function initializeStockfishEngine() {    
    try {    
        console.log('⏳ Intentando inicializar Stockfish como Web Worker desde unpkg.com...');  
          
        // Crear un nuevo Web Worker usando la URL del script de Stockfish desde un CDN que permite CORS para Workers  
        engine = new Worker('https://unpkg.com/stockfish.js/src/stockfish.js'); // <--- CAMBIO CLAVE AQUÍ  
          
        engine.onmessage = stockfishMessageListener;    
    
        engine.onerror = (error) => {  
            console.error('Error en el Web Worker de Stockfish:', error);  
            const coachMessageElem = document.getElementById('coachMessage');    
            if (coachMessageElem) {    
                coachMessageElem.innerHTML = '<strong>⚠️ Stockfish No Disponible</strong> Error en el Worker. (Revisa la consola)';    
            }    
            engineReady = false;    
            window.engineReady = false;  
        };  
  
        sendStockfishCommand('uci');    
        sendStockfishCommand('isready');   
          
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
 */    
function sendStockfishCommand(command) {    
    if (!engine) {    
        console.warn('Stockfish Worker no está inicializado para recibir comandos.');    
        return;    
    }    
    engine.postMessage(command);    
}    
    
// ===================== EVALUAR CON STOCKFISH REAL =====================    
    
function evaluateWithStockfish(depth = 20, customTimeout = 5000) {    
    return new Promise((resolve) => {    
        if (!engineReady || !engine) {    
            console.warn('Stockfish no está listo para evaluar.');  
            resolve({ score: 0, bestMove: null, depth: 0, pv: [] });    
            return;    
        }    
    
        if (stockfishIsProcessing) {    
            console.warn("Stockfish ya está procesando un comando 'go'. Ignorando nueva solicitud.");    
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
            engine.onmessage = stockfishMessageListener;    
            resolve({ score, bestMove, depth, pv });    
        };    
    
        currentStockfishTimeout = setTimeout(() => {    
            console.warn('Stockfish timeout. Forzando detención y resolución.');    
            sendStockfishCommand('stop');    
            currentStockfishResolve({ bestMove: currentBestMove, score: currentScore, depth: currentDepth, pv: currentPv });    
        }, customTimeout);    
    
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
                stockfishMessageListener(event);  
            }    
        };    
    
        try {    
            sendStockfishCommand('position fen ' + window.game.fen());    
            sendStockfishCommand('go depth ' + depth);    
            stockfishIsProcessing = true;    
        } catch (e) {    
            console.error('Error al enviar comando a Stockfish Worker:', e);    
            clearTimeout(currentStockfishTimeout);    
            engine.onmessage = stockfishMessageListener;    
            currentStockfishResolve({ score: 0, bestMove: null, depth: 0, pv: [] });    
        }    
    });    
}    
    
// ===================== OBTENER MEJOR MOVIMIENTO =====================    
    
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
