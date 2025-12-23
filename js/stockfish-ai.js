// js/stockfish-ai.js  
  
// ===================== STOCKFISH - MOTOR REAL =====================  
// Variables globales para el manejo del motor Stockfish  
let engine = null;  
let engineReady = false; // Esta es la variable que necesita ser globalmente accesible  
let currentStockfishResolve = null; // Para resolver la promesa de la evaluación actual  
let currentStockfishTimeout = null; // Para limpiar el timeout de la evaluación actual  
let stockfishIsProcessing = false; // Bandera para evitar mandar múltiples comandos 'go'  
  
// Cola de comandos UCI - Actualmente no implementada, pero la variable está lista para ello.  
// Sería necesaria para manejar múltiples solicitudes de evaluación concurrentes de forma ordenada.  
const stockfishCommandQueue = [];  
  
/**  
 * Listener global para todos los mensajes que Stockfish envía.  
 * Este listener es el 'onmessage' principal del motor Stockfish.  
 *  
 * @param {string | object} message - El mensaje recibido de Stockfish.  
 *                                    Puede ser un string o un objeto Event en caso de Web Worker.  
 */  
function stockfishMessageListener(message) {  
    const data = typeof message === 'string' ? message : message.data;  
  
    // Confirma que el motor está listo después de un comando 'isready'  
    if (data === 'readyok') {  
        console.log('✅ Stockfish reporta readyok.');  
        // Aquí se procesaría la cola si tuviéramos una implementación completa de 'stockfishCommandQueue'  
        // processStockfishQueue();  
    }  
    // Los mensajes 'info' y 'bestmove' son manejados por el listener temporal en 'evaluateWithStockfish'  
    // cuando hay una evaluación activa. Si no hay evaluación activa, el listener global los ignora.  
    else if (data.startsWith('bestmove')) {  
        // Esto es crucial: Si hay una promesa de evaluación pendiente (currentStockfishResolve no es null)  
        if (currentStockfishResolve) {  
            // El timeout ya debería haber sido limpiado por el listener temporal en evaluateWithStockfish  
            // stockfishIsProcessing también se limpia en la resolución.  
            const match = data.match(/bestmove (\S+)/);  
            const bestMove = match ? match[1] : null;  
  
            // Llama a la función de resolución de la promesa almacenada,  
            // pasando el bestMove y usando los datos acumulados (score, depth, pv)  
            // que se cerraron en el scope de la función que creó currentStockfishResolve.  
            currentStockfishResolve({ bestMove: bestMove });  
            currentStockfishResolve = null; // Limpiar la referencia a la promesa resuelta  
        }  
        // processStockfishQueue(); // Si se implementa una cola  
    }  
    // Otros mensajes UCI no relacionados con info/bestmove (como id, uciok, etc.)  
    // podrían ser manejados aquí si fuera necesario.  
}  
  
/**  
 * Inicializa el motor Stockfish. Debe llamarse después de que 'stockfish.js'  
 * se haya cargado y el DOM esté listo (DOMContentLoaded).  
 * Asigna el listener global y envía comandos UCI iniciales.  
 */  
async function initializeStockfishEngine() {  
    try {  
        // La variable global `Stockfish` es establecida por el script js/stockfish.js  
        engine = Stockfish;  
        // Asignar el listener global inmediatamente. Esto es clave para la robustez.  
        engine.onmessage = stockfishMessageListener;  
  
        // Esperamos a que el motor interno de Stockfish esté listo.  
        // Stockfish.ready es una promesa definida en el stockfish.js.  
        await engine.ready;  
  
        // Establecer engineReady a true (y a window.engineReady también para game.js)  
        engineReady = true;  
        window.engineReady = true; // HACER ESTA VARIABLE GLOBALMENTE ACCESIBLE  
  
        console.log('✅ Stockfish WASM cargado y listo.');  
        // Actualiza un elemento HTML para informar al usuario sobre el estado del motor  
        const coachMessageElem = document.getElementById('coachMessage');  
        if (coachMessageElem) {  
            coachMessageElem.innerHTML = '<strong>✅ Stockfish Real</strong> Motor profesional activado.';  
        }  
  
        // Comandos UCI iniciales para configurar el motor  
        sendStockfishCommand('uci');  
        sendStockfishCommand('isready'); // Esperar 'readyok' para confirmar  
        sendStockfishCommand('ucinewgame');  
  
    } catch (e) {  
        console.error('Error inicializando Stockfish:', e);  
        // En caso de error, establecer engineReady a false (y a window.engineReady también)  
        engineReady = false;  
        window.engineReady = false; // HACER ESTA VARIABLE GLOBALMENTE ACCESIBLE  
  
        // Informa al usuario sobre el fallo en la inicialización  
        const coachMessageElem = document.getElementById('coachMessage');  
        if (coachMessageElem) {  
            coachMessageElem.innerHTML = '<strong>⚠️ Stockfish No Disponible</strong> Usando análisis local. (Revisa la consola)';  
        }  
    }  
}  
  
