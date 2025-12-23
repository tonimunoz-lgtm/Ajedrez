// ===================== STOCKFISH AI - VERSIÓN CORREGIDA =====================
let stockfish = null;
let stockfishReady = false;
let currentEval = 0;
let currentBestMove = null;
let pendingCallback = null;

// ===================== INICIALIZAR STOCKFISH CON MEJOR MANEJO =====================
function initStockfish() {
    console.log('🔄 Iniciando Stockfish...');
    
    try {
        // Crear Worker con Stockfish
        stockfish = new Worker('https://stockfishchess.org/api/stockfish.wasm');
        
        let uciOkReceived = false;
        
        stockfish.onmessage = function(event) {
            const line = event.data;
            console.log('[SF]', line);
            
            // Reconocer que UCI está listo
            if (line === 'uciok') {
                uciOkReceived = true;
                stockfishReady = true;
                console.log('✅ Stockfish UCI iniciado correctamente');
                document.getElementById('coachMessage').innerHTML = 
                    '<strong>✅ Stockfish Real</strong> Motor profesional activado (Elo 3500+).';
            }
            
            // Evaluar posición en tiempo real
            if (line.includes('info depth')) {
                // Extraer score en centipawns
                const scoreMatch = line.match(/score (cp|mate) (-?\d+)/);
                if (scoreMatch) {
                    const type = scoreMatch[1];
                    const val = parseInt(scoreMatch[2]);
                    currentEval = (type === 'cp') ? val / 100 : (val > 0 ? 999 : -999);
                    console.log('📊 Evaluación:', currentEval);
                }
                
                // Extraer mejor movimiento de PV
                const pvMatch = line.match(/pv (\S+)/);
                if (pvMatch) {
                    currentBestMove = pvMatch[1];
                }
            }
            
            // Mejor movimiento final
            if (line.startsWith('bestmove')) {
                const parts = line.split(' ');
                const bestMove = parts[1];
                currentBestMove = bestMove;
                
                console.log('🎯 Mejor movimiento:', bestMove, 'Eval:', currentEval);
                
                // Ejecutar callback si existe
                if (pendingCallback) {
                    const cb = pendingCallback;
                    pendingCallback = null;
                    
                    // Delay mínimo de 1.5 segundos para que parezca que está pensando
                    setTimeout(() => {
                        cb(bestMove, currentEval);
                    }, 1500);
                }
            }
        };
        
        stockfish.onerror = (error) => {
            console.error('❌ Error en Stockfish Worker:', error);
            stockfishReady = false;
            document.getElementById('coachMessage').innerHTML = 
                '<strong>❌ Error Stockfish</strong> Revisa la conexión a internet.';
        };
        
        // Enviar comando UCI
        console.log('→ Enviando: uci');
        stockfish.postMessage('uci');
        
        // Timeout: si en 10 segundos no responde, mostrar error
        setTimeout(() => {
            if (!uciOkReceived) {
                console.warn('⏱️ Timeout esperando respuesta UCI');
                stockfishReady = false;
                document.getElementById('coachMessage').innerHTML = 
                    '<strong>⚠️ Stockfish Lento</strong> Intenta nuevamente.';
            }
        }, 10000);
        
    } catch (error) {
        console.error('❌ Error inicializando Stockfish:', error);
        stockfishReady = false;
        document.getElementById('coachMessage').innerHTML = 
            '<strong>⚠️ Stockfish No Disponible</strong> Usando análisis local.';
    }
}

// ===================== OBTENER MEJOR MOVIMIENTO =====================
function getBestMove(fen, depth, callback) {
    if (!stockfishReady) {
        console.warn('⚠️ Stockfish no disponible, usando análisis local');
        // Fallback: análisis local rápido
        setTimeout(() => {
            const moves = game.moves({ verbose: true });
            const randomMove = moves[Math.floor(Math.random() * Math.min(5, moves.length))];
            if (randomMove) {
                const move = randomMove.from + randomMove.to;
                callback(move, evaluatePosition());
            } else {
                callback(null, 0);
            }
        }, 1000);
        return;
    }
    
    console.log('🔍 Buscando movimiento a profundidad', depth, 'en:', fen);
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

// ===================== EVALUACIÓN DE POSICIÓN =====================
function evaluatePosition() {
    // Evaluación local rápida si Stockfish no está disponible
    if (!stockfishReady) {
        const board = game.board();
        let score = 0;
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

    const difficulty = parseInt(document.getElementById('difficulty').value);
    const depthMap = { 1: 6, 2: 12, 3: 18, 4: 24, 5: 30 };
    const depth = depthMap[difficulty] || 18;

    aiThinking = true;
    const fen = game.fen();
    
    console.log('🤖 IA pensando a profundidad', depth);

    getBestMove(fen, depth, (bestMove, evalScore) => {
        if (!bestMove || bestMove === '(none)') {
            console.warn('⚠️ IA no encontró movimiento válido');
            
            // Movimiento aleatorio de fallback
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
        } else {
            const from = bestMove.substring(0, 2);
            const to = bestMove.substring(2, 4);
            const promotion = bestMove.length > 4 ? bestMove[4] : 'q';

            const move = game.move({ from, to, promotion });
            
            if (move) {
                lastFromSquare = move.from;
                lastToSquare = move.to;
                moveCount++;
                console.log('✅ IA jugó:', move.san);
            } else {
                console.warn('❌ Movimiento inválido:', bestMove);
            }
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

    const difficulty = parseInt(document.getElementById('difficulty').value);
    const depthMap = { 1: 8, 2: 14, 3: 20, 4: 26, 5: 32 };
    const depth = depthMap[difficulty] || 20;

    const fen = game.fen();
    
    console.log('💡 Buscando pista a profundidad', depth);

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
    const difficulty = parseInt(document.getElementById('difficulty').value);
    const depthMap = { 1: 10, 2: 16, 3: 22, 4: 28, 5: 35 };
    const depth = depthMap[difficulty] || 22;

    const fen = game.fen();

    document.getElementById('analysisLoading').style.display = 'inline-block';
    document.getElementById('analysisStatus').innerHTML = 'Analizando con Stockfish...';
    
    console.log('📊 Análisis a profundidad', depth);

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
        document.getElementById('analysisStatus').innerHTML = '✅ Análisis completado';
        document.getElementById('analysisLoading').style.display = 'none';
    });
}
