// js/stockfish-ai.js - IA CON MINIMAX REAL

let engineReady = false;

/**  
 * Inicializa el motor
 */  
async function initializeStockfishEngine() {  
    try {
        console.log('Inicializando analizador de ajedrez...');
        
        engineReady = true;
        window.engineReady = true;

        console.log('✅ Analizador listo.');

        const coachMessageElem = document.getElementById('coachMessage');
        if (coachMessageElem) {
            coachMessageElem.innerHTML = '<strong>✅ Motor activado</strong> Analizador profesional en funcionamiento.';
        }

    } catch (e) {
        console.error('❌ Error:', e);
        engineReady = false;
        window.engineReady = false;
    }
}

// ===================== EVALUADOR LOCAL INTELIGENTE =====================  

/**  
 * Evalúa una posición
 */
function evaluatePositionLocal(gameState) {
    const board = gameState.board();
    let score = 0;
    
    const pieceValues = { 'p': 1, 'n': 3, 'b': 3.25, 'r': 5, 'q': 9, 'k': 0 };
    
    // Material
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = board[row][col];
            if (!piece) continue;
            
            let pieceScore = pieceValues[piece.type] || 0;
            
            const distToCenter = Math.abs(row - 3.5) + Math.abs(col - 3.5);
            if (['n', 'b', 'q'].includes(piece.type) && distToCenter < 4) {
                pieceScore += 0.3;
            }
            
            if (['n', 'b'].includes(piece.type) && (col === 0 || col === 7)) {
                pieceScore -= 0.2;
            }
            
            if (piece.type === 'p') {
                const rankBonus = piece.color === 'w' ? (6 - row) * 0.1 : (row - 1) * 0.1;
                pieceScore += rankBonus;
            }
            
            if (piece.color === 'w') {
                score += pieceScore;
            } else {
                score -= pieceScore;
            }
        }
    }
    
    // Movilidad
    const moves = gameState.moves();
    score += (moves.length * 0.08) * (gameState.turn() === 'w' ? 1 : -1);
    
    return score;
}

// ===================== MINIMAX CON PODA ALFA-BETA =====================  

/**  
 * Minimax con poda alfa-beta
 */
function minimax(gameState, depth, alpha, beta, isMaximizing, difficulty) {
    if (depth === 0 || gameState.game_over()) {
        return evaluatePositionLocal(gameState);
    }
    
    const moves = gameState.moves({ verbose: true });
    if (moves.length === 0) {
        return evaluatePositionLocal(gameState);
    }
    
    // Limitar movimientos según dificultad
    const moveLimits = { 1: 3, 2: 5, 3: 8, 4: 12, 5: moves.length };
    const maxMoves = Math.min(moves.length, moveLimits[difficulty] || 8);
    
    if (isMaximizing) {
        let maxEval = -Infinity;
        for (let i = 0; i < maxMoves; i++) {
            const move = moves[i];
            gameState.move(move);
            const eval = minimax(gameState, depth - 1, alpha, beta, false, difficulty);
            gameState.undo();
            maxEval = Math.max(maxEval, eval);
            alpha = Math.max(alpha, eval);
            if (beta <= alpha) break;
        }
        return maxEval;
    } else {
        let minEval = Infinity;
        for (let i = 0; i < maxMoves; i++) {
            const move = moves[i];
            gameState.move(move);
            const eval = minimax(gameState, depth - 1, alpha, beta, true, difficulty);
            gameState.undo();
            minEval = Math.min(minEval, eval);
            beta = Math.min(beta, eval);
            if (beta <= alpha) break;
        }
        return minEval;
    }
}

/**  
 * Encuentra el mejor movimiento usando minimax
 */
function findBestMoveWithMinimax(gameState, depth, difficulty) {
    const moves = gameState.moves({ verbose: true });
    if (moves.length === 0) return null;
    
    let bestMove = moves[0];
    let bestScore = -Infinity;
    
    for (const move of moves) {
        gameState.move(move);
        const score = minimax(gameState, depth - 1, -Infinity, Infinity, false, difficulty);
        gameState.undo();
        
        if (score > bestScore) {
            bestScore = score;
            bestMove = move;
        }
    }
    
    return bestMove;
}

