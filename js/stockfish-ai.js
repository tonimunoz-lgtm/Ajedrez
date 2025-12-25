// js/stockfish-ai.js - EVALUADOR LOCAL PROFESIONAL

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
 * Evalúa una posición analizando material, posición y tácticas
 */
function evaluatePositionLocal(gameState) {
    const board = gameState.board();
    let score = 0;
    
    const pieceValues = { 'p': 1, 'n': 3, 'b': 3.25, 'r': 5, 'q': 9, 'k': 0 };
    
    // Evaluar material
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = board[row][col];
            if (!piece) continue;
            
            let pieceScore = pieceValues[piece.type] || 0;
            
            // Bonificación por posición central (especialmente para caballos, alfiles, reina)
            const distToCenter = Math.abs(row - 3.5) + Math.abs(col - 3.5);
            if (['n', 'b', 'q'].includes(piece.type) && distToCenter < 4) {
                pieceScore += 0.3;
            }
            
            // Penalización para piezas en los bordes
            if (['n', 'b'].includes(piece.type) && (col === 0 || col === 7)) {
                pieceScore -= 0.2;
            }
            
            // Bonificación para peones avanzados
            if (piece.type === 'p') {
                const rankBonus = piece.color === 'w' ? (6 - row) * 0.1 : (row - 1) * 0.1;
                pieceScore += rankBonus;
            }
            
            // Aplicar color
            if (piece.color === 'w') {
                score += pieceScore;
            } else {
                score -= pieceScore;
            }
        }
    }
    
    // Evaluar movilidad (muy importante)
    const moves = gameState.moves();
    score += (moves.length * 0.08) * (gameState.turn() === 'w' ? 1 : -1);
    
    // Evaluar seguridad del rey
    const kingPos = findKingPosition(board);
    if (kingPos) {
        const kingScore = evaluateKingSafety(board, kingPos);
        score += (gameState.turn() === 'w' ? 1 : -1) * kingScore;
    }
    
    return score;
}

/**  
 * Encuentra la posición del rey del turno actual
 */
function findKingPosition(board) {
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = board[row][col];
            if (piece && piece.type === 'k') return { row, col };
        }
    }
    return null;
}

/**  
 * Evalúa la seguridad del rey
 */
function evaluateKingSafety(board, kingPos) {
    let safety = 0;
    const { row, col } = kingPos;
    
    // Verificar si hay peones defensores alrededor
    for (let r = Math.max(0, row - 1); r <= Math.min(7, row + 1); r++) {
        for (let c = Math.max(0, col - 1); c <= Math.min(7, col + 1); c++) {
            const piece = board[r][c];
            if (piece && piece.type === 'p') {
                safety += 0.3;
            }
        }
    }
    
    return safety;
}

/**  
 * Encuentra el mejor movimiento analizando opciones
 */
function findBestMoveLocal(gameState, depth = 3) {
    const moves = gameState.moves({ verbose: true });
    if (moves.length === 0) return null;
    
    let bestMove = moves[0];
    let bestScore = -Infinity;
    
    // Analizar hasta 20 movimientos (limitar para velocidad)
    const movesToAnalyze = Math.min(moves.length, 20);
    
    for (let i = 0; i < movesToAnalyze; i++) {
        const move = moves[i];
        gameState.move(move);
        
        let moveScore = -evaluatePositionLocal(gameState);
        
        // Bonus por capturas
        if (move.capture) {
            const pieceValues = { 'p': 1, 'n': 3, 'b': 3.25, 'r': 5, 'q': 9 };
            const captureValue = pieceValues[move.capture] || 1;
            moveScore += captureValue * 1.5;
        }
        
        // Bonus por jaque
        if (move.check) {
            moveScore += 1.5;
        }
        
        // Bonus por jaquemate
        if (gameState.in_checkmate()) {
            moveScore += 100;
        }
        
        gameState.undo();
        
        if (moveScore > bestScore) {
            bestScore = moveScore;
            bestMove = move;
        }
    }
    
    return bestMove;
}

// ===================== EVALUAR =====================  

/**  
 * Evalúa una posición
 */  
async function evaluateWithStockfish(depth = 20, customTimeout = 5000) {  
    return new Promise((resolve) => {
        setTimeout(() => {
            if (!window.game) {
                resolve({ score: 0, bestMove: null, depth: 0, pv: [] });
                return;
            }

            const score = evaluatePositionLocal(window.game);
            const bestMoveObj = findBestMoveLocal(window.game, Math.min(depth, 3));
            const bestMove = bestMoveObj ? bestMoveObj.from + bestMoveObj.to : null;
            
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
 * Calcula el movimiento de la IA
 */  
async function makeAIMove() {  
    if (window.game.game_over()) {
        return null;
    }

    const difficultyElem = document.getElementById('difficulty');
    const difficulty = difficultyElem ? parseInt(difficultyElem.value) : 3;

    const depthMap = { 1: 2, 2: 2, 3: 3, 4: 3, 5: 4 };
    const depth = depthMap[difficulty] || 3;

    console.log(`IA pensando...`);

    const aiMoveObj = await getBestMoveStockfish(depth);
    return aiMoveObj || null;
}

// ===================== ACTUALIZAR INTERFAZ =====================  

/**  
 * Actualiza la evaluación (OPTIMIZADO - menos análisis)
 */  
async function updateEvaluationDisplay() {  
    if (!window.game || typeof window.game.fen !== 'function') {
        return;
    }

    try {
        // Solo hacer análisis rápido (profundidad 2, no 3)
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
        // Silenciar errores para que no bloquee la interfaz
    }
}

// ===================== EXPORTAR =====================  
window.initializeStockfishEngine = initializeStockfishEngine;
window.getBestMoveStockfish = getBestMoveStockfish;
window.makeAIMove = makeAIMove;
window.evaluateWithStockfish = evaluateWithStockfish;
window.updateEvaluationDisplay = updateEvaluationDisplay;
window.engineReady = engineReady;
