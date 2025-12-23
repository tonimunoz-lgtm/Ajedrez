// ===================== STOCKFISH - MOTOR REAL DESDE CDN =====================
let engine = null;
let engineReady = false;

async function initStockfish() {
    try {
        console.log('Cargando Stockfish desde CDN...');
        
        // Cargar el script de Stockfish desde jsdelivr (funciona garantizado)
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/stockfish@16.1.0/src/stockfish.js';
        
        script.onload = async () => {
            console.log('Script Stockfish cargado');
            
            // Esperar a que Stockfish esté disponible
            let attempts = 0;
            const waitForStockfish = setInterval(() => {
                if (typeof Stockfish !== 'undefined') {
                    clearInterval(waitForStockfish);
                    
                    // Inicializar Stockfish
                    engine = Stockfish();
                    engineReady = true;
                    
                    console.log('✅ Stockfish REAL cargado y funcionando');
                    document.getElementById('coachMessage').innerHTML = '<strong>✅ Stockfish Real</strong> Motor profesional Elo 3500+ activado.';
                } else {
                    attempts++;
                    if (attempts > 50) {
                        clearInterval(waitForStockfish);
                        fallbackMode();
                    }
                }
            }, 100);
        };
        
        script.onerror = () => {
            console.error('Error cargando script de Stockfish desde CDN');
            fallbackMode();
        };
        
        document.head.appendChild(script);
        
        // Timeout: si en 5 segundos no carga, usar fallback
        setTimeout(() => {
            if (!engineReady) {
                fallbackMode();
            }
        }, 5000);
        
    } catch (e) {
        console.error('Error en initStockfish:', e);
        fallbackMode();
    }
}

function fallbackMode() {
    engineReady = false;
    console.warn('⚠️ Stockfish no disponible, usando análisis local');
    document.getElementById('coachMessage').innerHTML = '<strong>⚠️ Análisis Local</strong> Stockfish no disponible, usando evaluación local.';
}

// ===================== EVALUAR CON STOCKFISH REAL =====================
function evaluateWithStockfish(depth = 20) {
    return new Promise((resolve) => {
        if (!engineReady || !engine) {
            // Fallback si Stockfish no está disponible
            resolve({ score: 0, bestMove: null, depth: 0 });
            return;
        }

        let bestMove = null;
        let score = 0;
        let depthReached = 0;
        let isResolved = false;

        const timeout = setTimeout(() => {
            if (!isResolved) {
                isResolved = true;
                console.warn('Timeout en evaluación de Stockfish');
                resolve({ score, bestMove, depth: depthReached });
            }
        }, 2500);

        const onMessage = (message) => {
            if (isResolved) return;

            try {
                // Mensaje de Stockfish: "bestmove e2e4 ponder e7e5"
                if (message.includes('bestmove')) {
                    isResolved = true;
                    clearTimeout(timeout);
                    const match = message.match(/bestmove (\S+)/);
                    if (match) bestMove = match[1];
                    console.log('Stockfish encontró:', bestMove, 'Evaluación:', score);
                    resolve({ score, bestMove, depth: depthReached });
                }

                // Extraer puntuación centipawns: "info depth 20 score cp 45"
                if (message.includes('score cp')) {
                    const m = message.match(/score cp (-?\d+)/);
                    if (m) score = parseInt(m[1]) / 100;
                }

                // Profundidad alcanzada
                if (message.includes('depth')) {
                    const m = message.match(/depth (\d+)/);
                    if (m) depthReached = parseInt(m[1]);
                }
            } catch (e) {
                console.error('Error procesando mensaje de Stockfish:', e);
            }
        };

        try {
            engine.onmessage = onMessage;
            engine.postMessage('position fen ' + game.fen());
            engine.postMessage('go depth ' + depth);
        } catch (e) {
            console.error('Error enviando comandos a Stockfish:', e);
            if (!isResolved) {
                isResolved = true;
                clearTimeout(timeout);
                resolve({ score: 0, bestMove: null, depth: 0 });
            }
        }
    });
}

// ===================== OBTENER MEJOR MOVIMIENTO (SIN RANDOM) =====================
async function getBestMoveStockfish(depth = 20) {
    const result = await evaluateWithStockfish(depth);
    
    if (!result.bestMove) {
        // Fallback: obtener un movimiento legal aleatorio
        const moves = game.moves({ verbose: true });
        return moves.length > 0 ? moves[0] : null;
    }

    // Convertir notación Stockfish (e.g., "e2e4") a objeto chess.js
    const from = result.bestMove.substring(0, 2);
    const to = result.bestMove.substring(2, 4);
    const promotion = result.bestMove.length > 4 ? result.bestMove[4] : undefined;
    
    try {
        const moveObj = game.move({ from, to, promotion });
        if (moveObj) {
            game.undo();
            return moveObj;
        }
    } catch (e) {
        console.error('Error procesando movimiento de Stockfish:', e);
    }
    
    // Fallback final
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
    
    // Profundidades según dificultad (REAL Stockfish)
    const depthMap = {
        1: 6,   // Novato
        2: 12,  // Intermedio
        3: 18,  // Avanzado
        4: 24,  // Experto
        5: 30   // Maestro
    };

    const depth = depthMap[difficulty] || 18;
    
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

    if (game.game_over()) {
        showGameOver();
    }
}
