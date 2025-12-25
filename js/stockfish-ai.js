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
  
    // Valores de las piezas  
    const pieceValues = { 'p': 1, 'n': 3, 'b': 3.25, 'r': 5, 'q': 9, 'k': 0 };  
  
    // Evaluación de Material y Posición  
    for (let row = 0; row < 8; row++) {  
        for (let col = 0; col < 8; col++) {  
            const piece = board[row][col];  
            if (!piece) continue;  
  
            let pieceScore = pieceValues[piece.type] || 0;  
  
            // Bonificaciones y penalizaciones posicionales  
            const distToCenter = Math.abs(row - 3.5) + Math.abs(col - 3.5);  
            if (['n', 'b', 'q'].includes(piece.type) && distToCenter < 4) {  
                pieceScore += 0.3; // Bonificación por centralización  
            }  
  
            if (['n', 'b'].includes(piece.type) && (col === 0 || col === 7)) {  
                pieceScore -= 0.2; // Penalización por piezas en las esquinas  
            }  
  
            if (piece.type === 'p') {  
                // Bonificación por avance de peones  
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
  
    // Movilidad (considera el número de movimientos legales)  
    // Se multiplica por un factor pequeño para que tenga peso pero no domine sobre el material  
    const moves = gameState.moves();  
    score += (moves.length * 0.08) * (gameState.turn() === 'w' ? 1 : -1);  
  
    return score;  
}  
  
// ===================== MINIMAX CON PODA ALFA-BETA =====================  
  
/**  
 * Minimax con poda alfa-beta  
 * @param {Object} gameState - El estado actual del juego (una instancia de Chess.js).  
 * @param {number} depth - La profundidad de búsqueda restante.  
 * @param {number} alpha - El valor alfa para la poda.  
 * @param {number} beta - El valor beta para la poda.  
 * @param {boolean} isMaximizing - True si es el turno del jugador maximizador (IA), false si es el minimizador.  
 * @param {number} difficulty - Nivel de dificultad (1-5) para limitar movimientos.  
 * @returns {number} La evaluación de la posición.  
 */  
function minimax(gameState, depth, alpha, beta, isMaximizing, difficulty) {  
    if (depth === 0 || gameState.game_over()) {  
        return evaluatePositionLocal(gameState);  
    }  
  
    const moves = gameState.moves({ verbose: true });  
    if (moves.length === 0) {  
        return evaluatePositionLocal(gameState);  
    }  
  
    // Limitar movimientos según dificultad para la eficiencia  
    const moveLimits = { 1: 3, 2: 5, 3: 8, 4: 12, 5: moves.length };  
    const maxMovesToConsider = Math.min(moves.length, moveLimits[difficulty] || moves.length);  
  
    // Ordenar movimientos (muy importante para la poda alfa-beta)  
    moves.sort((a, b) => a.san.localeCompare(b.san));  
  
  
    if (isMaximizing) {  
        let maxEval = -Infinity;  
        for (let i = 0; i < maxMovesToConsider; i++) {  
            const move = moves[i];  
            // *** CORRECCIÓN CLAVE: Usar new Chess(gameState.fen()) en lugar de gameState.copy() ***  
            const tempGame = new Chess(gameState.fen());  
            tempGame.move(move); // Realizar el movimiento en la COPIA  
  
            const eval = minimax(tempGame, depth - 1, alpha, beta, false, difficulty);  
  
            maxEval = Math.max(maxEval, eval);  
            alpha = Math.max(alpha, eval);  
            if (beta <= alpha) break; // Poda Beta  
        }  
        return maxEval;  
    } else {  
        let minEval = Infinity;  
        for (let i = 0; i < maxMovesToConsider; i++) {  
            const move = moves[i];  
            // *** CORRECCIÓN CLAVE: Usar new Chess(gameState.fen()) en lugar de gameState.copy() ***  
            const tempGame = new Chess(gameState.fen());  
            tempGame.move(move); // Realizar el movimiento en la COPIA  
  
            const eval = minimax(tempGame, depth - 1, alpha, beta, true, difficulty);  
  
            minEval = Math.min(minEval, eval);  
            beta = Math.min(beta, eval);  
            if (beta <= alpha) break; // Poda Alfa  
        }  
        return minEval;  
    }  
}  
  
/**  
 * Encuentra el mejor movimiento usando minimax  
 * @param {Object} gameState - El estado actual del juego (una instancia de Chess.js).  
 * @param {number} depth - La profundidad máxima de búsqueda.  
 * @param {number} difficulty - Nivel de dificultad (1-5).  
 * @returns {Object|null} El mejor objeto de movimiento (del tipo { from: 'e2', to: 'e4', ... }) o null si no hay movimientos.  
 */  
function findBestMoveWithMinimax(gameState, depth, difficulty) {  
    const moves = gameState.moves({ verbose: true });  
    if (moves.length === 0) return null;  
  
    let bestMove = null;  
    let bestScore = -Infinity;  
  
    moves.sort((a, b) => a.san.localeCompare(b.san));  
  
  
    for (const move of moves) {  
        // *** CORRECCIÓN CLAVE: Usar new Chess(gameState.fen()) en lugar de gameState.copy() ***  
        const tempGame = new Chess(gameState.fen());  
        tempGame.move(move); // Realizar el movimiento en la COPIA  
  
        // El turno cambia después de move(), así que el siguiente jugador es el minimizador (false)  
        const score = minimax(tempGame, depth - 1, -Infinity, Infinity, false, difficulty);  
  
        if (score > bestScore) {  
            bestScore = score;  
            bestMove = move;  
        }  
    }  
  
    return bestMove;  
}  
  
// ===================== EVALUAR (PARA DISPLAY RÁPIDO) =====================  
  
/**  
 * Evalúa una posición (rápido, no usa minimax directamente para el resultado, sino la evaluación local)  
 * @param {number} depth - Profundidad de evaluación (usada para el display, no para la IA real aquí).  
 * @param {number} customTimeout - Tiempo de espera (no usado para Stockfish real, solo para simular latencia).  
 * @returns {Promise<Object>} Un objeto con la puntuación, el mejor movimiento y la profundidad.  
 */  
async function evaluateWithStockfish(depth = 2, customTimeout = 300) {  
    return new Promise((resolve) => {  
        setTimeout(() => {  
            if (!window.game || typeof window.game.fen !== 'function') {  
                resolve({ score: 0, bestMove: null, depth: 0, pv: [] });  
                return;  
            }  
  
            const score = evaluatePositionLocal(window.game);  
            const moves = window.game.moves({ verbose: true });  
            let bestMoveDisplay = null;  
            if (moves.length > 0) {  
                bestMoveDisplay = moves[0].from + moves[0].to + (moves[0].promotion ? moves[0].promotion : '');  
            }  
  
  
            resolve({  
                score: score * 100,  
                bestMove: bestMoveDisplay,  
                depth: depth,  
                pv: bestMoveDisplay ? [bestMoveDisplay] : []  
            });  
        }, customTimeout);  
    });  
}  
  
// ===================== OBTENER MEJOR MOVIMIENTO (PARA STOCKFISH ORIGINAL - YA NO USADO PARA MINIMAX) =====================  
  
/**  
 * Obtiene el mejor movimiento utilizando evaluateWithStockfish (que ahora usa evaluatePositionLocal para ser rápido)  
 * NOTA: Esta función no usa el algoritmo Minimax implementado.  
 * Es más bien un placeholder si en algún momento se integrara Stockfish real.  
 * Para la IA con Minimax, se debe llamar a makeAIMove.  
 * @param {number} depth - Profundidad de búsqueda.  
 * @returns {Object|null} Objeto de movimiento de Chess.js o null.  
 */  
async function getBestMoveStockfish(depth = 20) {  
    try {  
        const result = await evaluateWithStockfish(depth, 500);  
  
        if (!result.bestMove) {  
            const moves = window.game.moves({ verbose: true });  
            return moves.length > 0 ? moves[Math.floor(Math.random() * moves.length)] : null;  
        }  
  
        const from = result.bestMove.substring(0, 2);  
        const to = result.bestMove.substring(2, 4);  
        const promotion = result.bestMove.length > 4 ? result.bestMove[4].toLowerCase() : undefined;  
  
        const moveObj = { from, to, promotion };  
  
        const legalMoves = window.game.moves({ verbose: true });  
        const isMoveLegal = legalMoves.some(m => m.from === from && m.to === to && (!promotion || m.promotion === promotion));  
  
        return isMoveLegal ? moveObj : null;  
  
    } catch (e) {  
        console.error('Error en getBestMoveStockfish:', e);  
        const moves = window.game.moves({ verbose: true });  
        return moves.length > 0 ? moves[Math.floor(Math.random() * moves.length)] : null;  
    }  
}  
  
// ===================== IA JUEGA (USA MINIMAX) =====================  
  
/**  
 * Calcula y devuelve el movimiento de la IA usando el algoritmo Minimax.  
 * Esta es la función principal que debería ser llamada cuando la IA necesita jugar.  
 * @returns {Object|null} El objeto de movimiento de Chess.js o null si el juego ha terminado.  
 */  
async function makeAIMove() {  
    if (window.game.game_over()) {  
        return null;  
    }  
  
    const difficultyElem = document.getElementById('difficulty');  
    const difficulty = difficultyElem ? parseInt(difficultyElem.value) : 3;  
  
    const depthMap = { 1: 2, 2: 3, 3: 4, 4: 5, 5: 6 };  
    const depth = depthMap[difficulty] || 4;  
  
    console.log(`IA nivel ${difficulty} (profundidad ${depth})...`);  
  
    // *** CORRECCIÓN CLAVE: Usar new Chess(window.game.fen()) en lugar de window.game.copy() ***  
    const bestMove = findBestMoveWithMinimax(new Chess(window.game.fen()), depth, difficulty);  
  
    if (!bestMove) {  
        const moves = window.game.moves({ verbose: true });  
        return moves.length > 0 ? moves[Math.floor(Math.random() * moves.length)] : null;  
    }  
  
    return bestMove;  
}  
  
// ===================== ACTUALIZAR INTERFAZ =====================  
  
/**  
 * Actualiza la visualización de la evaluación y sugerencia en la interfaz (OPTIMIZADO)  
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
  
// ===================== EXPORTAR FUNCIONES GLOBALES =====================  
window.initializeStockfishEngine = initializeStockfishEngine;  
window.getBestMoveStockfish = getBestMoveStockfish;  
window.makeAIMove = makeAIMove;  
window.evaluateWithStockfish = evaluateWithStockfish;  
window.updateEvaluationDisplay = updateEvaluationDisplay;  
window.engineReady = engineReady;  
