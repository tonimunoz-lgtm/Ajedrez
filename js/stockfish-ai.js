// ===================== STOCKFISH AI - VERSIÓN UNIFICADA =====================
let stockfish = null;
let stockfishReady = false;
let evaluationCache = {};
let currentEval = 0;
let currentBestMove = null;

// ===================== INICIALIZAR STOCKFISH =====================
function initStockfish() {
    try {
        console.log('Inicializando Stockfish desde CDN...');
        
        // Crear Worker para Stockfish
        stockfish = new Worker('https://cdn.jsdelivr.net/npm/stockfish@16.1.0/src/stockfish.js');
        
        let initComplete = false;
        
        stockfish.onmessage = function(event) {
            const line = event.data;
            
            // Stockfish listo
            if (line === 'uciok') {
                stockfishReady = true;
                initComplete = true;
                console.log('✅ Stockfish REAL cargado y listo');
                document.getElementById('coachMessage').innerHTML = 
                    '<strong>✅ Stockfish Real</strong> Motor profesional Elo 3500+ activado.';
            }
            
            // Evaluación en tiempo real
            if (line.includes('info depth')) {
                const scoreMatch = line.match(/score (cp|mate) (-?\d+)/);
                if (scoreMatch) {
                    const type = scoreMatch[1];
                    const val = parseInt(scoreMatch[2]);
                    currentEval = (type === 'cp') ? val / 100 : (val > 0 ? 999 : -999);
                }
            }
            
            // Mejor movimiento encontrado
            if (line.startsWith('bestmove')) {
                const parts = line.split(' ');
                currentBestMove = parts[1] || null;
                
                // Ejecutar callback si existe
                if (window.stockfishCallback) {
                    window.stockfishCallback(currentBestMove, currentEval);
                    window.stockfishCallback = null;
                }
            }
        };
        
        stockfish.onerror = (error) => {
            console.error('Error en Stockfish Worker:', error);
            stockfishReady = false;
            document.getElementById('coachMessage').innerHTML = 
                '<strong>⚠️ Error en Stockfish</strong> Usando análisis local.';
        };
        
        // Iniciar protocolo UCI
        stockfish.postMessage('uci');
        
        // Timeout: si en 5 segundos no inicia, marcar como no disponible
        setTimeout(() => {
            if (!initComplete) {
                console.warn('Timeout inicializando Stockfish');
                stockfishReady = false;
            }
        }, 5000);
        
    } catch (error) {
        console.error('Error creando Stockfish Worker:', error);
        stockfishReady = false;
        document.getElementById('coachMessage').innerHTML = 
            '<strong>⚠️ Stockfish No Disponible</strong> Usando análisis local.';
    }
}

// ===================== OBTENER EVALUACIÓN Y MEJOR MOVIMIENTO =====================
function getBestMove(fen, depth, callback) {
    if (!stockfishReady) {
        console.warn('Stockfish no está listo');
        if (callback) callback(null, 0);
        return;
    }
    
    // Guardar callback global para cuando Stockfish responda
    window.stockfishCallback = callback;
    
    try {
        stockfish.postMessage(`position fen ${fen}`);
        stockfish.postMessage(`go depth ${depth}`);
    } catch (error) {
        console.error('Error enviando comando a Stockfish:', error);
        if (callback) callback(null, 0);
    }
}

// ===================== EVALUACIÓN DE POSICIÓN =====================
function evaluatePosition() {
    return currentEval;
}

