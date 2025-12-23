// ===================== STOCKFISH AI =====================
let stockfish = null;
let stockfishReady = false;
let currentEval = 0;
let currentBestMove = null;
let pendingCallback = null;

// ===================== INICIALIZAR STOCKFISH =====================
function initStockfish() {
    console.log('🔄 Iniciando Stockfish...');

    try {
        // Crear Worker desde tu servidor
        stockfish = new Worker('js/stockfish.js');

        let uciOkReceived = false;

        stockfish.onmessage = function(event) {
            const line = event.data;
            console.log('[SF]', line);

            if (line === 'uciok') {
                uciOkReceived = true;
                stockfishReady = true;
                console.log('✅ Stockfish UCI iniciado correctamente');
                const coach = document.getElementById('coachMessage');
                if (coach) {
                    coach.innerHTML = '<strong>✅ Stockfish Local</strong> Motor profesional activado.';
                }
            }

            if (line.includes('info depth')) {
                const scoreMatch = line.match(/score (cp|mate) (-?\d+)/);
                if (scoreMatch) {
                    const type = scoreMatch[1];
                    const val = parseInt(scoreMatch[2]);
                    currentEval = (type === 'cp') ? val / 100 : (val > 0 ? 999 : -999);
                }

                const pvMatch = line.match(/pv (\S+)/);
                if (pvMatch) currentBestMove = pvMatch[1];
            }

            if (line.startsWith('bestmove')) {
                const parts = line.split(' ');
                const bestMove = parts[1];
                currentBestMove = bestMove;

                if (pendingCallback) {
                    const cb = pendingCallback;
                    pendingCallback = null;
                    setTimeout(() => cb(bestMove, currentEval), 1500);
                }
            }
        };

        stockfish.onerror = (error) => {
            console.error('❌ Error Stockfish Worker:', error);
            stockfishReady = false;
            const coach = document.getElementById('coachMessage');
            if (coach) {
                coach.innerHTML = '<strong>❌ Error Stockfish Local</strong>';
            }
        };

        // Enviar comando UCI
        stockfish.postMessage('uci');

        // Timeout: si no responde en 10s
        setTimeout(() => {
            if (!uciOkReceived) {
                console.warn('⏱️ Timeout esperando respuesta UCI');
                stockfishReady = false;
                const coach = document.getElementById('coachMessage');
                if (coach) {
                    coach.innerHTML = '<strong>⚠️ Stockfish lento</strong>';
                }
            }
        }, 10000);

    } catch (error) {
        console.error('❌ Error inicializando Stockfish:', error);
        stockfishReady = false;
    }
}

// ===================== OBTENER MEJOR MOVIMIENTO =====================
function getBestMove(fen, depth, callback) {
    if (!stockfishReady) {
        console.warn('⚠️ Stockfish no disponible, usando fallback');
        setTimeout(() => {
            const moves = game.moves({ verbose: true });
            const randomMove = moves[Math.floor(Math.random() * Math.min(5, moves.length))];
            callback(randomMove ? randomMove.from + randomMove.to : null, 0);
        }, 500);
        return;
    }

    pendingCallback = callback;
    stockfish.postMessage(`position fen ${fen}`);
    stockfish.postMessage(`go depth ${depth}`);
}

// ===================== EVALUACIÓN DE POSICIÓN =====================
function evaluatePosition() {
    if (!stockfishReady) {
        const board = game.board();
        let score = 0;
        const values = { 'p': 1, 'n': 3, 'b': 3.25, 'r': 5, 'q': 9 };
        for (let row of board) {
            for (let piece of row) {
                if (!piece) continue;
                score += piece.color === 'w' ? (values[piece.type] || 0) : -(values[piece.type] || 0);
            }
        }
        return score;
    }
    return currentEval;
}
