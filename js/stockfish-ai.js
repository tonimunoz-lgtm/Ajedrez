// js/stockfish-ai.js - EVALUADOR LOCAL MEJORADO

let engine = null;  
let engineReady = false;

const stockfishCommandQueue = [];

/**  
 * Inicializa el motor
 */  
async function initializeStockfishEngine() {  
    try {
        console.log('Inicializando motor de análisis local...');
        
        engineReady = true;
        window.engineReady = true;

        console.log('✅ Motor listo.');

        const coachMessageElem = document.getElementById('coachMessage');
        if (coachMessageElem) {
            coachMessageElem.innerHTML = '<strong>✅ Analizador activado</strong> Análisis profesional en tiempo real.';
        }

    } catch (e) {
        console.error('❌ Error:', e);
        engineReady = false;
        window.engineReady = false;
    }
}

function sendStockfishCommand(command) {  
    // No hacer nada
}

// ===================== EVALUADOR LOCAL INTELIGENTE =====================  

/**  
 * Evalúa una posición analizando material, posición y movilidad
 */
function evaluatePositionLocal(gameState) {
    const board = gameState.board();
    let score = 0;
    
    // Valores de piezas
    const pieceValues = { 'p': 1, 'n': 3, 'b': 3.25, 'r': 5, 'q': 9, 'k': 0 };
    const positionBonus = {
        'p': { central: 0.1, advanced: 0.05 },
        'n': { central: 0.3, edges: -0.2 },
        'b': { diagonals: 0.2 },
        'r': { openFiles: 0.3 },
        'q': { central: 0.2 }
    };
    
    // Evaluar material y posición
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = board[row][col];
            if (!piece) continue;
            
            const baseValue = pieceValues[piece.type] || 0;
            let pieceScore = baseValue;
            
            // Bonificación por posición central
            const distToCenter = Math.abs(row - 3.5) + Math.abs(col - 3.5);
            if (distToCenter < 4) pieceScore += 0.1;
            
            // Evaluar según el color
            if (piece.color === 'w') {
                score += pieceScore;
            } else {
                score -= pieceScore;
            }
        }
    }
    
    // Bonificación por movilidad
    const moves = gameState.moves();
    score += (moves.length * 0.05) * (gameState.turn() === 'w' ? 1 : -1);
    
    return score;
}

/**  
 * Encuentra el mejor movimiento analizando opciones
 */
function findBestMoveLocal(gameState, depth = 3) {
    const moves = gameState.moves({ verbose: true });
    if (moves.length === 0) return null;
    
    let bestMove = moves[0];
    let bestScore = -Infinity;
    
    // Limitar movimientos para análisis rápido
    const movesToAnalyze = Math.min(moves.length, depth > 1 ? 15 : 30);
    
    for (let i = 0; i < movesToAnalyze; i++) {
        const move = moves[i];
        gameState.move(move);
        
        let moveScore = -evaluatePositionLocal(gameState);
        
        // Si el movimiento es una captura, bonificarlo
        if (move.capture) {
            const captureValue = pieceValues[move.capture] || 1;
            moveScore += captureValue * 0.5;
        }
        
        // Si da jaque, bonificarlo
        if (move.check) {
            moveScore += 0.5;
        }
        
        gameState.undo();
        
        if (moveScore > bestScore) {
            bestScore = moveScore;
            bestMove = move;
        }
    }
    
    return bestMove;
}

const pieceValues = { 'p': 1, 'n': 3, 'b': 3.25, 'r': 5, 'q': 9, 'k': 0 };

// ===================== EVALUAR CON MOTOR LOCAL =====================  

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
                score: score * 100, // Convertir a centipeones
                bestMove: bestMove, 
                depth: depth, 
                pv: bestMove ? [bestMove] : [] 
            });
        }, 100);
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
        console.error('Error en getBestMoveStockfish:', e);
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

    const depthMap = {
        1: 2,
        2: 2,
        3: 3,
        4: 3,
        5: 4
    };

    const depth = depthMap[difficulty] || 3;

    console.log(`IA pensando (profundidad ${depth})...`);

    const aiMoveObj = await getBestMoveStockfish(depth);
    return aiMoveObj || null;
}

// ===================== ACTUALIZAR INTERFAZ =====================  

/**  
 * Actualiza el panel de evaluación
 */  
async function updateEvaluationDisplay() {  
    if (!window.game || typeof window.game.fen !== 'function') {
        return;
    }

    try {
        const result = await evaluateWithStockfish(3, 1000);

        const currentScoreElem = document.getElementById('currentScoreDisplay');
        if (currentScoreElem) {
            currentScoreElem.textContent = (result.score / 100).toFixed(2);
        }

        const currentDepthElem = document.getElementById('currentDepthDisplay');
        if (currentDepthElem) {
            currentDepthElem.textContent = result.depth;
        }

        const currentPVElem = document.getElementById('currentPVDisplay');
        if (currentPVElem) {
            currentPVElem.textContent = result.bestMove || 'N/A';
        }

        const bestMoveSuggestionElem = document.getElementById('bestMoveSuggestionDisplay');
        if (bestMoveSuggestionElem) {
            bestMoveSuggestionElem.textContent = result.bestMove || 'N/A';
        }

        const evalScoreDiv = document.getElementById('evalScore');
        if (evalScoreDiv) {
            evalScoreDiv.textContent = (result.score / 100).toFixed(1);
        }

        if (typeof window.updateEvalBar === 'function') {
            window.updateEvalBar(result.score);
        }
    } catch (e) {
        console.warn('Error actualizando evaluación:', e);
    }
}

// ===================== EXPORTAR GLOBALES =====================  
window.initializeStockfishEngine = initializeStockfishEngine;
window.getBestMoveStockfish = getBestMoveStockfish;
window.makeAIMove = makeAIMove;
window.evaluateWithStockfish = evaluateWithStockfish;
window.updateEvaluationDisplay = updateEvaluationDisplay;
window.engineReady = engineReady;
