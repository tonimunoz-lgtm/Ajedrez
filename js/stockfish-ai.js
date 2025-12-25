let engineReady = false;  
  
/**  
 * Inicializa el motor  
 */  
async function initializeStockfishEngine() {  
    try {  
        console.log('Inicializando analizador de ajedrez...');  
  
        // NOTA: Esta parte se refiere a la inicialización de TU LÓGICA de IA.  
        // Si quisieras usar el binario real de Stockfish (stockfish.js),  
        // necesitarías más código aquí para interactuar con él.  
        // Por ahora, solo indicamos que tu "motor" de IA local está listo.  
  
        engineReady = true;  
        window.engineReady = true; // Exportar globalmente para game.js  
  
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
 * Un evaluador más sofisticado para mejorar la IA sin aumentar demasiado la profundidad.  
 * @param {Object} gameState - La instancia de Chess.js del estado actual del juego.  
 * @returns {number} La puntuación de la posición en centipeones (positivo para blancas, negativo para negras).  
 */  
function evaluatePositionLocal(gameState) {  
    const board = gameState.board();  
    let score = 0;  
  
    // Valores base de las piezas en centipeones  
    const pieceValues = { 'p': 100, 'n': 320, 'b': 330, 'r': 500, 'q': 900, 'k': 0 };  
  
    // Tablas de valores posicionales (ejemplo simplificado)  
    // Se pueden encontrar tablas más completas en línea (ej. Stockfish, Chess Programming Wiki)  
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
    // Contamos el número de piezas mayores (Reina, Torre, Alfil, Caballo)  
    let majorMinorPiecesCount = 0;  
    board.forEach(row => {  
        row.forEach(piece => {  
            if (piece && ['q', 'r', 'b', 'n'].includes(piece.type)) {  
                majorMinorPiecesCount++;  
            }  
        });  
    });  
    const isEndgame = majorMinorPiecesCount <= 8; // Arbitrario: si quedan 8 o menos piezas mayores/menores, es final de juego.  
  
    // Iterar sobre cada cuadrado del tablero  
    for (let rowIdx = 0; rowIdx < 8; rowIdx++) {  
        for (let colIdx = 0; colIdx < 8; colIdx++) {  
            const square = String.fromCharCode(97 + colIdx) + (8 - rowIdx);  
            const piece = gameState.get(square);  
  
            if (!piece) continue;  
  
            let pieceScore = pieceValues[piece.type];  
            let positionalScore = 0;  
  
            // Ajustar la fila para la perspectiva del color (blancas 0-7, negras 7-0)  
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
    // Dar un pequeño bono por tener más movimientos legales  
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
    //     if (whitePawnsInCol > 1) score -= (whitePawnsInCol - 1) * 20; // 20 centipeones por peón doblado extra  
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
    if (whiteBishops >= 2) score += 30; // 30 centipeones por alfiles emparejados  
    if (blackBishops >= 2) score -= 30;  
  
    // Jaque mate es infinito  
    if (gameState.in_checkmate()) {  
        if (gameState.turn() === 'w') { // Negras acaban de dar jaque mate  
            score = -Infinity;  
        } else { // Blancas acaban de dar jaque mate  
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
    const moveLimits = { 1: 3, 2: 5, 3: 8, 4: 12, 5: moves.length }; // Limita los N mejores movimientos a considerar  
    const maxMovesToConsider = Math.min(moves.length, moveLimits[difficulty] || moves.length);  
  
    // Ordenar movimientos heurísticamente (crucial para la eficiencia de la poda alfa-beta)  
    // Aquí puedes implementar una función de ordenamiento más inteligente (ej. movimientos de captura, jaques)  
    // Para simplificar, una ordenación basada en el "valor" de la pieza involucrada o destino puede ser un inicio.  
    // Una ordenación alfabética simple no es la más eficiente para alfa-beta.  
    moves.sort((a, b) => {  
        // Simple ordenamiento: priorizar capturas  
        const valA = a.captured ? pieceValues[a.captured] : 0;  
        const valB = b.captured ? pieceValues[b.captured] : 0;  
        return valB - valA; // Mayor valor de captura primero  
    });  
  
  
    if (isMaximizing) {  
        let maxEval = -Infinity;  
        for (let i = 0; i < maxMovesToConsider; i++) {  
            const move = moves[i];  
            const tempGame = new Chess(gameState.fen()); // Usar new Chess(fen) para copiar el estado  
            tempGame.move(move);  
  
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
            const tempGame = new Chess(gameState.fen()); // Usar new Chess(fen) para copiar el estado  
            tempGame.move(move);  
  
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
  
    // Ordenar movimientos heurísticamente para ayudar a la poda alfa-beta  
    moves.sort((a, b) => {  
        const valA = a.captured ? pieceValues[a.captured] : 0;  
        const valB = b.captured ? pieceValues[b.captured] : 0;  
        return valB - valA;  
    });  
  
    for (const move of moves) {  
        const tempGame = new Chess(gameState.fen()); // Usar new Chess(fen) para copiar el estado  
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
  
            // Realiza una evaluación local de la posición actual  
            const score = evaluatePositionLocal(window.game);  
            const moves = window.game.moves({ verbose: true });  
            let bestMoveDisplay = null;  
            let pvForDisplay = [];  
  
            if (moves.length > 0) {  
                // Para el display rápido, podemos hacer una mini-búsqueda de un solo movimiento  
                // o simplemente mostrar el primer movimiento legal como un placeholder.  
                // Aquí, para mejorar un poco la sugerencia, podemos usar findBestMoveWithMinimax  
                // con una profundidad muy superficial (ej. profundidad 1 o 2)  
                const bestMoveObj = findBestMoveWithMinimax(new Chess(window.game.fen()), 1, 3); // Profundidad 1, dificultad media  
  
                if (bestMoveObj) {  
                    bestMoveDisplay = bestMoveObj.from + bestMoveObj.to + (bestMoveObj.promotion ? bestMoveObj.promotion : '');  
                    // Para la PV en el display rápido, solo incluimos el mejor movimiento si existe  
                    pvForDisplay.push(bestMoveDisplay);  
                } else {  
                     // Si no se encuentra un mejor movimiento (por ejemplo, sin movimientos legales),  
                    // toma el primer movimiento disponible como fallback para el display.  
                    bestMoveDisplay = moves[0].from + moves[0].to + (moves[0].promotion ? moves[0].promotion : '');  
                    pvForDisplay.push(bestMoveDisplay);  
                }  
            }  
  
  
            resolve({  
                score: score, // evaluatePositionLocal ya devuelve centipeones  
                bestMove: bestMoveDisplay,  
                depth: depth, // Esto es más una referencia que una profundidad real de búsqueda aquí  
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
  
    // Pasar una COPIA del estado del juego a findBestMoveWithMinimax  
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
        const result = await evaluateWithStockfish(2, 300); // Llamada rápida para el display  
  
        // score ya viene en centipeones de evaluatePositionLocal  
        const scoreValue = (result.score / 100).toFixed(2);  
        const depthValue = result.depth;  
        const bestMoveValue = result.bestMove ? result.bestMove.slice(0, 4) : 'N/A'; // Muestra solo from/to  
        const pvDisplay = result.pv && result.pv.length > 0 ? result.pv.join(' ') : 'N/A';  
  
        const currentScoreElem = document.getElementById('currentScoreDisplay');  
        if (currentScoreElem) currentScoreElem.textContent = scoreValue;  
  
        const currentDepthElem = document.getElementById('currentDepthDisplay');  
        if (currentDepthElem) currentDepthElem.textContent = depthValue;  
  
        const bestMoveSuggestionElem = document.getElementById('bestMoveSuggestionDisplay');  
        if (bestMoveSuggestionElem) bestMoveSuggestionElem.textContent = bestMoveValue;  
  
        const currentPVDisplayElem = document.getElementById('currentPVDisplay'); // Nuevo ID para la PV  
        if (currentPVDisplayElem) currentPVDisplayElem.textContent = pvDisplay;  
  
        const evalScoreDiv = document.getElementById('evalScore');  
        if (evalScoreDiv) evalScoreDiv.textContent = (result.score / 100).toFixed(1); // En peones para la barra  
  
        if (typeof window.updateEvalBar === 'function') {  
            window.updateEvalBar(result.score); // Pasar score en centipeones  
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