function calculateWinProbability() {
    const score = evaluatePosition();
    const sigmoid = (x) => 1 / (1 + Math.exp(-x / 150));
    
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

// ===================== EVALUAR CALIDAD DE MOVIMIENTO =====================
function evaluateMoveQuality(move) {
    if (!stockfishReady) return;
    
    const currentScore = evaluatePosition();
    const diff = currentScore - lastEval;
    
    let quality = 'good';
    
    if (diff > 0.5) {
        quality = 'excellent';
    } else if (diff < -0.8) {
        quality = 'blunder';
    } else if (diff < -0.3) {
        quality = 'mistake';
    }
    
    if (quality === 'excellent' || quality === 'good') {
        goodMoves++;
    }
    if (quality === 'mistake' || quality === 'blunder') {
        badMoves++;
    }
    
    giveCoachFeedback(quality);
    lastEval = currentScore;
}

// ===================== HACER JUGADA DE IA =====================
function makeAIMove() {
    if (game.game_over()) {
        aiThinking = false;
        return;
    }

    if (!stockfishReady) {
        console.warn('Stockfish no disponible, movimiento aleatorio');
        const moves = game.moves({ verbose: true });
        if (moves.length === 0) {
            aiThinking = false;
            return;
        }
        const move = moves[Math.floor(Math.random() * moves.length)];
        game.move(move);
        lastFromSquare = move.from;
        lastToSquare = move.to;
        moveCount++;
        aiThinking = false;
        updateUI();
        return;
    }

    const difficulty = parseInt(document.getElementById('difficulty').value);
    const depthMap = { 1: 6, 2: 12, 3: 18, 4: 24, 5: 30 };
    const depth = depthMap[difficulty] || 18;

    aiThinking = true;
    const fen = game.fen();

    getBestMove(fen, depth, (bestMove, evalScore) => {
        if (!bestMove || bestMove === '(none)') {
            console.warn('Stockfish no encontró movimiento');
            aiThinking = false;
            return;
        }

        const from = bestMove.substring(0, 2);
        const to = bestMove.substring(2, 4);
        const promotion = bestMove.length > 4 ? bestMove[4] : 'q';

        const move = game.move({ from, to, promotion });
        
        if (move) {
            lastFromSquare = move.from;
            lastToSquare = move.to;
            moveCount++;
            console.log('IA jugó:', move.san);
        } else {
            console.warn('Movimiento Stockfish inválido:', bestMove);
        }

        aiThinking = false;
        updateUI();

        if (game.game_over()) {
            showGameOver();
        }
    });
}

// ===================== OBTENER PISTA =====================
function requestHint() {
    if (game.game_over() || aiThinking) return;

    if (!stockfishReady) {
        console.warn('Stockfish no disponible para pista');
        return;
    }

    const difficulty = parseInt(document.getElementById('difficulty').value);
    const depthMap = { 1: 8, 2: 14, 3: 20, 4: 26, 5: 32 };
    const depth = depthMap[difficulty] || 20;

    const fen = game.fen();

    getBestMove(fen, depth, (bestMove, evalScore) => {
        if (!bestMove || bestMove === '(none)') {
            return;
        }

        selectedSquare = bestMove.substring(0, 2);
        highlights = [bestMove.substring(2, 4)];
        renderBoard();

        const coachMsg = document.getElementById('coachMessage');
        coachMsg.innerHTML = `<strong>💡 Pista:</strong> ${bestMove.toUpperCase()} (eval: ${evalScore.toFixed(2)})`;
        coachMsg.className = 'coach-message good';
    });
}

// ===================== ANÁLISIS DETALLADO =====================
function performAnalysis() {
    if (!stockfishReady) {
        console.warn('Stockfish no disponible para análisis');
        return;
    }

    const difficulty = parseInt(document.getElementById('difficulty').value);
    const depthMap = { 1: 10, 2: 16, 3: 22, 4: 28, 5: 35 };
    const depth = depthMap[difficulty] || 22;

    const fen = game.fen();

    document.getElementById('analysisLoading').style.display = 'inline-block';
    document.getElementById('analysisStatus').innerHTML = 'Analizando con Stockfish...';

    getBestMove(fen, depth, (bestMove, evalScore) => {
        const prob = calculateWinProbability();
        const history = game.history({ verbose: true });
        const board = game.board();
        
        let material = 0;
        const pieceValues = { 'p': 1, 'n': 3, 'b': 3.25, 'r': 5, 'q': 9 };
        
        for (let row of board) {
            for (let p of row) {
                if (!p) continue;
                material += p.color === 'w' ? (pieceValues[p.type] || 0) : -(pieceValues[p.type] || 0);
            }
        }

        const phase = history.length < 10 ? 'Apertura' : 
                     history.length < 40 ? 'Medio Juego' : 'Final';

        document.getElementById('whiteWinProb').innerHTML = prob.white + '%';
        document.getElementById('drawProb').innerHTML = prob.draw + '%';
        document.getElementById('blackWinProb').innerHTML = prob.black + '%';
        document.getElementById('anyWinProb').innerHTML = prob.decisive + '%';
        document.getElementById('currentScore').innerHTML = evalScore.toFixed(2);
        document.getElementById('analysisDepth').innerHTML = depth;
        document.getElementById('bestMoveAnalysis').innerHTML = bestMove || '-';
        document.getElementById('materialEval').innerHTML = material.toFixed(2);
        document.getElementById('openingEval').innerHTML = phase === 'Apertura' ? evalScore.toFixed(2) : '-';
        document.getElementById('middlegameEval').innerHTML = phase === 'Medio Juego' ? evalScore.toFixed(2) : '-';
        document.getElementById('endgameEval').innerHTML = phase === 'Final' ? evalScore.toFixed(2) : '-';
        document.getElementById('principalVariation').innerHTML = bestMove || '-';
        document.getElementById('analysisStatus').innerHTML = '✅ Análisis completado con Stockfish';
        document.getElementById('analysisLoading').style.display = 'none';
    });
}
