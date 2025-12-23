// ===================== STOCKFISH - MOTOR REAL =====================
let engine = null;
let engineReady = false;

async function initStockfish() {
    try {
        // Intenta cargar Stockfish desde CDN
        const wasmModule = await Stockfish();
        engine = wasmModule;
        engineReady = true;
        console.log('✅ Stockfish WASM cargado correctamente');
        document.getElementById('coachMessage').innerHTML = '<strong>✅ Stockfish Real</strong> Motor profesional activado.';
    } catch (e) {
        console.error('Error cargando Stockfish:', e);
        engineReady = false;
        document.getElementById('coachMessage').innerHTML = '<strong>⚠️ Stockfish No Disponible</strong> Usando análisis local.';
    }
}

// ===================== EVALUAR CON STOCKFISH REAL =====================
function evaluateWithStockfish(depth = 20) {
    return new Promise((resolve) => {
        if (!engineReady || !engine) {
            // Fallback si Stockfish no está disponible
            resolve({ score: 0, bestMove: null, depth: 0 });
            return;
        }

        let bestMove = null;
        let score = 0;
        let depthReached = 0;
        let isResolved = false;

        const timeout = setTimeout(() => {
            if (!isResolved) {
                isResolved = true;
                resolve({ score, bestMove, depth: depthReached });
            }
        }, 2000);

        const onMessage = (message) => {
            if (isResolved) return;

            if (message.includes('bestmove')) {
                isResolved = true;
                clearTimeout(timeout);
                const match = message.match(/bestmove (\S+)/);
                if (match) bestMove = match[1];
                resolve({ score, bestMove, depth: depthReached });
            }

            if (message.includes('score cp')) {
                const m = message.match(/score cp (-?\d+)/);
                if (m) score = parseInt(m[1]) / 100;
            }

            if (message.includes('depth')) {
                const m = message.match(/depth (\d+)/);
                if (m) depthReached = parseInt(m[1]);
            }
        };

        try {
            engine.onmessage = onMessage;
            engine.postMessage('position fen ' + game.fen());
            engine.postMessage('go depth ' + depth);
        } catch (e) {
            if (!isResolved) {
                isResolved = true;
                clearTimeout(timeout);
                resolve({ score: 0, bestMove: null, depth: 0 });
            }
        }
    });
}

// ===================== OBTENER MEJOR MOVIMIENTO (SIN RANDOM) =====================
async function getBestMoveStockfish(depth = 20) {
    const result = await evaluateWithStockfish(depth);
    
    if (!result.bestMove) {
        // Fallback: obtener un movimiento legal aleatorio
        const moves = game.moves({ verbose: true });
        return moves.length > 0 ? moves[0] : null;
    }

    // Convertir notación Stockfish (e.g., "e2e4") a objeto chess.js
    const from = result.bestMove.substring(0, 2);
    const to = result.bestMove.substring(2, 4);
    const promotion = result.bestMove.length > 4 ? result.bestMove[4] : undefined;
    
    const moveObj = game.move({ from, to, promotion });
    if (moveObj) {
        game.undo();
        return moveObj;
    }
    
    return null;
}

// ===================== IA JUEGA CON STOCKFISH =====================
async function makeAIMove() {
    if (game.game_over()) {
        aiThinking = false;
        return;
    }

    const difficulty = parseInt(document.getElementById('difficulty').value);
    
    // Profundidades según dificultad
    const depthMap = {
        1: 6,   // Novato: muy superficial
        2: 12,  // Intermedio: moderado
        3: 18,  // Avanzado: profundo
        4: 24,  // Experto: muy profundo
        5: 30   // Maestro: profundísimo
    };

    const depth = depthMap[difficulty] || 18;
    
    const move = await getBestMoveStockfish(depth);
    
    if (move) {
        game.move(move);
        lastFromSquare = move.from;
        lastToSquare = move.to;
        moveCount++;
    }

    updateUI();
    aiThinking = false;

    if (game.game_over()) {
        showGameOver();
    }
}
