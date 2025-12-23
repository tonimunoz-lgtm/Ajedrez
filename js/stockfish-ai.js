// ===================== STOCKFISH - MOTOR REAL DESDE CDN =====================
let engine = null;
let engineReady = false;
let pendingResolve = null;
let pendingBestMove = null;

// Inicializa Stockfish desde CDN
async function initStockfish() {
    try {
        console.log('Cargando Stockfish desde CDN...');

        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/stockfish@16.1.0/src/stockfish.js';

        script.onload = () => {
            console.log('Script Stockfish cargado');
            engine = Stockfish();
            setupEngine();
        };

        script.onerror = () => {
            console.error('Error cargando Stockfish desde CDN');
            fallbackMode();
        };

        document.head.appendChild(script);

        // Timeout de 5 segundos
        setTimeout(() => {
            if (!engineReady) fallbackMode();
        }, 5000);
    } catch (e) {
        console.error('Error en initStockfish:', e);
        fallbackMode();
    }
}

// Configuración del motor y protocolo UCI
function setupEngine() {
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

        // Procesar evaluaciones
        if (pendingResolve && msg.includes('bestmove')) {
            const match = msg.match(/bestmove (\S+)/);
            if (match) {
                const best = match[1];
                pendingResolve(best);
                pendingResolve = null;
            }
        }
    };

    // Inicializar motor
    engine.postMessage('uci');
    engine.postMessage('setoption name Threads value 4');
    engine.postMessage('setoption name Hash value 128');
}

// Fallback local si Stockfish no carga
function fallbackMode() {
    engineReady = false;
    console.warn('⚠️ Stockfish no disponible, usando análisis local');
    document.getElementById('coachMessage').innerHTML =
        '<strong>⚠️ Análisis Local</strong> Stockfish no disponible, usando evaluación local.';
}

// Evalúa la posición y devuelve la mejor jugada de Stockfish
function evaluateWithStockfish(depth = 20) {
    return new Promise(async (resolve) => {
        if (!engineReady || !engine) {
            resolve(null);
            return;
        }

        pendingResolve = resolve;
        engine.postMessage('position fen ' + game.fen());
        engine.postMessage('go depth ' + depth);
    });
}

// Obtiene el mejor movimiento y lo convierte a formato chess.js
async function getBestMoveStockfish(depth = 20) {
    const bestMoveStr = await evaluateWithStockfish(depth);

    if (!bestMoveStr) {
        // Fallback a movimiento legal aleatorio
        const moves = game.moves({ verbose: true });
        return moves.length > 0 ? moves[0] : null;
    }

    const from = bestMoveStr.substring(0, 2);
    const to = bestMoveStr.substring(2, 4);
    const promotion = bestMoveStr.length > 4 ? bestMoveStr[4] : undefined;

    try {
        const moveObj = game.move({ from, to, promotion });
        if (moveObj) {
            game.undo(); // Solo predecimos, no aplicamos todavía
            return moveObj;
        }
    } catch (e) {
        console.error('Error procesando movimiento de Stockfish:', e);
    }

    // Último fallback
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

    // Profundidad según dificultad
    const depthMap = {
        1: 6,   // Novato
        2: 12,  // Intermedio
        3: 18,  // Avanzado
        4: 24,  // Experto
        5: 30   // Maestro
    };

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