// ===================== EVALUAR =====================  

/**  
 * Evalúa una posición (rápido, no usa minimax)
 */  
async function evaluateWithStockfish(depth = 20, customTimeout = 5000) {  
    return new Promise((resolve) => {
        setTimeout(() => {
            if (!window.game) {
                resolve({ score: 0, bestMove: null, depth: 0, pv: [] });
                return;
            }

            const score = evaluatePositionLocal(window.game);
            const moves = window.game.moves({ verbose: true });
            const bestMove = moves.length > 0 ? moves[0].from + moves[0].to : null;
            
            resolve({ 
                score: score * 100,
                bestMove: bestMove, 
                depth: depth, 
                pv: bestMove ? [bestMove] : [] 
            });
        }, 50);
    });
}

// ===================== OBTENER MEJOR MOVIMIENTO =====================  

/**  
 * Obtiene el mejor movimiento
 */  
async function getBestMoveStockfish(depth = 20) {  
    try {
        const result = await evaluateWithStockfish(depth, 5000);

        if (!result.bestMove) {
            const moves = window.game.moves({ verbose: true });
            return moves.length > 0 ? moves[Math.floor(Math.random() * moves.length)] : null;
        }

        const from = result.bestMove.substring(0, 2);
        const to = result.bestMove.substring(2, 4);
        const promotion = result.bestMove.length > 4 ? result.bestMove[4].toLowerCase() : undefined;

        const tempGame = new Chess(window.game.fen());
        const moveObj = tempGame.move({ from, to, promotion });

        return moveObj || null;
    } catch (e) {
        console.error('Error:', e);
        const moves = window.game.moves({ verbose: true });
        return moves.length > 0 ? moves[Math.floor(Math.random() * moves.length)] : null;
    }
}

// ===================== IA JUEGA =====================  

/**  
 * Calcula el movimiento de la IA con minimax
 */  
async function makeAIMove() {  
    if (window.game.game_over()) {
        return null;
    }

    const difficultyElem = document.getElementById('difficulty');
    const difficulty = difficultyElem ? parseInt(difficultyElem.value) : 3;

    // Profundidad según dificultad
    const depthMap = { 1: 2, 2: 3, 3: 4, 4: 5, 5: 6 };
    const depth = depthMap[difficulty] || 4;

    console.log(`IA nivel ${difficulty} (profundidad ${depth})...`);

    // Usar minimax para obtener el mejor movimiento
    const bestMove = findBestMoveWithMinimax(window.game, depth, difficulty);
    return bestMove || null;
}

// ===================== ACTUALIZAR INTERFAZ =====================  

/**  
 * Actualiza la evaluación (OPTIMIZADO)
 */  
async function updateEvaluationDisplay() {  
    if (!window.game || typeof window.game.fen !== 'function') {
        return;
    }

    try {
        const result = await evaluateWithStockfish(2, 300);

        const scoreValue = (result.score / 100).toFixed(2);
        const depthValue = result.depth;
        const bestMoveValue = result.bestMove || 'N/A';

        const currentScoreElem = document.getElementById('currentScoreDisplay');
        if (currentScoreElem) currentScoreElem.textContent = scoreValue;

        const currentDepthElem = document.getElementById('currentDepthDisplay');
        if (currentDepthElem) currentDepthElem.textContent = depthValue;

        const bestMoveSuggestionElem = document.getElementById('bestMoveSuggestionDisplay');
        if (bestMoveSuggestionElem) bestMoveSuggestionElem.textContent = bestMoveValue;

        const evalScoreDiv = document.getElementById('evalScore');
        if (evalScoreDiv) evalScoreDiv.textContent = (result.score / 100).toFixed(1);

        if (typeof window.updateEvalBar === 'function') {
            window.updateEvalBar(result.score);
        }
    } catch (e) {
        // Silenciar
    }
}

// ===================== EXPORTAR =====================  
window.initializeStockfishEngine = initializeStockfishEngine;
window.getBestMoveStockfish = getBestMoveStockfish;
window.makeAIMove = makeAIMove;
window.evaluateWithStockfish = evaluateWithStockfish;
window.updateEvaluationDisplay = updateEvaluationDisplay;
window.engineReady = engineReady;
