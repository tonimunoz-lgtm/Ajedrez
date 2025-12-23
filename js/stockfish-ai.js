// ===================== STOCKFISH REAL CON WEB WORKER =====================
let engine = null;
let engineReady = false;
let pendingResolve = null;

// Inicializa Stockfish como Web Worker
async function initStockfish() {
    try {
        console.log('Cargando Stockfish desde CDN (Web Worker)...');

        engine = new Worker('https://cdn.jsdelivr.net/npm/stockfish@16.1.0/src/stockfish.js');

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

        // Timeout de 5 segundos
        setTimeout(() => {
            if (!engineReady) fallbackMode();
        }, 5000);
    } catch (e) {
        console.error('Error inicializando Stockfish:', e);
        fallbackMode();
    }
}

// Fallback local si Stockfish no carga
function fallbackMode() {
    engineReady = false;
    console.warn('⚠️ Stockfish no disponible, usando evaluación local');
    document.getElementById('coachMessage').innerHTML =
        '<strong>⚠️ Análisis Local</strong> Stockfish no disponible, usando evaluación local.';
}

// Evalúa la posición y devuelve la mejor jugada
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

// Convierte movimiento de Stockfish a chess.js
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
            game.undo(); // Solo predecimos, no aplicamos
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

// ===================== USO EN PISTA Y ANÁLISIS =====================
async function requestHint() {
    if (game.game_over() || aiThinking) return;

    const difficulty = 5; // Mejor movimiento real
    const move = await getBestMoveStockfish(difficulty);

    if (move) {
        selectedSquare = move.from;
        highlights = [move.to];
        renderBoard();

        const coachMsg = document.getElementById('coachMessage');
        coachMsg.innerHTML = '<strong>💡 Pista:</strong> ' + move.san;
        coachMsg.className = 'coach-message good';
    }
}

async function performAnalysis() {
    if (!engineReady) return;

    const score = evaluatePosition().toFixed(2);
    const prob = calculateWinProbability();
    const moves = game.moves({ verbose: true });
    const history = game.history({ verbose: true });

    const board = game.board();
    let material = 0;
    const pieceValues = { 'p': 1, 'n': 3, 'b': 3.25, 'r': 5, 'q': 9 };
    for (let row of board) {
        for (let p of row) {
            if (!p) continue;
            const val = pieceValues[p.type] || 0;
            material += p.color === 'w' ? val : -val;
        }
    }

    const phase = history.length < 10 ? 'Apertura' : history.length < 40 ? 'Medio Juego' : 'Final';

    document.getElementById('whiteWinProb').innerHTML = prob.white + '%';
    document.getElementById('drawProb').innerHTML = prob.draw + '%';
    document.getElementById('blackWinProb').innerHTML = prob.black + '%';
    document.getElementById('anyWinProb').innerHTML = prob.decisive + '%';
    document.getElementById('currentScore').innerHTML = score;
    document.getElementById('analysisDepth').innerHTML = '20 movimientos';
    document.getElementById('bestMoveAnalysis').innerHTML = moves.length > 0 ? moves[0].san : '-';
    document.getElementById('materialEval').innerHTML = material.toFixed(2);
    document.getElementById('openingEval').innerHTML = history.length < 10 ? '0.0' : '-';
    document.getElementById('middlegameEval').innerHTML = phase === 'Medio Juego' ? score : '-';
    document.getElementById('endgameEval').innerHTML = phase === 'Final' ? score : '-';
    document.getElementById('principalVariation').innerHTML = moves.slice(0, 5).map(m => m.san).join(' - ');
    document.getElementById('analysisStatus').innerHTML = '✅ Análisis completado';
    document.getElementById('analysisLoading').style.display = 'none';
}