/**  
 * Envía un comando UCI al motor Stockfish de forma segura.  
 * Verifica si el motor está listo antes de enviar el comando.  
 * @param {string} command - El comando UCI a enviar (ej. 'position fen ...', 'go depth ...').  
 */  
function sendStockfishCommand(command) {  
    if (!engine || !engineReady) { // Usamos la variable local engineReady aquí  
        console.warn('Stockfish no está listo para recibir comandos.');  
        return;  
    }  
    engine.postMessage(command);  
}  
  
// ===================== EVALUAR CON STOCKFISH REAL =====================  
  
/**  
 * Realiza una evaluación de la posición actual del juego usando Stockfish.  
 * Devuelve una promesa que se resuelve con el score, bestMove, profundidad alcanzada y la PV.  
 * Es crucial que solo haya una evaluación activa a la vez para evitar sobrescribir el listener.  
 * @param {number} depth - La profundidad de análisis deseada.  
 * @param {number} customTimeout - Tiempo máximo en milisegundos para la evaluación.  
 * @returns {Promise<object>} - Un objeto con { score, bestMove, depth, pv }.  
 */  
function evaluateWithStockfish(depth = 20, customTimeout = 5000) {  
    return new Promise((resolve) => {  
        // Si el motor no está listo, resuelve inmediatamente con valores por defecto.  
        if (!engineReady || !engine) { // Usamos la variable local engineReady aquí  
            resolve({ score: 0, bestMove: null, depth: 0, pv: [] });  
            return;  
        }  
  
        // Si ya hay una evaluación en curso, ignora la nueva solicitud para evitar conflictos.  
        if (stockfishIsProcessing) {  
            console.warn("Stockfish ya está procesando un comando 'go'. Ignorando nueva solicitud.");  
            resolve({ score: 0, bestMove: null, depth: 0, pv: [] }); // O podrías rechazar la promesa  
            return;  
        }  
  
        // Variables para almacenar la información de la evaluación actual  
        let currentScore = 0;  
        let currentDepth = 0;  
        let currentPv = [];  
        let currentBestMove = null; // Se llenará con el 'bestmove' final  
  
        // Almacenar la función 'resolve' de esta promesa.  
        // Se llamará cuando Stockfish termine o se agote el tiempo.  
        currentStockfishResolve = ({ bestMove, score = currentScore, depth = currentDepth, pv = currentPv }) => {  
            clearTimeout(currentStockfishTimeout); // Asegurarse de limpiar el timeout  
            currentStockfishResolve = null; // Resetear para la siguiente llamada  
            stockfishIsProcessing = false; // Liberar el motor  
            resolve({ score, bestMove, depth, pv }); // Resolver la promesa con los datos finales  
        };  
  
        // Establecer un timeout si Stockfish tarda demasiado en responder.  
        currentStockfishTimeout = setTimeout(() => {  
            console.warn('Stockfish timeout. Forzando detención y resolución.');  
            sendStockfishCommand('stop'); // Detener el cálculo actual en Stockfish  
            // Resolver con la información acumulada hasta el momento del timeout  
            currentStockfishResolve({ bestMove: currentBestMove, score: currentScore, depth: currentDepth, pv: currentPv });  
        }, customTimeout);  
  
        // Guarda el listener global actual para poder restaurarlo después.  
        const originalOnMessage = engine.onmessage;  
  
        // Sobrescribe temporalmente el listener para esta evaluación específica.  
        // Este listener temporal se encargará de procesar los mensajes 'info' y 'bestmove'.  
        engine.onmessage = (message) => {  
            const data = typeof message === 'string' ? message : message.data;  
  
            if (data.startsWith('info')) {  
                // Actualizar las variables de esta evaluación específica con la información 'info'  
                const scoreMatch = data.match(/score (cp|mate) (-?\d+)/);  
                if (scoreMatch) {  
                    if (scoreMatch[1] === 'cp') {  
                        currentScore = parseInt(scoreMatch[2]) / 100; // Centipeones a peones  
                    } else if (scoreMatch[1] === 'mate') {  
                        currentScore = scoreMatch[2] > 0 ? 9999 : -9999; // Un valor muy alto/bajo para mate  
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
                // Cuando se recibe el 'bestmove', la evaluación ha terminado.  
                const match = data.match(/bestmove (\S+)/);  
                currentBestMove = match ? match[1] : null;  
  
                // Restaurar el listener global original antes de resolver la promesa. ¡Muy importante!  
                engine.onmessage = originalOnMessage;  
                // Llama a la función de resolución almacenada (currentStockfishResolve)  
                currentStockfishResolve({ bestMove: currentBestMove });  
            } else {  
                // Si el mensaje no es 'info' ni 'bestmove', pasa el control al listener global original.  
                // Esto es para asegurar que otros mensajes UCI (como 'readyok') se sigan procesando.  
                originalOnMessage(message);  
            }  
        };  
  
        try {  
            // Envía los comandos para iniciar la evaluación  
            // 'game' se asume como una instancia global de Chess.js  
            sendStockfishCommand('position fen ' + window.game.fen());  
            sendStockfishCommand('go depth ' + depth);  
            stockfishIsProcessing = true; // Indica que Stockfish está ocupado con una evaluación  
        } catch (e) {  
            console.error('Error al enviar comando a Stockfish:', e);  
            clearTimeout(currentStockfishTimeout); // Limpiar el timeout en caso de error inmediato  
            engine.onmessage = originalOnMessage; // Restaurar el listener global  
            currentStockfishResolve({ score: 0, bestMove: null, depth: 0, pv: [] }); // Resolver con error  
        }  
    });  
}  
  
// ===================== OBTENER MEJOR MOVIMIENTO =====================  
  
/**  
 * Solicita el mejor movimiento a Stockfish para la posición actual.  
 * @param {number} depth - La profundidad de análisis para encontrar el mejor movimiento.  
 * @returns {Promise<object | null>} - Un objeto de movimiento chess.js (con from, to, promotion)  
 *                                      o null si no se pudo encontrar un movimiento válido.  
 */  
async function getBestMoveStockfish(depth = 20) {  
    // Calcular un timeout dinámico basado en la profundidad para el cálculo del movimiento.  
    const customTimeout = 2000 + (depth * 250); // Base 2s + 250ms por cada unidad de profundidad  
  
    // Realiza la evaluación para obtener el mejor movimiento y otros datos.  
    const result = await evaluateWithStockfish(depth, customTimeout);  
  
    // Si Stockfish no devuelve un bestMove, intenta un movimiento aleatorio como fallback.  
    if (!result.bestMove) {  
        console.warn('Stockfish no pudo encontrar un bestMove, usando movimiento legal aleatorio como fallback.');  
        // 'game' es una variable global de Chess.js  
        const moves = window.game.moves({ verbose: true });  
        return moves.length > 0 ? moves[Math.floor(Math.random() * moves.length)] : null;  
    }  
  
    // Convertir la notación de Stockfish (e.g., "e2e4", "e7e8q") a un objeto de movimiento de chess.js  
    const from = result.bestMove.substring(0, 2);  
    const to = result.bestMove.substring(2, 4);  
    // Asegurarse de que el carácter de promoción sea minúscula, como lo espera chess.js  
    const promotion = result.bestMove.length > 4 ? result.bestMove[4].toLowerCase() : undefined;  
  
    // Utiliza una instancia temporal de Chess.js para validar el movimiento de Stockfish  
    // y obtener el objeto de movimiento completo (con flags, san, etc.).  
    const tempGame = new Chess(window.game.fen());  
    const moveObj = tempGame.move({ from, to, promotion });  
  
    if (moveObj) {  
        return moveObj; // Devuelve el objeto de movimiento válido de chess.js  
    }  
  
    // Si el movimiento sugerido por Stockfish no es válido para chess.js (esto es raro si el FEN es correcto)  
    console.warn('Stockfish sugirió un movimiento no válido o con promoción incorrecta:', result.bestMove);  
    const moves = window.game.moves({ verbose: true });  
    return moves.length > 0 ? moves[Math.floor(Math.random() * moves.length)] : null; // Fallback aleatorio  
}  
  
// ===================== IA JUEGA CON STOCKFISH =====================  
  
/**  
 * Calcula el movimiento de la IA usando Stockfish.  
 * Esta función SOLO calcula y devuelve el movimiento, no lo aplica al juego ni actualiza la UI.  
 * La aplicación del movimiento y la actualización de la UI deben manejarse en 'game.js'.  
 * @returns {Promise<object | null>} - El objeto de movimiento chess.js para la IA, o null si el juego ha terminado o no se encontró movimiento.  
 */  
async function makeAIMove() {  
    // 'game' es una variable global de Chess.js  
    if (window.game.game_over()) {  
        return null; // El juego ya terminó, la IA no puede mover  
    }  
  
    // Obtener la dificultad seleccionada del DOM  
    const difficultyElem = document.getElementById('difficulty');  
    const difficulty = difficultyElem ? parseInt(difficultyElem.value) : 3; // Por defecto a 'Avanzado' si no se encuentra  
  
    // Mapear la dificultad a una profundidad de Stockfish  
    const depthMap = {  
        1: 6,   // Novato  
        2: 10,  // Intermedio  
        3: 14,  // Avanzado  
        4: 18,  // Experto  
        5: 22   // Maestro  
    };  
  
    const depth = depthMap[difficulty] || 14; // Usa profundidad por defecto si la dificultad no está mapeada  
  
    console.log(`IA pensando con profundidad ${depth} (dificultad: ${difficulty})...`);  
  
    // Obtener el mejor movimiento usando Stockfish  
    const aiMoveObj = await getBestMoveStockfish(depth);  
  
    if (!aiMoveObj) {  
        console.error("La IA no pudo encontrar un movimiento válido.");  
    }  
    return aiMoveObj; // Devuelve el objeto de movimiento para que game.js lo aplique  
}  
  
  
// ===================== FUNCIONES DE UTILIDAD DE UI =====================  
  
/**  
 * Actualiza el panel de evaluación de Stockfish en la interfaz principal.  
 * Esta función asume que la variable global `game` (instancia de Chess.js) está disponible.  
 * También asume que los elementos HTML con IDs como 'currentScoreDisplay', 'evalScore', etc., existen.  
 */  
async function updateEvaluationDisplay() {  
    // Definir la profundidad y timeout para esta visualización continua  
    // Una profundidad y tiempo menores son adecuados para no bloquear la UI con análisis profundos.  
    const displayDepth = 12; // Una profundidad razonable para el feedback continuo  
    const displayTimeout = 2000; // 2 segundos de tiempo máximo para la evaluación  
  
    // Verificar que la instancia global 'game' esté disponible y sea válida  
    if (!window.game || typeof window.game.fen !== 'function') {  
        console.error("La instancia global 'game' (Chess.js) no está disponible o no es válida para la evaluación.");  
        return;  
    }  
  
    // Realizar la evaluación de la posición actual  
    const result = await evaluateWithStockfish(displayDepth, displayTimeout);  
  
    // Obtener referencias a los elementos HTML donde se mostrará la información  
    const currentScoreElem = document.getElementById('currentScoreDisplay');  
    const currentDepthElem = document.getElementById('currentDepthDisplay');  
    const currentPVElem = document.getElementById('currentPVDisplay');  
    const bestMoveSuggestionElem = document.getElementById('bestMoveSuggestionDisplay');  
  
    // Actualizar los elementos HTML del panel de evaluación  
    if (currentScoreElem) {  
        currentScoreElem.textContent = result.score !== undefined ? result.score.toFixed(2) : 'N/A';  
    }  
    if (currentDepthElem) {  
        currentDepthElem.textContent = result.depth !== undefined ? result.depth : 'N/A';  
    }  
    if (currentPVElem) {  
        // En el panel lateral, podemos mostrar la PV en UCI para ser consistentes con el resultado directo del motor  
        // Si se desea SAN aquí también, se necesitaría llamar a convertPvUciToSan  
        currentPVElem.textContent = result.pv && result.pv.length > 0 ? result.pv.join(' ') : 'N/A';  
    }  
    if (bestMoveSuggestionElem) {  
        // Aquí también podríamos convertir result.bestMove a SAN si se quisiera.  
        bestMoveSuggestionElem.textContent = result.bestMove ? result.bestMove : 'N/A';  
    }  
  
    // Actualizar la barra de evaluación vertical y su score numérico  
    const evalScoreDiv = document.getElementById('evalScore');  
    if (evalScoreDiv) {  
        evalScoreDiv.textContent = result.score !== undefined ? result.score.toFixed(1) : '0.0';  
    }  
    // Asume que 'updateEvalBar' es una función global definida en game.js  
    if (typeof window.updateEvalBar === 'function') {  
        window.updateEvalBar(result.score);  
    } else {  
        // console.warn("La función global 'updateEvalBar' no está definida en game.js. La barra de evaluación vertical no se actualizará.");  
    }  
}  
  
// ===================== EXPORTAR GLOBALES =====================  
// Asignamos variables y funciones al objeto `window` para que sean accesibles  
// desde otros scripts o el HTML directamente, ya que no estamos usando módulos JS.  
window.initializeStockfishEngine = initializeStockfishEngine;  
window.getBestMoveStockfish = getBestMoveStockfish;  
window.makeAIMove = makeAIMove;  
window.evaluateWithStockfish = evaluateWithStockfish; // Útil para el modal de análisis detallado  
window.updateEvaluationDisplay = updateEvaluationDisplay;  
window.engineReady = engineReady; // <--- ESTO ES LO NUEVO: HACER engineReady GLOBALMENTE ACCESIBLE  
