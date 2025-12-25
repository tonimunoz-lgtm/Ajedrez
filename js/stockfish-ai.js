// js/stockfish-ai.js - STOCKFISH REAL CON HEADERS HABILITADOS

let engine = null;  
let engineReady = false;
let currentStockfishResolve = null;
let currentStockfishTimeout = null;
let stockfishIsProcessing = false;

/**  
 * Inicializa Stockfish real
 */  
async function initializeStockfishEngine() {  
    try {
        console.log('Inicializando Stockfish WASM real...');
        
        if (!window.StockfishMv) {
            throw new Error('StockfishMv no disponible');
        }
        
        // StockfishMv es la instancia ya cargada por stockfish.js
        engine = window.StockfishMv;
        
        if (!engine) {
            throw new Error('engine no se pudo obtener');
        }

        console.log('✅ Motor Stockfish obtenido:', typeof engine);

        // Registrar listener para mensajes
        if (typeof engine.addMessageListener === 'function') {
            engine.addMessageListener(handleStockfishMessage);
            console.log('✅ Message listener añadido');
        }

        engineReady = true;
        window.engineReady = true;

        console.log('✅ Stockfish WASM cargado y listo.');

        const coachMessageElem = document.getElementById('coachMessage');
        if (coachMessageElem) {
            coachMessageElem.innerHTML = '<strong>✅ Stockfish Real</strong> Motor profesional activado.';
        }

        // Enviar comandos iniciales
        sendStockfishCommand('uci');
        sendStockfishCommand('isready');
        sendStockfishCommand('ucinewgame');

    } catch (e) {
        console.error('❌ Error inicializando Stockfish:', e);
        engineReady = false;
        window.engineReady = false;

        const coachMessageElem = document.getElementById('coachMessage');
        if (coachMessageElem) {
            coachMessageElem.innerHTML = '<strong>⚠️ Stockfish Error</strong> ' + e.message;
        }
    }
}

/**
 * Handler para mensajes de Stockfish
 */
function handleStockfishMessage(message) {
    const data = typeof message === 'string' ? message : message;
    
    if (data === 'readyok') {
        console.log('✅ Stockfish readyok');
    } else if (data.startsWith('bestmove')) {
        if (currentStockfishResolve) {
            const match = data.match(/bestmove (\S+)/);
            const bestMove = match ? match[1] : null;
            currentStockfishResolve({ bestMove: bestMove });
            currentStockfishResolve = null;
        }
    }
}

/**  
 * Envía comando a Stockfish
 */  
function sendStockfishCommand(command) {  
    if (!engine || !engineReady) {
        console.warn('Stockfish no está listo');
        return;
    }
    
    if (typeof engine.postMessage === 'function') {
        console.log('→ Enviando:', command);
        engine.postMessage(command);
    } else {
        console.warn('postMessage no disponible');
    }
}

// ===================== EVALUAR CON STOCKFISH =====================  

/**  
 * Evalúa una posición
 */  
function evaluateWithStockfish(depth = 20, customTimeout = 5000) {  
    return new Promise((resolve) => {
        if (!engineReady || !engine) {
            console.warn('Stockfish no listo');
            resolve({ score: 0, bestMove: null, depth: 0, pv: [] });
            return;
        }

        if (stockfishIsProcessing) {
            console.warn("Ya está procesando");
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
            console.warn('Timeout - deteniendo análisis');
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
            console.error('Error enviando comandos:', e);
            clearTimeout(currentStockfishTimeout);
            engine.onmessage = originalOnMessage;
            currentStockfishResolve({ score: 0, bestMove: null, depth: 0, pv: [] });
        }
    });
}

// ===================== OBTENER MEJOR MOVIMIENTO =====================  

async function getBestMoveStockfish(depth = 20) {  
    const result = await evaluateWithStockfish(depth, 3000);

    if (!result.bestMove) {
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

    console.warn('Movimiento no válido:', result.bestMove);
    const moves = window.game.moves({ verbose: true });
    return moves.length > 0 ? moves[Math.floor(Math.random() * moves.length)] : null;
}

// ===================== IA JUEGA =====================  

async function makeAIMove() {  
    if (window.game.game_over()) {
        return null;
    }

    const difficultyElem = document.getElementById('difficulty');
    const difficulty = difficultyElem ? parseInt(difficultyElem.value) : 3;

    const depthMap = { 1: 6, 2: 10, 3: 14, 4: 18, 5: 22 };
    const depth = depthMap[difficulty] || 14;

    console.log(`IA (profundidad ${depth})`);
    return await getBestMoveStockfish(depth);
}

// ===================== ACTUALIZAR INTERFAZ =====================  

async function updateEvaluationDisplay() {  
    if (!window.game || typeof window.game.fen !== 'function') {
        return;
    }

    try {
        const result = await evaluateWithStockfish(12, 2000);

        const elements = {
            'currentScoreDisplay': (result.score / 100).toFixed(2),
            'currentDepthDisplay': result.depth,
            'currentPVDisplay': result.pv && result.pv.length > 0 ? result.pv.slice(0, 5).join(' ') : 'N/A',
            'bestMoveSuggestionDisplay': result.bestMove || 'N/A',
            'evalScore': (result.score / 100).toFixed(1)
        };

        for (const [id, value] of Object.entries(elements)) {
            const elem = document.getElementById(id);
            if (elem) elem.textContent = value;
        }

        if (typeof window.updateEvalBar === 'function') {
            window.updateEvalBar(result.score);
        }
    } catch (e) {
        console.warn('Error en evaluación:', e);
    }
}

// ===================== EXPORTAR =====================  
window.initializeStockfishEngine = initializeStockfishEngine;
window.getBestMoveStockfish = getBestMoveStockfish;
window.makeAIMove = makeAIMove;
window.evaluateWithStockfish = evaluateWithStockfish;
window.updateEvaluationDisplay = updateEvaluationDisplay;
window.engineReady = engineReady;
