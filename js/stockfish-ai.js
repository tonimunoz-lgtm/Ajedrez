// ===================== STOCKFISH AI - VERSIÓN LOCAL =====================
let stockfish = null;
let stockfishReady = false;
let currentEval = 0;
let currentBestMove = null;
let pendingCallback = null;

// ===================== INICIALIZAR STOCKFISH =====================
function initStockfish() {
    console.log('🔄 Iniciando Stockfish...');

    try {
        // Crear Worker apuntando a tu stockfish.js local
        stockfish = new Worker('js/stockfish.js');

        let uciOkReceived = false;

        stockfish.onmessage = function(event) {
            const line = event.data;
            console.log('[SF]', line);

            // Stockfish listo
            if (line === 'uciok') {
                uciOkReceived = true;
                stockfishReady = true;
                console.log('✅ Stockfish listo');
                const coachMsg = document.getElementById('coachMessage');
                if (coachMsg) {
                    coachMsg.innerHTML = '<strong>✅ Stockfish IA</strong> Motor profesional activado.';
                }
            }

            // Evaluación en tiempo real
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

            // Mejor movimiento final
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
            const coachMsg = document.getElementById('coachMessage');
            if (coachMsg) {
                coachMsg.innerHTML = '<strong>❌ Stockfish error</strong>';
            }
        };

        // Enviar comandos iniciales
        stockfish.postMessage('uci');

        // Timeout de 10s
        setTimeout(() => {
            if (!uciOkReceived) {
                console.warn('⏱️ Stockfish no respondió a tiempo');
                stockfishReady = false;
            }
        }, 10000);

    } catch (error) {
        console.error('❌ Error iniciando Stockfish:', error);
        stockfishReady = false;
    }
}

// ===================== OBTENER MEJOR MOVIMIENTO =====================
function getBestMove(fen, depth, callback) {
    if (!stockfishReady) {
        console.warn('⚠️ Stockfish no disponible, usando fallback local');
        setTimeout(() => {
            const moves = game.moves({ verbose: true });
            const randomMove = moves[Math.floor(Math.random() * Math.min(5, moves.length))];
            if (randomMove) callback(randomMove.from + randomMove.to, evaluatePosition());
            else callback(null, 0);
        }, 500);
        return;
    }

    pendingCallback = callback;

    try {
        stockfish.postMessage(`position fen ${fen}`);
        stockfish.postMessage(`go depth ${depth}`);
    } catch (error) {
        console.error('❌ Error enviando a Stockfish:', error);
        pendingCallback = null;
        callback(null, 0);
    }
}

// ===================== EVALUACIÓN =====================
function evaluatePosition() {
    if (!stockfishReady) {
        let score = 0;
        const board = game.board();
        const values = { 'p': 1, 'n': 3, 'b': 3.25, 'r': 5, 'q': 9 };
        for (let row of board) {
            for (let piece of row) {
                if (!piece) continue;
                const val = values[piece.type] || 0;
                score += piece.color === 'w' ? val : -val;
            }
        }
        return score;
    }
    return currentEval;
}

// ===================== PROBABILIDADES =====================
function calculateWinProbability() {
    const score = evaluatePosition();
    const sigmoid = x => 1 / (1 + Math.exp(-x / 150));

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

// ===================== JUGADA IA =====================
function makeAIMove() {
    if (game.game_over()) return;
    const difficulty = parseInt(document.getElementById('difficulty').value);
    const depthMap = { 1: 6, 2: 12, 3: 18, 4: 24, 5: 30 };
    const depth = depthMap[difficulty] || 18;
    aiThinking = true;

    const fen = game.fen();
    getBestMove(fen, depth, (bestMove, evalScore) => {
        if (!bestMove || bestMove === '(none)') {
            const moves = game.moves({ verbose: true });
            if (moves.length === 0) {
                aiThinking = false;
                return;
            }
            const move = moves[Math.floor(Math.random() * moves.length)];
            game.move(move);
        } else {
            const from = bestMove.substring(0, 2);
            const to = bestMove.substring(2, 4);
            const promotion = bestMove.length > 4 ? bestMove[4] : 'q';
            game.move({ from, to, promotion });
        }

        aiThinking = false;
        updateUI();
    });
}

// ===================== PISTA =====================
function requestHint() {
    if (game.game_over() || aiThinking) return;

    const difficulty = parseInt(document.getElementById('difficulty').value);
    const depthMap = { 1: 8, 2: 14, 3: 20, 4: 26, 5: 32 };
    const depth = depthMap[difficulty] || 20;

    getBestMove(game.fen(), depth, (bestMove, evalScore) => {
        if (!bestMove || bestMove === '(none)') return;
        selectedSquare = bestMove.substring(0, 2);
        highlights = [bestMove.substring(2, 4)];
        renderBoard();

        const coachMsg = document.getElementById('coachMessage');
        if (coachMsg) coachMsg.innerHTML = `<strong>💡 Pista:</strong> ${bestMove.toUpperCase()} (eval: ${evalScore.toFixed(2)})`;
    });
}

// ===================== ANÁLISIS DETALLADO =====================
function performAnalysis() {
    const difficulty = parseInt(document.getElementById('difficulty').value);
    const depthMap = { 1: 10, 2: 16, 3: 22, 4: 28, 5: 35 };
    const depth = depthMap[difficulty] || 22;

    const fen = game.fen();
    document.getElementById('analysisLoading').style.display = 'inline-block';
    document.getElementById('analysisStatus').textContent = 'Analizando con Stockfish...';

    getBestMove(fen, depth, (bestMove, evalScore) => {
        const prob = calculateWinProbability();
        const board = game.board();
        let material = 0;
        const values = { 'p': 1, 'n': 3, 'b': 3.25, 'r': 5, 'q': 9 };
        for (let row of board) {
            for (let p of row) {
                if (!p) continue;
                material += p.color === 'w' ? (values[p.type] || 0) : -(values[p.type] || 0);
            }
        }

        const history = game.history({ verbose: true });
        const phase = history.length < 10 ? 'Apertura' :
                      history.length < 40 ? 'Medio Juego' : 'Final';

        document.getElementById('whiteWinProb').textContent = prob.white + '%';
        document.getElementById('drawProb').textContent = prob.draw + '%';
        document.getElementById('blackWinProb').textContent = prob.black + '%';
        document.getElementById('anyWinProb').textContent = prob.decisive + '%';
        document.getElementById('currentScore').textContent = evalScore.toFixed(2);
        document.getElementById('analysisDepth').textContent = depth;
        document.getElementById('bestMoveAnalysis').textContent = bestMove || '-';
        document.getElementById('materialEval').textContent = material.toFixed(2);
        document.getElementById('openingEval').textContent = phase === 'Apertura' ? evalScore.toFixed(2) : '-';
        document.getElementById('middlegameEval').textContent = phase === 'Medio Juego' ? evalScore.toFixed(2) : '-';
        document.getElementById('endgameEval').textContent = phase === 'Final' ? evalScore.toFixed(2) : '-';
        document.getElementById('principalVariation').textContent = bestMove || '-';
        document.getElementById('analysisStatus').textContent = '✅ Análisis completado';
        document.getElementById('analysisLoading').style.display = 'none';
    });
}
