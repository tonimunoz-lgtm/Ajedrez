// js/stockfish-ai.js (VERSIÓN CORREGIDA PARA ELIMINAR EL ERROR postMessage)  
  
// ===================== STOCKFISH - MOTOR REAL =====================    
// Variables globales para el manejo del motor Stockfish    
let engine = null;    
let engineReady = false;  
let currentStockfishResolve = null;  
let currentStockfishTimeout = null;  
let stockfishIsProcessing = false;  
  
// La cola no se está utilizando actualmente en este código, pero la mantengo si planeas usarla.  
// const stockfishCommandQueue = [];   
  
/**    
 * Listener global para todos los mensajes que Stockfish envía.  
 */    
function stockfishMessageListener(message) {    
    const data = typeof message === 'string' ? message : message.data;    
  
    if (data === 'readyok') {    
        console.log('✅ Stockfish reporta readyok.');    
        // Tras readyok, podemos estar seguros de que el worker está listo para UCI  
        // y habilitar el engineReady, aunque ya lo hacemos en initializeStockfishEngine  
        // si la creación del worker fue exitosa.  
    }  
    // NOTA: La lógica de 'bestmove' no debería estar aquí en el listener global.  
    // Debería ser manejada por el listener temporal dentro de evaluateWithStockfish  
    // para evitar race conditions y asegurar que la promesa correcta se resuelve.  
    // Si tu stockfish.js expone StockfishMv como un objeto Worker ya instanciado,  
    // o si el listener global es el único que Stockfish usa, esto podría ser diferente.  
    // Por ahora, asumimos que evaluateWithStockfish gestionará su propio bestmove.  
}  
  
/**    
 * Inicializa el motor Stockfish. Debe llamarse después de que 'stockfish.js'    
 * se haya cargado y el DOM esté listo (DOMContentLoaded).  
 */    
async function initializeStockfishEngine() {    
    try {  
        console.log('Iniciando Stockfish...');  
        console.log('Tipo de window.StockfishMv:', typeof window.StockfishMv);  
          
        // Esperar a que StockfishMv esté listo (si es un objeto con una promesa .ready)  
        if (window.StockfishMv && window.StockfishMv.ready) {  
            console.log('Esperando a que Stockfish.ready se resuelva...');  
            await window.StockfishMv.ready;  
        }  
          
        // CORRECCIÓN CLAVE: Instanciar el Worker.  
        // Asumiendo que window.StockfishMv es una clase/función constructora para un Web Worker.  
        // Si no funciona con 'new', prueba con 'engine = window.StockfishMv();'  
        if (typeof window.StockfishMv === 'function') {  
            // La forma más común de obtener un Worker si StockfishMv es un constructor.  
            engine = new window.StockfishMv();   
            console.log('✅ Instancia de Stockfish Worker creada con "new".');  
        } else if (window.StockfishMv && typeof window.StockfishMv.postMessage === 'function') {  
            // Si StockfishMv ya es una instancia de Worker directamente.  
            engine = window.StockfishMv;  
            console.log('✅ StockfishMv ya es una instancia de Worker.');  
        } else {  
            throw new Error('window.StockfishMv no es una función constructora ni una instancia de Worker válida.');  
        }  
          
        if (!engine || typeof engine.postMessage !== 'function') {  
            throw new Error('El objeto "engine" no es una instancia de Worker válida o no tiene el método postMessage.');  
        }  
  
        console.log('✅ Motor Stockfish obtenido y verificado:', typeof engine);  
  
        // Asignar el listener global inmediatamente  
        engine.onmessage = stockfishMessageListener;  
  
        // Establecer engineReady a true una vez que el worker esté creado y configurado  
        engineReady = true;  
        window.engineReady = true; // Para acceso global si es necesario  
  
        console.log('✅ Stockfish WASM cargado y listo.');  
  
        const coachMessageElem = document.getElementById('coachMessage');  
        if (coachMessageElem) {  
            coachMessageElem.innerHTML = '<strong>✅ Stockfish Real</strong> Motor profesional activado.';  
        }  
  
        // Comandos UCI iniciales para configurar el motor  
        sendStockfishCommand('uci');  
        sendStockfishCommand('isready');  
        sendStockfishCommand('ucinewgame');  
  
    } catch (e) {  
        console.error('❌ Error inicializando Stockfish:', e);  
        engineReady = false;  
        window.engineReady = false;  
  
        const coachMessageElem = document.getElementById('coachMessage');  
        if (coachMessageElem) {  
            coachMessageElem.innerHTML = '<strong>⚠️ Stockfish No Disponible</strong> Usando análisis local. Error: ' + e.message;  
        }  
    }  
}  
  
/**    
 * Envía un comando UCI al motor Stockfish de forma segura.  
 */    
