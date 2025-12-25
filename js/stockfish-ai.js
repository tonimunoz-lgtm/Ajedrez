let engineReady = false;  
let minimaxWorker; // Declarar el Web Worker  
  
// ===================== VALORES GLOBALES DE PIEZAS (Se mantiene aquí por consistencia, aunque el worker tiene su copia) =====================  
const pieceValues = { 'p': 100, 'n': 320, 'b': 330, 'r': 500, 'q': 900, 'k': 0 };  
  
/**  
 * Inicializa el motor  
 */  
async function initializeStockfishEngine() {  
    try {  
        console.log('Inicializando analizador de ajedrez...');  
  
        // Inicializar el Web Worker  
        minimaxWorker = new Worker('/js/minimax-worker.js');  
        console.log('Web Worker para Minimax iniciado.');  
  
        engineReady = true;  
        window.engineReady = true; // Exportar globalmente para game.js  
  
        console.log('✅ Analizador listo.');  
  
        const coachMessageElem = document.getElementById('coachMessage');  
        if (coachMessageElem) {  
            coachMessageElem.innerHTML = '<strong>✅ Motor activado</strong> Analizador profesional en funcionamiento.';  
        }  
  
    } catch (e) {  
        console.error('❌ Error al inicializar el analizador o el Web Worker:', e);  
        engineReady = false;  
        window.engineReady = false;  
    }  
}  
  
