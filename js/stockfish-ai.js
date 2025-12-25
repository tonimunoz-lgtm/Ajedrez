let engineReady = false;  
  
// ===================== VALORES GLOBALES DE PIEZAS =====================  
// Definir pieceValues globalmente en stockfish-ai.js para que sea accesible  
// por evaluatePositionLocal, minimax y findBestMoveWithMinimax  
const pieceValues = { 'p': 100, 'n': 320, 'b': 330, 'r': 500, 'q': 900, 'k': 0 };  
  
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
        console.error('❌ Error al inicializar el analizador:', e);  
        engineReady = false;  
        window.engineReady = false;  
    }  
}  
  
// ===================== EVALUADOR LOCAL INTELIGENTE =====================  
  
/**  
 * Evalúa una posición de ajedrez basándose en heurísticas.  
 * @param {Object} gameState - La instancia de Chess.js del estado actual del juego.  
 * @returns {number} La puntuación de la posición en centipeones (positivo para blancas, negativo para negras).  
 */  
function evaluatePositionLocal(gameState) {  
    const board = gameState.board();  
    let score = 0;  
  
    // pieceValues ya está definido globalmente arriba  
  
    // Tablas de valores posicionales (ejemplo simplificado)  
    const pawnPositional = [  
        [0, 0, 0, 0, 0, 0, 0, 0],  
        [50, 50, 50, 50, 50, 50, 50, 50],  
        [10, 10, 20, 30, 30, 20, 10, 10],  
        [5, 5, 10, 25, 25, 10, 5, 5],  
        [0, 0, 0, 20, 20, 0, 0, 0],  
        [5, -5, -10, 0, 0, -10, -5, 5],  
        [5, 10, 10, -20, -20, 10, 10, 5],  
        [0, 0, 0, 0, 0, 0, 0, 0]  
    ];  
    const knightPositional = [  
        [-50, -40, -30, -30, -30, -30, -40, -50],  
        [-40, -20, 0, 0, 0, 0, -20, -40],  
        [-30, 0, 10, 15, 15, 10, 0, -30],  
        [-30, 5, 15, 20, 20, 15, 5, -30],  
        [-30, 0, 15, 20, 20, 15, 0, -30],  
        [-30, 5, 10, 15, 15, 10, 5, -30],  
        [-40, -20, 0, 5, 5, 0, -20, -40],  
        [-50, -40, -30, -30, -30, -30, -40, -50]  
    ];  
    const bishopPositional = [  
        [-20, -10, -10, -10, -10, -10, -10, -20],  
        [-10, 0, 0, 0, 0, 0, 0, -10],  
        [-10, 0, 5, 10, 10, 5, 0, -10],  
        [-10, 5, 5, 10, 10, 5, 5, -10],  
        [-10, 0, 10, 10, 10, 10, 0, -10],  
        [-10, 10, 10, 10, 10, 10, 10, -10],  
        [-10, 5, 0, 0, 0, 0, 5, -10],  
        [-20, -10, -10, -10, -10, -10, -10, -20]  
    ];  
    const rookPositional = [  
        [0, 0, 0, 0, 0, 0, 0, 0],  
        [5, 10, 10, 10, 10, 10, 10, 5],  
        [-5, 0, 0, 0, 0, 0, 0, -5],  
        [-5, 0, 0, 0, 0, 0, 0, -5],  
        [-5, 0, 0, 0, 0, 0, 0, -5],  
        [-5, 0, 0, 0, 0, 0, 0, -5],  
        [-5, 0, 0, 0, 0, 0, 0, -5],  
        [0, 0, 0, 5, 5, 0, 0, 0]  
    ];  
    const queenPositional = [  
        [-20, -10, -10, -5, -5, -10, -10, -20],  
        [-10, 0, 0, 0, 0, 0, 0, -10],  
        [-10, 0, 5, 5, 5, 5, 0, -10],  
        [-5, 0, 5, 5, 5, 5, 0, -5],  
        [0, 0, 5, 5, 5, 5, 0, -5],  
        [-10, 5, 5, 5, 5, 5, 0, -10],  
        [-10, 0, 0, 0, 0, 0, 0, -10],  
        [-20, -10, -10, -5, -5, -10, -10, -20]  
    ];  
    const kingPositional = [  
        [-30, -40, -40, -50, -50, -40, -40, -30],  
        [-30, -40, -40, -50, -50, -40, -40, -30],  
        [-30, -40, -40, -50, -50, -40, -40, -30],  
        [-30, -40, -40, -50, -50, -40, -40, -30],  
        [-20, -30, -30, -40, -40, -30, -30, -20],  
        [-10, -20, -20, -20, -20, -20, -20, -10],  
        [20, 20, 0, 0, 0, 0, 20, 20],  
        [20, 30, 10, 0, 0, 10, 30, 20]  
    ]; // Para el medio juego  
    const kingEndgamePositional = [  
        [-50, -40, -30, -20, -20, -30, -40, -50],  
        [-30, -20, -10, 0, 0, -10, -20, -30],  
        [-30, -10, 20, 30, 30, 20, -10, -30],  
        [-30, -10, 30, 40, 40, 30, -10, -30],  
        [-30, -10, 30, 40, 40, 30, -10, -30],  
        [-30, -10, 20, 30, 30, 20, -10, -30],  
        [-30, -30, 0, 0, 0, 0, -30, -30],  
        [-50, -30, -30, -30, -30, -30, -30, -50]  
    ]; // Para el final de partida  
  
    // Heurística simplificada para determinar la fase del juego  
    let majorMinorPiecesCount = 0;  
    board.forEach(row => {  
        row.forEach(piece => {  
            if (piece && ['q', 'r', 'b', 'n'].includes(piece.type)) {  
                majorMinorPiecesCount++;  
            }  
        });  
    });  
    const isEndgame = majorMinorPiecesCount <= 8;  
  
    // Iterar sobre cada cuadrado del tablero  
    for (let rowIdx = 0; rowIdx < 8; rowIdx++) {  
        for (let colIdx = 0; colIdx < 8; colIdx++) {  
            const square = String.fromCharCode(97 + colIdx) + (8 - rowIdx);  
            const piece = gameState.get(square);  
  
            if (!piece) continue;  
  
            let pieceScore = pieceValues[piece.type];  
            let positionalScore = 0;  
  
            const actualRow = piece.color === 'w' ? rowIdx : 7 - rowIdx;  
            const actualCol = colIdx;  
  
            // Añadir puntuaciones posicionales  
            switch (piece.type) {  
                case 'p': positionalScore = pawnPositional[actualRow][actualCol]; break;  
                case 'n': positionalScore = knightPositional[actualRow][actualCol]; break;  
                case 'b': positionalScore = bishopPositional[actualRow][actualCol]; break;  
                case 'r': positionalScore = rookPositional[actualRow][actualCol]; break;  
                case 'q': positionalScore = queenPositional[actualRow][actualCol]; break;  
                case 'k': positionalScore = isEndgame ? kingEndgamePositional[actualRow][actualCol] : kingPositional[actualRow][actualCol]; break;  
            }  
  
            pieceScore += positionalScore;  
  
            if (piece.color === 'w') {  
                score += pieceScore;  
            } else {  
                score -= pieceScore;  
            }  
        }  
    }  
  
    // Evaluación de movilidad (número de movimientos legales)  
    score += (gameState.moves().length * 10) * (gameState.turn() === 'w' ? 1 : -1);  
  
    // Penalización por peones doblados (simplificado)  
    // For (let col = 0; col < 8; col++) {  
    //     let whitePawnsInCol = 0;  
    //     let blackPawnsInCol = 0;  
    //     for (let row = 0; row < 8; row++) {  
    //         const piece = board[row][col];  
    //         if (piece && piece.type === 'p') {  
    //             if (piece.color === 'w') whitePawnsInCol++;  
    //             else blackPawnsInCol++;  
    //         }  
    //     }  
    //     if (whitePawnsInCol > 1) score -= (whitePawnsInCol - 1) * 20;  
    //     if (blackPawnsInCol > 1) score += (blackPawnsInCol - 1) * 20;  
    // }  
  
    // Bono por tener alfiles emparejados  
    let whiteBishops = 0;  
    let blackBishops = 0;  
    board.forEach(row => {  
        row.forEach(piece => {  
            if (piece && piece.type === 'b') {  
                if (piece.color === 'w') whiteBishops++;  
                else blackBishops++;  
            }  
        });  
    });  
    if (whiteBishops >= 2) score += 30;  
    if (blackBishops >= 2) score -= 30;  
  
    // Jaque mate es infinito  
    if (gameState.in_checkmate()) {  
        if (gameState.turn() === 'w') {  
            score = -Infinity;  
        } else {  
            score = Infinity;  
        }  
    } else if (gameState.in_draw() || gameState.in_stalemate() || gameState.in_threefold_repetition() || gameState.insufficient_material()) {  
        score = 0; // Tablas  
    }  
  
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
  
    const moveLimits = { 1: 3, 2: 5, 3: 8, 4: 12, 5: moves.length };  
    const maxMovesToConsider = Math.min(moves.length, moveLimits[difficulty] || moves.length);  
  
    moves.sort((a, b) => {  
        // Ordenamiento mejorado: priorizar capturas de alto valor y movimientos de promoción  
        let scoreA = 0;  
        let scoreB = 0;  
  
        // Valor de la pieza capturada  
        if (a.captured) scoreA += pieceValues[a.captured];  
        if (b.captured) scoreB += pieceValues[b.captured];  
  
        // Valor de la pieza que se mueve (si captura una de menor valor, es menos buena)  
        if (a.captured && pieceValues[a.piece] < pieceValues[a.captured]) scoreA += 50; // Heurística simple  
        if (b.captured && pieceValues[b.piece] < pieceValues[b.captured]) scoreB += 50;  
  
        // Bonificación por promoción  
        if (a.promotion) scoreA += pieceValues[a.promotion];  
        if (b.promotion) scoreB += pieceValues[b.promotion];  
  
        return scoreB - scoreA; // Mayor score primero  
    });  
  
  
    if (isMaximizing) {  
        let maxEval = -Infinity;  
        for (let i = 0; i < maxMovesToConsider; i++) {  
            const move = moves[i];  
            const tempGame = new Chess(gameState.fen());  
            tempGame.move(move);  
  
            const eval = minimax(tempGame, depth - 1, alpha, beta, false, difficulty);  
  
            maxEval = Math.max(maxEval, eval);  
            alpha = Math.max(alpha, eval);  
            if (beta <= alpha) break;  
        }  
        return maxEval;  
    } else {  
        let minEval = Infinity;  
        for (let i = 0; i < maxMovesToConsider; i++) {  
            const move = moves[i];  
            const tempGame = new Chess(gameState.fen());  
            tempGame.move(move);  
  
            const eval = minimax(tempGame, depth - 1, alpha, beta, true, difficulty);  
  
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
  
    let bestMove = null;  
    let bestScore = -Infinity;  
  
    moves.sort((a, b) => {  
        let scoreA = 0;  
        let scoreB = 0;  
  
        if (a.captured) scoreA += pieceValues[a.captured];  
        if (b.captured) scoreB += pieceValues[b.captured];  
  
        if (a.captured && pieceValues[a.piece] < pieceValues[a.captured]) scoreA += 50;  
        if (b.captured && pieceValues[b.piece] < pieceValues[b.captured]) scoreB += 50;  
  
        if (a.promotion) scoreA += pieceValues[a.promotion];  
        if (b.promotion) scoreB += pieceValues[b.promotion];  
  
        return scoreB - scoreA;  
    });  
  
    for (const move of moves) {  
        const tempGame = new Chess(gameState.fen());  
        tempGame.move(move);  
  
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
            let pvForDisplay = [];  
  
            if (moves.length > 0) {  
                // Para el display rápido, usamos findBestMoveWithMinimax con poca profundidad  
                // para obtener una sugerencia más significativa que solo el primer movimiento legal.  
                const bestMoveObj = findBestMoveWithMinimax(new Chess(window.game.fen()), 2, 3); // Profundidad 2, dificultad media  
  
                if (bestMoveObj) {  
                    bestMoveDisplay = bestMoveObj.from + bestMoveObj.to + (bestMoveObj.promotion ? bestMoveObj.promotion : '');  
                    // Para la PV en el display rápido, solo incluimos el mejor movimiento si existe  
                    pvForDisplay.push(bestMoveDisplay);  
                } else {  
                    // Fallback si no se encuentra un mejor movimiento con la mini-búsqueda  
                    bestMoveDisplay = moves[0].from + moves[0].to + (moves[0].promotion ? moves[0].promotion : '');  
                    pvForDisplay.push(bestMoveDisplay);  
                }  
            }  
  
  
            resolve({  
                score: score, // evaluatePositionLocal ya devuelve centipeones  
                bestMove: bestMoveDisplay,  
                depth: depth,  
                pv: pvForDisplay  
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
        const bestMoveValue = result.bestMove ? result.bestMove.slice(0, 4) : 'N/A';  
        const pvDisplay = result.pv && result.pv.length > 0 ? result.pv.join(' ') : 'N/A';  
  
        const currentScoreElem = document.getElementById('currentScoreDisplay');  
        if (currentScoreElem) currentScoreElem.textContent = scoreValue;  
  
        const currentDepthElem = document.getElementById('currentDepthDisplay');  
        if (currentDepthElem) currentDepthElem.textContent = depthValue;  
  
        const bestMoveSuggestionElem = document.getElementById('bestMoveSuggestionDisplay');  
        if (bestMoveSuggestionElem) bestMoveSuggestionElem.textContent = bestMoveValue;  
  
        const currentPVDisplayElem = document.getElementById('currentPVDisplay');  
        if (currentPVDisplayElem) currentPVDisplayElem.textContent = pvDisplay;  
  
        const evalScoreDiv = document.getElementById('evalScore');  
        if (evalScoreDiv) evalScoreDiv.textContent = (result.score / 100).toFixed(1);  
  
        if (typeof window.updateEvalBar === 'function') {  
            window.updateEvalBar(result.score);  
        }  
    } catch (e) {  
        console.error("Error al actualizar la evaluación en el display:", e);  
    }  
}  
  
// ===================== EXPORTAR FUNCIONES GLOBALES =====================  
window.initializeStockfishEngine = initializeStockfishEngine;  
window.getBestMoveStockfish = getBestMoveStockfish;  
window.makeAIMove = makeAIMove;  
window.evaluateWithStockfish = evaluateWithStockfish;  
window.updateEvaluationDisplay = updateEvaluationDisplay;  
window.engineReady = engineReady;  
// Exportar evaluatePositionLocal para que game.js pueda usarla como fallback si es necesario  
window.evaluatePositionLocal = evaluatePositionLocal;  
