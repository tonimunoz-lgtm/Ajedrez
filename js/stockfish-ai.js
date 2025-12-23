// ===================== STOCKFISH AI OPTIMIZADO =====================

let stockfish = null;
let stockfishReady = false;
let stockfishQueue = [];
let fenCache = {}; // Cache de FEN => { bestMove, evalScore, depth }
let currentEval = 0;
let currentBestMove = null;
let currentDepth = 0;

// Inicializa Stockfish en el navegador
function initStockfish() {
    stockfish = new Worker('https://cdn.jsdelivr.net/npm/stockfish@15.1/stockfish.js');

    stockfish.onmessage = function(event) {
        const line = event.data;

        if (line === 'uciok') {
            stockfishReady = true;
        }

        // Info de evaluación
        if (line.startsWith('info depth')) {
            const scoreMatch = line.match(/score (cp|mate) (-?\d+)/);
            if (scoreMatch) {
                const type = scoreMatch[1];
                const val = parseInt(scoreMatch[2]);
                currentEval = (type === 'cp') ? val / 100 : (val > 0 ? 1000 : -1000);
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
                const fen = callback.fen;
                fenCache[fen] = { bestMove, evalScore: currentEval, depth: currentDepth };
                callback(bestMove, currentEval, currentDepth);
            }
        }
    };

    stockfish.postMessage('uci');
}

// ===================== FUNCIONES PRINCIPALES =====================

// Obtener mejor movimiento desde FEN con cache
function getBestMove(fen, depth = 15, callback) {
    if (!stockfishReady) {
        console.error('Stockfish no está listo aún');
        return;
    }

    // Revisar cache
    if (fenCache[fen]) {
        const data = fenCache[fen];
        callback(data.bestMove, data.evalScore, data.depth);
        return;
    }

    // Enviar a Stockfish
    const wrappedCallback = callback;
    wrappedCallback.fen = fen; // asociar FEN para cache
    stockfishQueue.push(wrappedCallback);
    stockfish.postMessage(`position fen ${fen}`);
    stockfish.postMessage(`go depth ${depth}`);
}

// Ejecuta la jugada de la IA
function makeAIMove() {
    if (game.game_over()) return;

    const fen = game.fen();
    const difficulty = parseInt(document.getElementById('difficulty').value);
    const depth = 10 + difficulty * 2;

    aiThinking = true;

    getBestMove(fen, depth, (bestMove, evalScore) => {
        if (!bestMove || bestMove === '(none)') {
            aiThinking = false;
            return;
        }

        const move = game.move({ from: bestMove.substring(0,2), to: bestMove.substring(2,4), promotion: 'q' });
        if (move) {
            lastFromSquare = move.from;
            lastToSquare = move.to;
            moveCount++;
            lastEval = evalScore;
            evaluateMoveQuality(move, evalScore);
        }

        aiThinking = false;
        updateUI();
    });
}

// ===================== EVALUACIÓN Y PROBABILIDADES =====================

function evaluatePosition() {
    return currentEval;
}

function calculateWinProbability() {
    const score = currentEval;
    const sigmoid = (x) => 1 / (1 + Math.exp(-x / 1.5));
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

// ===================== HINTS =====================

function requestHint() {
    if (game.game_over() || aiThinking || !stockfishReady) return;

    const fen = game.fen();
    const difficulty = parseInt(document.getElementById('difficulty').value);
    const depth = 10 + difficulty * 2;

    aiThinking = true;

    getBestMove(fen, depth, (bestMove, evalScore) => {
        aiThinking = false;

        if (!bestMove || bestMove === '(none)') return;

        selectedSquare = bestMove.substring(0,2);
        highlights = [bestMove.substring(2,4)];
        renderBoard();

        const coachMsg = document.getElementById('coachMessage');
        coachMsg.innerHTML = `<strong>💡 Pista:</strong> ${bestMove} (eval: ${evalScore.toFixed(2)})`;
        coachMsg.className = 'coach-message good';
    });
}

// ===================== ANÁLISIS PROFESIONAL =====================

function performAnalysis() {
    if (!stockfishReady) return;

    const fen = game.fen();
    const difficulty = parseInt(document.getElementById('difficulty').value);
    const depth = 15 + difficulty * 2;

    document.getElementById('analysisLoading').style.display = 'inline-block';
    document.getElementById('analysisStatus').innerHTML = 'Analizando posición...';

    getBestMove(fen, depth, (bestMove, evalScore, depth) => {
        const prob = calculateWinProbability();
        const history = game.history({ verbose: true });
        const board = game.board();
        let material = 0;
        const pieceValues = { 'p': 1, 'n': 3, 'b': 3.25, 'r': 5, 'q': 9 };

        for (let row of board) {
            for (let p of row) {
                if (!p) continue;
                material += p.color === 'w' ? pieceValues[p.type] || 0 : -(pieceValues[p.type] || 0);
            }
        }

        const phase = history.length < 10 ? 'Apertura' : history.length < 40 ? 'Medio Juego' : 'Final';

        document.getElementById('whiteWinProb').innerHTML = prob.white + '%';
        document.getElementById('drawProb').innerHTML = prob.draw + '%';
        document.getElementById('blackWinProb').innerHTML = prob.black + '%';
        document.getElementById('anyWinProb').innerHTML = prob.decisive + '%';
        document.getElementById('currentScore').innerHTML = evalScore.toFixed(2);
        document.getElementById('analysisDepth').innerHTML = depth;
        document.getElementById('bestMoveAnalysis').innerHTML = bestMove;
        document.getElementById('materialEval').innerHTML = material.toFixed(2);
        document.getElementById('openingEval').innerHTML = phase === 'Apertura' ? evalScore.toFixed(2) : '-';
        document.getElementById('middlegameEval').innerHTML = phase === 'Medio Juego' ? evalScore.toFixed(2) : '-';
        document.getElementById('endgameEval').innerHTML = phase === 'Final' ? evalScore.toFixed(2) : '-';
        document.getElementById('principalVariation').innerHTML = bestMove;
        document.getElementById('analysisStatus').innerHTML = '✅ Análisis completado';
        document.getElementById('analysisLoading').style.display = 'none';
    });
}

// ===================== EVALUAR MOVIMIENTO DEL JUGADOR =====================

function evaluateMoveQuality(move, currentEvalScore = null) {
    const evalScore = currentEvalScore !== null ? currentEvalScore : evaluatePosition();
    const fenBefore = game.fen();

    if (fenCache[fenBefore]) {
        const bestEval = fenCache[fenBefore].evalScore;
        const moveEvalDiff = evalScore - bestEval;
        classifyMove(moveEvalDiff);
        return;
    }

    // Si no está en cache, obtener de Stockfish
    getBestMove(fenBefore, 15, (bestMove, bestEval) => {
        const moveEvalDiff = evalScore - bestEval;
        classifyMove(moveEvalDiff);
    });
}

// Clasifica y da feedback
function classifyMove(diff) {
    let quality = 'good';

    if (diff >= -0.1) quality = 'excellent';
    else if (diff >= -0.5) quality = 'good';
    else if (diff >= -1.5) quality = 'mistake';
    else quality = 'blunder';

    if (quality === 'excellent' || quality === 'good') goodMoves++;
    if (quality === 'mistake' || quality === 'blunder') badMoves++;

    giveCoachFeedback(quality);
    lastEval = currentEval;
    updateUI();
}