function sendStockfishCommand(command) {    
    // Asegurarse de que el engine sea una instancia de Worker válida  
    if (!engine || typeof engine.postMessage !== 'function') {  
        // Solo advertir si engineReady es true, lo que indicaría un problema después de la inicialización.  
        // Si engineReady es false, la inicialización falló y ya hay un error/advertencia.  
        if (engineReady) {  
            console.warn(`Stockfish no está listo o engine.postMessage no es una función para el comando: "${command}".`);  
        }  
        return;  
    }  
      
    //console.log('Enviando comando:', command); // Descomentar para depurar comandos  
    engine.postMessage(command);  
}  
  
// ===================== EVALUAR CON STOCKFISH REAL =====================    
  
/**    
 * Realiza una evaluación de la posición actual del juego usando Stockfish.  
 * @param {number} depth - Profundidad de búsqueda.  
 * @param {number} customTimeout - Tiempo máximo de búsqueda en milisegundos.  
 * @returns {Promise<{score: number, bestMove: string|null, depth: number, pv: string[]}>}  
 */    
function evaluateWithStockfish(depth = 20, customTimeout = 5000) {    
    return new Promise((resolve) => {  
        // Asegurarse de que el engine sea una instancia de Worker válida ANTES de procesar.  
        if (!engineReady || !engine || typeof engine.postMessage !== 'function') {  
            console.warn('Stockfish no está listo o no es un Worker válido para evaluar.');  
            resolve({ score: 0, bestMove: null, depth: 0, pv: [] });  
            return;  
        }  
  
        if (stockfishIsProcessing) {  
            console.warn("Stockfish ya está procesando. Ignorando nueva solicitud.");  
            resolve({ score: 0, bestMove: null, depth: 0, pv: [] });  
            return;  
        }  
  
        let currentScore = 0;  
        let currentDepth = 0;  
        let currentPv = [];  
        let currentBestMove = null;  
        let evaluationDone = false; // Flag para asegurar que la resolución ocurre una sola vez  
  
        stockfishIsProcessing = true; // Marcar que Stockfish está ocupado  
  
        // Guardar el listener original para restaurarlo después  
        const originalOnMessage = engine.onmessage;  
  
        // Función para resolver la promesa y limpiar  
        const resolveAndCleanup = (result) => {  
            if (!evaluationDone) {  
                clearTimeout(currentStockfishTimeout);  
                engine.onmessage = originalOnMessage; // Restaurar el listener original  
                stockfishIsProcessing = false;  
                currentStockfishResolve = null; // Limpiar la referencia de resolución  
                evaluationDone = true;  
                resolve(result);  
            }  
        };  
  
        // Configurar el timeout para detener la búsqueda si lleva demasiado tiempo  
        currentStockfishTimeout = setTimeout(() => {  
            console.warn('Stockfish timeout. Forzando detención y resolución.');  
            sendStockfishCommand('stop'); // Detener la búsqueda  
            // Resuelve con los mejores datos obtenidos hasta el momento  
            resolveAndCleanup({ bestMove: currentBestMove, score: currentScore, depth: currentDepth, pv: currentPv });  
        }, customTimeout);  
  
        // Este resolver se usará cuando se reciba el 'bestmove'  
        // Lo vinculamos directamente a la función de limpieza y resolución  
        currentStockfishResolve = (partialResult) => {  
            // Fusionar los resultados parciales con los acumulados  
            const finalResult = {  
                score: partialResult.score !== undefined ? partialResult.score : currentScore,  
                bestMove: partialResult.bestMove !== undefined ? partialResult.bestMove : currentBestMove,  
                depth: partialResult.depth !== undefined ? partialResult.depth : currentDepth,  
                pv: partialResult.pv !== undefined ? partialResult.pv : currentPv  
            };  
            resolveAndCleanup(finalResult);  
        };  
  
        // Asignar un listener temporal que solo capture los mensajes relevantes para esta evaluación  
        engine.onmessage = (message) => {  
            const data = typeof message === 'string' ? message : message.data;  
  
            if (data.startsWith('info')) {  
                const scoreMatch = data.match(/score (cp|mate) (-?\d+)/);  
                if (scoreMatch) {  
                    if (scoreMatch[1] === 'cp') {  
                        currentScore = parseInt(scoreMatch[2]) / 100;  
                    } else if (scoreMatch[1] === 'mate') {  
                        currentScore = scoreMatch[2] > 0 ? 9999 : -9999;  
                    }  
                }  
                const depthMatch = data.match(/depth (\d+)/);  
                if (depthMatch) {  
                    currentDepth = parseInt(depthMatch[1]);  
                }  
                const pvMatch = data.match(/pv (.+)/);  
                if (pvMatch) {  
                    currentPv = pvMatch[1].split(' ');  
                }  
            } else if (data.startsWith('bestmove')) {  
                const match = data.match(/bestmove (\S+)/);  
                currentBestMove = match ? match[1] : null;  
  
                // Llamar a resolveAndCleanup con el bestMove y los datos acumulados  
                resolveAndCleanup({ bestMove: currentBestMove, score: currentScore, depth: currentDepth, pv: currentPv });  
            } else {  
                // Si el listener global necesita ver mensajes, pásaselos aquí.  
                // Por ejemplo, para 'readyok' o mensajes de depuración.  
                // originalOnMessage(message);   
            }  
        };  
  
        try {  
            sendStockfishCommand('ucinewgame'); // Asegurarse de limpiar cualquier estado anterior  
            sendStockfishCommand('position fen ' + window.game.fen());  
            sendStockfishCommand('go depth ' + depth);  
        } catch (e) {  
            console.error('Error al enviar comando a Stockfish:', e);  
            resolveAndCleanup({ score: 0, bestMove: null, depth: 0, pv: [] });  
        }  
    });  
}  
  
