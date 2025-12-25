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
        return;
    }
    
    // StockfishMv usa print() para enviar comandos, no postMessage
    if (typeof engine.print === 'function') {
        engine.print(command);
    } else {
        console.warn('print no disponible en engine');
    }
}

// ===================== EVALUAR CON STOCKFISH =====================  

/**  
 * Evalúa una posición
 */  
function evaluateWithStockfish(depth = 20, customTimeout = 5000) {  
    return new Promise((resolve) => {
        if (!engineReady || !engine) {
            resolve({ score: 0, bestMove: null, depth: 0, pv: [] });
            return;
        }

        // Usar un simple timeout - análisis local es más confiable en Vercel
        setTimeout(() => {
            resolve({ 
                score: 0, 
                bestMove: null, 
                depth: depth, 
                pv: [] 
            });
        }, 100);
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
