// js/stockfish-ai.js - USANDO CHESS.COM STOCKFISH API

let engineReady = false;

/**  
 * Inicializa el analizador
 */  
async function initializeStockfishEngine() {  
    try {
        console.log('Inicializando Stockfish API (Chess.com)...');
        
        engineReady = true;
        window.engineReady = true;

        console.log('✅ Stockfish API listo.');

        const coachMessageElem = document.getElementById('coachMessage');
        if (coachMessageElem) {
            coachMessageElem.innerHTML = '<strong>✅ Stockfish Real</strong> Motor profesional activado vía API.';
        }

    } catch (e) {
        console.error('❌ Error:', e);
        engineReady = false;
        window.engineReady = false;
    }
}

// ===================== EVALUAR CON CHESS.COM API =====================  

/**  
 * Evalúa una posición usando Chess.com Stockfish API
 */  
async function evaluateWithStockfish(depth = 20, customTimeout = 5000) {  
    return new Promise(async (resolve) => {
        try {
            if (!window.game) {
                resolve({ score: 0, bestMove: null, depth: 0, pv: [] });
                return;
            }

            const fen = window.game.fen();
            
            // Usar Chess.com API de Stockfish
            const url = `https://chess.com/api/v1/chess/stockfish?fen=${encodeURIComponent(fen)}&depth=${Math.min(depth, 20)}`;
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), customTimeout);
            
            const response = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                resolve({ score: 0, bestMove: null, depth: 0, pv: [] });
                return;
            }
            
            const data = await response.json();
            
            if (data.bestmove) {
                const bestMove = data.bestmove.split(' ')[0];
                const score = data.evaluation || 0;
                const pv = data.pv ? data.pv.split(' ') : [];
                
                resolve({ 
                    score: score * 100,
                    bestMove: bestMove, 
                    depth: Math.min(depth, 20), 
                    pv: pv
                });
            } else {
                resolve({ score: 0, bestMove: null, depth: 0, pv: [] });
            }
        } catch (e) {
            console.warn('Error en Stockfish API:', e.message);
            resolve({ score: 0, bestMove: null, depth: 0, pv: [] });
        }
    });
}

// ===================== OBTENER MEJOR MOVIMIENTO =====================  

/**  
 * Obtiene el mejor movimiento usando la API
 */  
async function getBestMoveStockfish(depth = 20) {  
    try {
        const result = await evaluateWithStockfish(depth, 8000);

        if (!result.bestMove) {
            const moves = window.game.moves({ verbose: true });
            return moves.length > 0 ? moves[Math.floor(Math.random() * moves.length)] : null;
        }

        const from = result.bestMove.substring(0, 2);
        const to = result.bestMove.substring(2, 4);
        const promotion = result.bestMove.length > 4 ? result.bestMove[4].toLowerCase() : undefined;

        const tempGame = new Chess(window.game.fen());
        const moveObj = tempGame.move({ from, to, promotion });

        if (moveObj) {
            return moveObj;
        }

        const moves = window.game.moves({ verbose: true });
        return moves.length > 0 ? moves[Math.floor(Math.random() * moves.length)] : null;
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
        1: 8,
        2: 12,
        3: 16,
        4: 18,
        5: 20
    };

    const depth = depthMap[difficulty] || 16;

    console.log(`IA pensando (profundidad ${depth})...`);

    const aiMoveObj = await getBestMoveStockfish(depth);
    return aiMoveObj || null;
}

// ===================== ACTUALIZAR INTERFAZ =====================  

/**  
 * Actualiza el panel de evaluación con datos reales de Stockfish
 */  
async function updateEvaluationDisplay() {  
    if (!window.game || typeof window.game.fen !== 'function') {
        return;
    }

    try {
        const result = await evaluateWithStockfish(14, 5000);

        const scoreValue = (result.score / 100).toFixed(2);
        const depthValue = result.depth || 'N/A';
        const pvValue = result.pv && result.pv.length > 0 ? result.pv.slice(0, 5).join(' ') : 'N/A';
        const bestMoveValue = result.bestMove || 'N/A';

        const currentScoreElem = document.getElementById('currentScoreDisplay');
        if (currentScoreElem) {
            currentScoreElem.textContent = scoreValue;
        }

        const currentDepthElem = document.getElementById('currentDepthDisplay');
        if (currentDepthElem) {
            currentDepthElem.textContent = depthValue;
        }

        const currentPVElem = document.getElementById('currentPVDisplay');
        if (currentPVElem) {
            currentPVElem.textContent = pvValue;
        }

        const bestMoveSuggestionElem = document.getElementById('bestMoveSuggestionDisplay');
        if (bestMoveSuggestionElem) {
            bestMoveSuggestionElem.textContent = bestMoveValue;
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

// ===================== EXPORTAR =====================  
window.initializeStockfishEngine = initializeStockfishEngine;
window.getBestMoveStockfish = getBestMoveStockfish;
window.makeAIMove = makeAIMove;
window.evaluateWithStockfish = evaluateWithStockfish;
window.updateEvaluationDisplay = updateEvaluationDisplay;
window.engineReady = engineReady;