// ===================== OBTENER MEJOR MOVIMIENTO =====================    
  
/**    
 * Solicita el mejor movimiento a Stockfish para la posición actual.  
 */    
async function getBestMoveStockfish(depth = 20) {    
    const customTimeout = 1000 + (depth * 200); // Ajustar timeout según la profundidad  
  
    const result = await evaluateWithStockfish(depth, customTimeout);  
  
    if (!result.bestMove) {  
        console.warn('Stockfish no pudo encontrar un bestMove, usando movimiento aleatorio.');  
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
  
    console.warn('Stockfish sugirió un movimiento no válido:', result.bestMove);  
    const moves = window.game.moves({ verbose: true });  
    return moves.length > 0 ? moves[Math.floor(Math.random() * moves.length)] : null;  
}  
  
// ===================== IA JUEGA CON STOCKFISH =====================    
  
/**    
 * Calcula el movimiento de la IA usando Stockfish.  
 */    
async function makeAIMove() {    
    if (window.game.game_over()) {  
        return null;  
    }  
  
    const difficultyElem = document.getElementById('difficulty');  
    const difficulty = difficultyElem ? parseInt(difficultyElem.value) : 3;  
  
    const depthMap = {  
        1: 6,  
        2: 10,  
        3: 14,  
        4: 18,  
        5: 22  
    };  
  
    const depth = depthMap[difficulty] || 14;  
  
    console.log(`IA pensando con profundidad ${depth} (dificultad: ${difficulty})...`);  
  
    const aiMoveObj = await getBestMoveStockfish(depth);  
  
    if (!aiMoveObj) {  
        console.error("La IA no pudo encontrar un movimiento válido.");  
    }  
    return aiMoveObj;  
}  
  
// ===================== FUNCIONES DE UTILIDAD DE UI =====================    
  
/**    
 * Actualiza el panel de evaluación de Stockfish en la interfaz principal.  
 */    
async function updateEvaluationDisplay() {    
    const displayDepth = 12;  
    const displayTimeout = 1500; // Un timeout más corto para la UI  
  
    if (!window.game || typeof window.game.fen !== 'function') {  
        console.error("La instancia global 'game' (Chess.js) no está disponible.");  
        return;  
    }  
  
    if (stockfishIsProcessing) {  
        //console.log('Evaluación en curso, saltando actualización de display.'); // Descomentar para depurar  
        return;  
    }  
  
    const result = await evaluateWithStockfish(displayDepth, displayTimeout);  
  
    const currentScoreElem = document.getElementById('currentScoreDisplay');  
    if (currentScoreElem) {  
        currentScoreElem.textContent = result.score !== undefined ? result.score.toFixed(2) : 'N/A';  
    }  
  
    const currentDepthElem = document.getElementById('currentDepthDisplay');  
    if (currentDepthElem) {  
        currentDepthElem.textContent = result.depth !== undefined ? result.depth : 'N/A';  
    }  
  
    const currentPVElem = document.getElementById('currentPVDisplay');  
    if (currentPVElem) {  
        currentPVElem.textContent = result.pv && result.pv.length > 0 ? result.pv.join(' ') : 'N/A';  
    }  
  
    const bestMoveSuggestionElem = document.getElementById('bestMoveSuggestionDisplay');  
    if (bestMoveSuggestionElem) {  
        bestMoveSuggestionElem.textContent = result.bestMove ? result.bestMove : 'N/A';  
    }  
  
    const evalScoreDiv = document.getElementById('evalScore');  
    if (evalScoreDiv) {  
        evalScoreDiv.textContent = result.score !== undefined ? result.score.toFixed(1) : '0.0';  
    }  
  
    if (typeof window.updateEvalBar === 'function') {  
        window.updateEvalBar(result.score);  
    }  
}  
  
// ===================== EXPORTAR GLOBALES =====================    
window.initializeStockfishEngine = initializeStockfishEngine;  
window.getBestMoveStockfish = getBestMoveStockfish;  
window.makeAIMove = makeAIMove;  
window.evaluateWithStockfish = evaluateWithStockfish;  
window.updateEvaluationDisplay = updateEvaluationDisplay;  
// Exportar engineReady como una propiedad con getter para que siempre refleje el estado actual  
Object.defineProperty(window, 'engineReady', {  
    get: () => engineReady,  
    configurable: true // Permite reconfigurar si es necesario  
});  
