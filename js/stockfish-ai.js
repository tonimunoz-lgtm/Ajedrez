// ===================== STOCKFISH AI =====================

let stockfish = null;
let stockfishReady = false;
let stockfishQueue = [];
let currentBestMove = null;

// Inicializa Stockfish
function initStockfish() {
    stockfish = new Worker('https://cdn.jsdelivr.net/npm/stockfish@15.1/stockfish.js');

    stockfish.onmessage = function(event) {
        const line = event.data;
        // console.log('Stockfish:', line);

        if (line === 'uciok') {
            stockfishReady = true;
        }

        if (line.startsWith('bestmove')) {
            const parts = line.split(' ');
            const bestMove = parts[1];
            currentBestMove = bestMove;

            if (stockfishQueue.length > 0) {
                const callback = stockfishQueue.shift();
                callback(bestMove);
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

    getBestMove(fen, depth, (bestMove) => {
        if (!bestMove || bestMove === '(none)') {
            aiThinking = false;
            return;
        }

        const move = game.move({ from: bestMove.substring(0,2), to: bestMove.substring(2,4), promotion: 'q' });
        if (move) {
            lastFromSquare = move.from;
            lastToSquare = move.to;
            moveCount++;
            evaluateMoveQuality(move);
        }

        aiThinking = false;
        updateUI();
    });
}