// ===================== EVALUADOR LOCAL INTELIGENTE (Se mantiene para fallback o uso directo en hilo principal si aplica) =====================  
// NOTA: Esta función se ejecuta en el hilo principal. El worker tiene su propia copia.  
function evaluatePositionLocal(gameState) {  
    const board = gameState.board();  
    let score = 0;  
  
    // pieceValues ya está definido globalmente arriba  
  
    const pawnPositional = [  
        [0, 0, 0, 0, 0, 0, 0, 0], [50, 50, 50, 50, 50, 50, 50, 50], [10, 10, 20, 30, 30, 20, 10, 10], [5, 5, 10, 25, 25, 10, 5, 5],  
        [0, 0, 0, 20, 20, 0, 0, 0], [5, -5, -10, 0, 0, -10, -5, 5], [5, 10, 10, -20, -20, 10, 10, 5], [0, 0, 0, 0, 0, 0, 0, 0]  
    ];  
    const knightPositional = [  
        [-50, -40, -30, -30, -30, -30, -40, -50], [-40, -20, 0, 0, 0, 0, -20, -40], [-30, 0, 10, 15, 15, 10, 0, -30], [-30, 5, 15, 20, 20, 15, 5, -30],  
        [-30, 0, 15, 20, 20, 15, 0, -30], [-30, 5, 10, 15, 15, 10, 5, -30], [-40, -20, 0, 5, 5, 0, -20, -40], [-50, -40, -30, -30, -30, -30, -40, -50]  
    ];  
    const bishopPositional = [  
        [-20, -10, -10, -10, -10, -10, -10, -20], [-10, 0, 0, 0, 0, 0, 0, -10], [-10, 0, 5, 10, 10, 5, 0, -10], [-10, 5, 5, 10, 10, 5, 5, -10],  
        [-10, 0, 10, 10, 10, 10, 0, -10], [-10, 10, 10, 10, 10, 10, 10, -10], [-10, 5, 0, 0, 0, 0, 5, -10], [-20, -10, -10, -10, -10, -10, -10, -20]  
    ];  
    const rookPositional = [  
        [0, 0, 0, 0, 0, 0, 0, 0], [5, 10, 10, 10, 10, 10, 10, 5], [-5, 0, 0, 0, 0, 0, 0, -5], [-5, 0, 0, 0, 0, 0, 0, -5],  
        [-5, 0, 0, 0, 0, 0, 0, -5], [-5, 0, 0, 0, 0, 0, 0, -5], [-5, 0, 0, 0, 0, 0, 0, -5], [0, 0, 0, 5, 5, 0, 0, 0]  
    ];  
    const queenPositional = [  
        [-20, -10, -10, -5, -5, -10, -10, -20], [-10, 0, 0, 0, 0, 0, 0, -10], [-10, 0, 5, 5, 5, 5, 0, -10], [-5, 0, 5, 5, 5, 5, 0, -5],  
        [0, 0, 5, 5, 5, 5, 0, -5], [-10, 5, 5, 5, 5, 5, 0, -10], [-10, 0, 0, 0, 0, 0, 0, -10], [-20, -10, -10, -5, -5, -10, -10, -20]  
    ];  
    const kingPositional = [  
        [-30, -40, -40, -50, -50, -40, -40, -30], [-30, -40, -40, -50, -50, -40, -40, -30], [-30, -40, -40, -50, -50, -40, -40, -30], [-30, -40, -40, -50, -50, -40, -40, -30],  
        [-20, -30, -30, -40, -40, -30, -30, -20], [-10, -20, -20, -20, -20, -20, -20, -10], [20, 20, 0, 0, 0, 0, 20, 20], [20, 30, 10, 0, 0, 10, 30, 20]  
    ];  
    const kingEndgamePositional = [  
        [-50, -40, -30, -20, -20, -30, -40, -50], [-30, -20, -10, 0, 0, -10, -20, -30], [-30, -10, 20, 30, 30, 20, -10, -30], [-30, -10, 30, 40, 40, 30, -10, -30],  
        [-30, -10, 30, 40, 40, 30, -10, -30], [-30, -10, 20, 30, 30, 20, -10, -30], [-30, -30, 0, 0, 0, 0, -30, -30], [-50, -30, -30, -30, -30, -30, -30, -50]  
    ];  
  
    let majorMinorPiecesCount = 0;  
    board.forEach(row => {  
        row.forEach(piece => {  
            if (piece && ['q', 'r', 'b', 'n'].includes(piece.type)) {  
                majorMinorPiecesCount++;  
            }  
        });  
    });  
    const isEndgame = majorMinorPiecesCount <= 8;  
  
    for (let rowIdx = 0; rowIdx < 8; rowIdx++) {  
        for (let colIdx = 0; colIdx < 8; colIdx++) {  
            const square = String.fromCharCode(97 + colIdx) + (8 - rowIdx);  
            const piece = gameState.get(square);  
  
            if (!piece) continue;  
  
            let pieceScore = pieceValues[piece.type];  
            let positionalScore = 0;  
  
            const actualRow = piece.color === 'w' ? rowIdx : 7 - rowIdx;  
            const actualCol = colIdx;  
  
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
  
    score += (gameState.moves().length * 10) * (gameState.turn() === 'w' ? 1 : -1);  
  
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
  
    if (gameState.in_checkmate()) {  
        if (gameState.turn() === 'w') {  
            score = -Infinity;  
        } else {  
            score = Infinity;  
        }  
    } else if (gameState.in_draw() || gameState.in_stalemate() || gameState.in_threefold_repetition() || gameState.insufficient_material()) {  
        score = 0;  
    }  
  
    return score;  
}  
  
// Las funciones minimax y findBestMoveWithMinimax se han movido al worker.  
// Ahora estas funciones en stockfish-ai.js serán wrappers que usan el worker.  
  
/**  
 * Función genérica para enviar tareas al worker y obtener una promesa con el resultado.  
 * @param {string} type - Tipo de tarea (e.g., 'findBestMove', 'evaluatePosition').  
 * @param {string} fen - El FEN de la posición actual.  
 * @param {number} depth - Profundidad de búsqueda.  
 * @param {number} difficulty - Nivel de dificultad.  
 * @returns {Promise<Object>} Promesa que resuelve con el resultado del worker.  
 */  
function sendToMinimaxWorker(type, fen, depth, difficulty) {  
    return new Promise((resolve, reject) => {  
        if (!minimaxWorker) {  
            reject(new Error("Minimax worker not initialized."));  
            return;  
        }  
  
        const taskId = Math.random().toString(36).substring(7); // Generar un ID único para la tarea  
  
        const messageHandler = (event) => {  
            if (event.data.taskId === taskId) {  
                minimaxWorker.removeEventListener('message', messageHandler); // Eliminar el listener después de usarlo  
                resolve(event.data.result);  
            }  
        };  
  
        minimaxWorker.addEventListener('message', messageHandler);  
  
        minimaxWorker.postMessage({ type, fen, depth, difficulty, taskId });  
  
        // Opcional: un timeout para la promesa en caso de que el worker no responda  
        setTimeout(() => {  
            minimaxWorker.removeEventListener('message', messageHandler);  
            reject(new Error(`Minimax worker timeout for task ${taskId}`));  
        }, 30000); // 30 segundos de timeout  
    });  
}  
  
  
// ===================== EVALUAR (PARA DISPLAY RÁPIDO) =====================  
  
/**  
 * Evalúa una posición. Si la profundidad es baja, usa la evaluación local.  
 * Si la profundidad es alta (ej. para análisis), usa el Web Worker para Minimax.  
 */  
async function evaluateWithStockfish(depth = 2, customTimeout = 300) {  
    if (!window.game || typeof window.game.fen !== 'function') {  
        return { score: 0, bestMove: null, depth: 0, pv: [] };  
    }  
  
    // Para el display rápido (profundidad baja), podemos usar el worker con un tipo 'evaluatePosition'  
    // o incluso solo evaluatePositionLocal en el hilo principal si queremos EVITAR la comunicación con el worker  
    // para cada updateEvaluationDisplay. Sin embargo, para la consistencia, usaremos el worker.  
    const fen = window.game.fen();  
    let result;  
  
    if (depth <= 2 && customTimeout < 1000) { // Si es una llamada para display rápido  
        // Podemos enviar una tarea de evaluación simple al worker  
        result = await sendToMinimaxWorker('evaluatePosition', fen, 0, 0); // depth/difficulty no aplican tanto aquí  
    } else { // Si es una llamada para análisis profundo o IA  
        result = await sendToMinimaxWorker('findBestMove', fen, depth, 3); // Dificultad 3 por defecto para análisis  
    }  
  
    return result;  
}  
  
// ===================== OBTENER MEJOR MOVIMIENTO =====================  
  
async function getBestMoveStockfish(depth = 20) {  
    // Esta función ahora también utilizará el worker a través de evaluateWithStockfish  
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
  
// ===================== IA JUEGA (USA MINIMAX CON WORKER) =====================  
  
async function makeAIMove() {  
    if (window.game.game_over()) {  
        return null;  
    }  
  
    const difficultyElem = document.getElementById('difficulty');  
    const difficulty = difficultyElem ? parseInt(difficultyElem.value) : 3;  
  
    const depthMap = { 1: 2, 2: 3, 3: 4, 4: 5, 5: 6 };  
    const depth = depthMap[difficulty] || 4;  
  
    console.log(`IA nivel ${difficulty} (profundidad ${depth})...`);  
  
    try {  
        const result = await sendToMinimaxWorker('findBestMove', window.game.fen(), depth, difficulty);  
          
        if (result && result.bestMove) {  
            const from = result.bestMove.substring(0, 2);  
            const to = result.bestMove.substring(2, 4);  
            const promotion = result.bestMove.length > 4 ? result.bestMove[4].toLowerCase() : undefined;  
            // Retornamos el objeto de movimiento que Chess.js espera para game.move()  
            return { from, to, promotion, san: result.bestMove }; // Añadimos san para que coincida con verbose:true  
        } else {  
            console.warn("Worker no retornó un bestMove válido. Jugando aleatorio.");  
            const moves = window.game.moves({ verbose: true });  
            return moves.length > 0 ? moves[Math.floor(Math.random() * moves.length)] : null;  
        }  
    } catch (e) {  
        console.error("Error al obtener movimiento de la IA del worker:", e);  
        // Fallback a movimiento aleatorio en caso de error del worker  
        const moves = window.game.moves({ verbose: true });  
        return moves.length > 0 ? moves[Math.floor(Math.random() * moves.length)] : null;  
    }  
}  
  
// ===================== ACTUALIZAR INTERFAZ =====================  
  
async function updateEvaluationDisplay() {  
    if (!window.game || typeof window.game.fen !== 'function') {  
        return;  
    }  
  
    try {  
        // Ahora evaluateWithStockfish usa el worker para evaluaciones rápidas.  
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
window.evaluatePositionLocal = evaluatePositionLocal; // Exportar también para el fallback del análisis  
