// ===================== STOCKFISH - MOTOR REAL LOCAL =====================
let engine = null;
let engineReady = false;
let pendingResolve = null;

// ===================== INICIALIZAR STOCKFISH =====================
function initStockfish() {
    try {
        console.log('Cargando Stockfish desde js/stockfish.js (local)');

        // Crear Worker desde archivo local
        engine = new Worker('js/stockfish.js');

        engine.onmessage = (event) => {
            const msg = event.data || event;
            if (!msg) return;

            // Motor listo
            if (msg === 'uciok') {
                engine.postMessage('isready');
            }

            if (msg === 'readyok') {
                engineReady = true;
                console.log('✅ Stockfish listo y operativo');
                document.getElementById('coachMessage').innerHTML =
                    '<strong>✅ Stockfish Real</strong> Motor profesional Elo 3500+ activado.';
            }

            // Procesar mejor movimiento
            if (pendingResolve && msg.startsWith('bestmove')) {
                const match = msg.match(/bestmove (\S+)/);
                if (match) {
                    const bestMoveStr = match[1];
                    pendingResolve(bestMoveStr);
                    pendingResolve = null;
                }
            }
        };

        // Inicializamos motor con opciones UCI
        engine.postMessage('uci');
        engine.postMessage('setoption name Threads value 4');
        engine.postMessage('setoption name Hash value 128');

        // Timeout de 5 segundos: fallback local si no carga
        setTimeout(() => {
            if (!engineReady) fallbackMode();
        }, 5000);

    } catch (e) {
        console.error('Error inicializando Stockfish:', e);
        fallbackMode();
    }
}

// ===================== FALLBACK LOCAL =====================
function fallbackMode() {
    engineReady = false;
    console.warn('⚠️ Stockfish no disponible, usando evaluación local');
    document.getElementById('coachMessage').innerHTML =
        '<strong>⚠️ Análisis Local</strong> Stockfish no disponible, usando evaluación local.';
}

// ===================== EVALUAR CON STOCKFISH =====================
function evaluateWithStockfish(depth = 20) {
    return new Promise((resolve) => {
        if (!engineReady || !engine) {
            resolve(null);
            return;
        }
        pendingResolve = resolve;
        engine.postMessage('position fen ' + game.fen());
        engine.postMessage('go depth ' + depth);
    });
}

// ===================== OBTENER MEJOR MOVIMIENTO =====================
async function getBestMoveStockfish(depth = 20) {
    const bestMoveStr = await evaluateWithStockfish(depth);

    if (!bestMoveStr) {
        const moves = game.moves({ verbose: true });
        return moves.length > 0 ? moves[0] : null;
    }

    const from = bestMoveStr.substring(0, 2);
    const to = bestMoveStr.substring(2, 4);
    const promotion = bestMoveStr.length > 4 ? bestMoveStr[4] : undefined;

    try {
        const moveObj = game.move({ from, to, promotion });
        if (moveObj) {
            game.undo(); // solo predecimos
            return moveObj;
        }
    } catch (e) {
        console.error('Error procesando movimiento de Stockfish:', e);
    }

    const moves = game.moves({ verbose: true });
    return moves.length > 0 ? moves[0] : null;
}

// ===================== IA JUEGA CON STOCKFISH =====================
async function makeAIMove() {
    if (game.game_over()) {
        aiThinking = false;
        return;
    }

    const difficulty = parseInt(document.getElementById('difficulty').value);
    const depthMap = { 1: 6, 2: 12, 3: 18, 4: 24, 5: 30 };
    const depth = depthMap[difficulty] || 18;

    aiThinking = true;
    console.log('IA buscando movimiento a profundidad', depth);

    const move = await getBestMoveStockfish(depth);

    if (move) {
        game.move(move);
        lastFromSquare = move.from;
        lastToSquare = move.to;
        moveCount++;
        console.log('IA jugó:', move.san);
    } else {
        console.warn('No se encontró movimiento válido');
    }

    updateUI();
    aiThinking = false;

    if (game.game_over()) showGameOver();
}

// ===================== PISTAS =====================
async function requestHint() {
    if (game.game_over() || aiThinking) return;

    const move = await getBestMoveStockfish(30);
    if (move) {
        selectedSquare = move.from;
        highlights = [move.to];
        renderBoard();

        const coachMsg = document.getElementById('coachMessage');
        coachMsg.innerHTML = '<strong>💡 Pista:</strong> ' + move.san;
        coachMsg.className = 'coach-message good';
    }
}
