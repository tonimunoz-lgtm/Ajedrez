// ===================== STOCKFISH AI =====================

let stockfish = null;
let stockfishReady = false;
let stockfishQueue = [];
let currentEval = 0;    // Evaluación actual en centipawns
let currentBestMove = null;
let currentDepth = 0;

// Inicializa Stockfish
function initStockfish() {
    stockfish = new Worker('https://cdn.jsdelivr.net/npm/stockfish@15.1/stockfish.js');

    stockfish.onmessage = function(event) {
        const line = event.data;
        // console.log('Stockfish:', line);

        if (line === 'uciok') {
            stockfishReady = true;
        }

        // Leer evaluación de posición
        if (line.startsWith('info depth')) {
            const scoreMatch = line.match(/score (cp|mate) (-?\d+)/);
            if (scoreMatch) {
                const type = scoreMatch[1];
                const val = parseInt(scoreMatch[2]);
                if (type === 'cp') currentEval = val / 100;          // centipawns a unidades de peón
                if (type === 'mate') currentEval = val > 0 ? 1000 : -1000; // mates muy grandes
            }
            const depthMatch = line.match(/depth (\d+)/);
            if (depthMatch) currentDepth = parseInt(depthMatch[1]);
        }

        // Mejor movimiento
        if (line.startsWith('bestmove')) {
            const parts = line.split(' ');
            const bestMove = parts[1];
            currentBestMove = bestMove;

            if (stockfishQueue.length > 0) {
                const callback = stockfishQueue.shift();
                callback(bestMove, currentEval, currentDepth);
            }
        }
    };

    stockfish.postMessage('uci');
}

// Pide el mejor movimiento para la posición actual
function getBestMove(fen, depth = 15, callback) {
    if (!stockfishReady) {
        console.error('Stockfish no está listo aún');
        return;
    }

    stockfishQueue.push(callback);
    stockfish.postMessage(`position fen ${fen}`);
    stockfish.postMessage(`go depth ${depth}`);
}

// Ejecuta la jugada de la IA
function makeAIMove() {
    if (game.game_over()) return;

    const fen = game.fen();
    const difficulty = parseInt(document.getElementById('difficulty').value);
    const depth = 10 + difficulty * 2; // Ajusta profundidad según nivel

    aiThinking = true;

    getBestMove(fen, depth, (bestMove, evalScore, depth) => {
        if (!bestMove || bestMove === '(none)') {
            aiThinking = false;
            return;
        }

        const move = game.move({ from: bestMove.substring(0,2), to: bestMove.substring(2,4), promotion: 'q' });
        if (move) {
            lastFromSquare = move.from;
            lastToSquare = move.to;
            moveCount++;
            lastEval = evalScore; // Actualiza evaluación real
            evaluateMoveQuality(move);
        }

        aiThinking = false;
        updateUI();
    });
}

// ===================== FUNCIONES DE EVALUACIÓN =====================

// Devuelve la evaluación actual de la posición según Stockfish
function evaluatePosition() {
    return currentEval;  // ya está en unidades de peón
}

// Devuelve las probabilidades de victoria basadas en la evaluación de Stockfish
function calculateWinProbability() {
    const score = currentEval;
    const sigmoid = (x) => 1 / (1 + Math.exp(-x / 1.5)); // ajustar escala
    const whiteWin = sigmoid(score) * 0.85;
    const blackWin = sigmoid(-score) * 0.85;
    const draw = 1 - whiteWin - blackWin;

    return {
        white: Math.round(whiteWin * 100),
        black: Math.round(blackWin * 100),
        draw: Math.round(draw * 100),
        decisive: Math.round((whiteWin + blackWin) * 100)
    };
}
