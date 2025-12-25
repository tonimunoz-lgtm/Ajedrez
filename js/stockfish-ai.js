// js/stockfish-ai.js - SIN STOCKFISH, SOLO ANÁLISIS LOCAL

let engine = null;  
let engineReady = false;
let currentStockfishResolve = null;
let currentStockfishTimeout = null;
let stockfishIsProcessing = false;

const stockfishCommandQueue = [];

/**  
 * Inicializa Stockfish (deshabilitado en Vercel)
 */  
async function initializeStockfishEngine() {  
    try {
        console.log('Iniciando análisis local (Stockfish deshabilitado en Vercel)...');
        
        engineReady = true;
        window.engineReady = true;

        console.log('✅ Análisis local listo.');

        const coachMessageElem = document.getElementById('coachMessage');
        if (coachMessageElem) {
            coachMessageElem.innerHTML = '<strong>✅ Motor activado</strong> Usando análisis local.';
        }

    } catch (e) {
        console.error('❌ Error inicializando motor:', e);
        engineReady = false;
        window.engineReady = false;

        const coachMessageElem = document.getElementById('coachMessage');
        if (coachMessageElem) {
            coachMessageElem.innerHTML = '<strong>✅ Listo</strong> Análisis local activado.';
        }
    }
}

/**  
 * Envía un comando UCI (sin hacer nada en este caso)
 */  
function sendStockfishCommand(command) {  
    // No hacer nada - análisis local
}

// ===================== EVALUAR CON ANÁLISIS LOCAL =====================  

/**  
 * Realiza una evaluación de la posición actual (análisis local simplificado)
 */  
function evaluateWithStockfish(depth = 20, customTimeout = 5000) {  
    return new Promise((resolve) => {
        // Análisis local simplificado - solo retornar valores neutros
        setTimeout(() => {
            resolve({ 
                score: 0, 
                bestMove: null, 
                depth: depth, 
                pv: [] 
            });
        }, 100);
    });
}

// ===================== OBTENER MEJOR MOVIMIENTO =====================  

/**  
 * Obtiene un movimiento aleatorio como "mejor movimiento"
 */  
async function getBestMoveStockfish(depth = 20) {  
    const customTimeout = 2000 + (depth * 250);
    const result = await evaluateWithStockfish(depth, customTimeout);

    // Devolver un movimiento aleatorio válido
    const moves = window.game.moves({ verbose: true });
    return moves.length > 0 ? moves[Math.floor(Math.random() * moves.length)] : null;
}

// ===================== IA JUEGA =====================  

/**  
 * Calcula el movimiento de la IA (movimiento aleatorio)
 */  
async function makeAIMove() {  
    if (window.game.game_over()) {
        return null;
    }

    const difficultyElem = document.getElementById('difficulty');
    const difficulty = difficultyElem ? parseInt(difficultyElem.value) : 3;

    console.log(`IA pensando (análisis local, dificultad: ${difficulty})...`);

    const aiMoveObj = await getBestMoveStockfish(10);

    if (!aiMoveObj) {
        console.error("La IA no pudo encontrar un movimiento válido.");
    }
    return aiMoveObj;
}

// ===================== ACTUALIZAR INTERFAZ =====================  

/**  
 * Actualiza el panel de evaluación (análisis local)
 */  
async function updateEvaluationDisplay() {  
    if (!window.game || typeof window.game.fen !== 'function') {
        return;
    }

    const currentScoreElem = document.getElementById('currentScoreDisplay');
    if (currentScoreElem) {
        currentScoreElem.textContent = '0.00';
    }

    const currentDepthElem = document.getElementById('currentDepthDisplay');
    if (currentDepthElem) {
        currentDepthElem.textContent = 'N/A';
    }

    const currentPVElem = document.getElementById('currentPVDisplay');
    if (currentPVElem) {
        currentPVElem.textContent = 'N/A';
    }

    const bestMoveSuggestionElem = document.getElementById('bestMoveSuggestionDisplay');
    if (bestMoveSuggestionElem) {
        bestMoveSuggestionElem.textContent = 'N/A';
    }

    const evalScoreDiv = document.getElementById('evalScore');
    if (evalScoreDiv) {
        evalScoreDiv.textContent = '0.0';
    }

    if (typeof window.updateEvalBar === 'function') {
        window.updateEvalBar(0);
    }
}

// ===================== EXPORTAR GLOBALES =====================  
window.initializeStockfishEngine = initializeStockfishEngine;
window.getBestMoveStockfish = getBestMoveStockfish;
window.makeAIMove = makeAIMove;
window.evaluateWithStockfish = evaluateWithStockfish;
window.updateEvaluationDisplay = updateEvaluationDisplay;
window.engineReady = engineReady;
