// js/stockfish-ai.js (VERSIÓN ADAPTADA Y FINAL para resolver postMessage)  
  
// ===================== STOCKFISH - MOTOR REAL =====================    
// Variables globales para el manejo del motor Stockfish    
let engine = null;    
let engineReady = false;  
let currentStockfishResolve = null;  
let currentStockfishTimeout = null;  
let stockfishIsProcessing = false;  
  
// La cola de comandos se mantiene por si se necesita en el futuro,  
// pero la lógica actual gestiona una sola evaluación a la vez.  
// const stockfishCommandQueue = [];   
  
/**    
 * Listener global para todos los mensajes que Stockfish envía.  
 * Este listener solo captura el 'readyok' que indica que el motor ha iniciado.  
 * Los mensajes de evaluación ('info', 'bestmove') se manejan con un listener temporal  
 * en la función `evaluateWithStockfish` para evitar conflictos.  
 */    
function stockfishMessageListener(message) {    
    const data = typeof message === 'string' ? message : message.data;    
  
    if (data === 'readyok') {    
        console.log('✅ Stockfish reporta readyok.');    
        // En este punto, la bandera engineReady ya debería estar en true.  
    }  
}  
  
/**    
 * Inicializa el motor Stockfish. Debe llamarse después de que 'stockfish.js'    
 * se haya cargado y el DOM esté listo (DOMContentLoaded).  
 */    
async function initializeStockfishEngine() {    
    try {  
        console.log('Iniciando Stockfish...');  
        console.log('Tipo de window.StockfishMv:', typeof window.StockfishMv); // Esto seguirá mostrando 'function'  
  
        // MANTENEMOS TU LÓGICA DE CONEXIÓN EXACTA, NO SE TOCA.  
        // Asignar la función window.StockfishMv directamente a engine.  
        engine = window.StockfishMv;   
          
        // Esperar a que StockfishMv esté listo (si es un objeto con una promesa .ready)  
        if (engine && engine.ready) { // Usamos 'engine' aquí, ya que ya está asignado.  
            console.log('Esperando a que Stockfish.ready se resuelva...');  
            await engine.ready;  
        }  
  
        if (!engine) { // Si window.StockfishMv no existe.  
            throw new Error('window.StockfishMv no está disponible.');  
        }  
  
        console.log('✅ Motor Stockfish obtenido:', typeof engine); // Seguirá siendo 'function'.  
  
        // Asignar el listener global inmediatamente.  
        // Este será el listener por defecto para mensajes de Stockfish.  
        engine.onmessage = stockfishMessageListener;  
  
        // Establecer engineReady a true.  
        engineReady = true;  
        window.engineReady = true; // Para acceso global por game.js.  
  
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
        engineReady = false; // La inicialización falló.  
        window.engineReady = false;  
  
        const coachMessageElem = document.getElementById('coachMessage');  
        if (coachMessageElem) {  
            coachMessageElem.innerHTML = '<strong>⚠️ Stockfish No Disponible</strong> Usando análisis local. Error: ' + e.message;  
        }  
    }  
}  
  
/**    
 * Envía un comando UCI al motor Stockfish de forma segura.  
 * ESTA ES LA ÚNICA FUNCIÓN QUE SE MODIFICA PARA ADAPTARSE A TU `engine` COMO `function`.  
 * Ahora llamará a `engine(command)` en lugar de `engine.postMessage(command)`.  
 */    
function sendStockfishCommand(command) {    
    // Verificación robusta: Si engine no está asignado o no es una función llamable,  
    // o si engineReady es falso, entonces no se puede enviar el comando.  
    if (!engine || !engineReady || typeof engine !== 'function') { // <--- CAMBIO AQUÍ: typeof engine !== 'function'  
        // console.warn(`Stockfish no está listo para recibir comandos: "${command}". (Engine: ${engine ? typeof engine : 'null'}, Ready: ${engineReady})`);  
        return;  
    }  
      
    //console.log('Enviando comando:', command); // Descomentar para depurar comandos.  
    engine(command); // <--- CAMBIO CLAVE AQUÍ: Llama a engine como una función, no a .postMessage  
}  
  
// ===================== EVALUAR CON STOCKFISH REAL =====================    
  
/**    
 * Realiza una evaluación de la posición actual del juego usando Stockfish.  
 * @param {number} depth - La profundidad de búsqueda deseada.  
 * @param {number} customTimeout - El tiempo máximo en milisegundos para la evaluación.  
 * @returns {Promise<{score: number, bestMove: string|null, depth: number, pv: string[]}>}  
 */    
function evaluateWithStockfish(depth = 20, customTimeout = 5000) {    
    return new Promise((resolve) => {  
        // Verificación inicial de disponibilidad del motor.  
        // Ahora `engine` se espera que sea una función directamente.  
        if (!engineReady || !engine || typeof engine !== 'function') { // <--- CAMBIO AQUÍ: typeof engine !== 'function'  
            console.warn('Stockfish no está listo o no es un Worker válido para evaluar.');  
            resolve({ score: 0, bestMove: null, depth: 0, pv: [] });  
            return;  
        }  
  
        // Evitar múltiples evaluaciones simultáneas.  
        if (stockfishIsProcessing) {  
            console.warn("Stockfish ya está procesando. Ignorando nueva solicitud de evaluación.");  
            resolve({ score: 0, bestMove: null, depth: 0, pv: [] });  
            return;  
        }  
  
        // Variables para almacenar el estado de la evaluación.  
        let currentScore = 0;  
        let currentDepth = 0;  
        let currentPv = [];  
        let currentBestMove = null;  
        let evaluationResolved = false; // Bandera para asegurar que la promesa se resuelve solo una vez.  
  
        stockfishIsProcessing = true; // Marcar que el motor está ocupado.  
  
        // Guardar el listener original para restaurarlo después de la evaluación.  
        const originalOnMessage = engine.onmessage;  
  
        // Función para limpiar el timeout, restaurar el listener y resolver la promesa.  
        const cleanupAndResolve = (result) => {  
            if (!evaluationResolved) {  
                clearTimeout(currentStockfishTimeout); // Limpiar cualquier timeout pendiente.  
                engine.onmessage = originalOnMessage; // Restaurar el listener global.  
                stockfishIsProcessing = false; // Marcar motor como disponible.  
                currentStockfishResolve = null; // Limpiar la referencia de la promesa de resolución.  
                evaluationResolved = true; // Indicar que ya se resolvió.  
                resolve(result); // Resolver la promesa de evaluateWithStockfish.  
            }  
        };  
  
        // Configurar un timeout para detener la búsqueda si excede el tiempo límite.  
        currentStockfishTimeout = setTimeout(() => {  
            console.warn('Stockfish timeout. Forzando detención y resolución.');  
            sendStockfishCommand('stop'); // Enviar comando para detener la búsqueda.  
            // Resolver con los datos que se hayan acumulado hasta el momento del timeout.  
            cleanupAndResolve({ bestMove: currentBestMove, score: currentScore, depth: currentDepth, pv: currentPv });  
        }, customTimeout);  
  
        // Configurar la función de resolución de la promesa específica para esta evaluación.  
        // Se llama desde el listener 'bestmove' o el timeout.  
        currentStockfishResolve = (partialResult) => {  
            // Fusionar los resultados parciales recibidos con los acumulados.  
            const finalResult = {  
                score: partialResult.score !== undefined ? partialResult.score : currentScore,  
                bestMove: partialResult.bestMove !== undefined ? partialResult.bestMove : currentBestMove,  
                depth: partialResult.depth !== undefined ? partialResult.depth : currentDepth,  
                pv: partialResult.pv !== undefined ? partialResult.pv : currentPv  
            };  
            cleanupAndResolve(finalResult);  
        };  
  
        // Asignar un listener TEMPORAL para esta evaluación específica.  
        // Este listener intercepta los mensajes 'info' y 'bestmove'.  
        engine.onmessage = (message) => {  
            const data = typeof message === 'string' ? message : message.data;  
  
            if (data.startsWith('info')) {  
                // Capturar el score (cp o mate).  
                const scoreMatch = data.match(/score (cp|mate) (-?\d+)/);  
                if (scoreMatch) {  
                    if (scoreMatch[1] === 'cp') {  
                        currentScore = parseInt(scoreMatch[2]) / 100;  
                    } else if (scoreMatch[1] === 'mate') {  
                        currentScore = scoreMatch[2] > 0 ? 9999 : -9999; // Representar mate con un valor muy alto/bajo.  
                    }  
                }  
                // Capturar la profundidad de la búsqueda.  
                const depthMatch = data.match(/depth (\d+)/);  
                if (depthMatch) {  
                    currentDepth = parseInt(depthMatch[1]);  
                }  
                // Capturar la variante principal (PV).  
                const pvMatch = data.match(/pv (.+)/);  
                if (pvMatch) {  
                    currentPv = pvMatch[1].split(' ');  
                }  
            } else if (data.startsWith('bestmove')) {  
                // Cuando se recibe 'bestmove', la evaluación ha terminado con éxito.  
                const match = data.match(/bestmove (\S+)/);  
                currentBestMove = match ? match[1] : null;  
  
                // Resolver la promesa con todos los datos finales.  
                cleanupAndResolve({ bestMove: currentBestMove, score: currentScore, depth: currentDepth, pv: currentPv });  
            } else {  
                // Si el listener global necesita ver mensajes, pásaselos aquí.  
                // Por ejemplo, para 'readyok' o mensajes de depuración.  
                // originalOnMessage(message);   
            }  
        };  
  
        // Enviar los comandos para iniciar la evaluación a Stockfish.  
        try {  
            sendStockfishCommand('ucinewgame'); // Limpia el estado del tablero interno de Stockfish.  
            sendStockfishCommand('position fen ' + window.game.fen()); // Establece la posición actual.  
            sendStockfishCommand(`go depth ${depth}`); // Inicia la búsqueda hasta la profundidad especificada.  
            // Para búsquedas por tiempo: sendStockfishCommand(`go movetime ${customTimeout}`);  
        } catch (e) {  
            console.error('Error al enviar comando(s) a Stockfish:', e);  
            // Si hay un error al enviar comandos, resolver inmediatamente.  
            cleanupAndResolve({ score: 0, bestMove: null, depth: 0, pv: [] });  
        }  
    });  
}  
  
// ===================== OBTENER MEJOR MOVIMIENTO =====================    
  
/**    
 * Solicita el mejor movimiento a Stockfish para la posición actual.  
 * Utiliza `evaluateWithStockfish` para obtener la evaluación.  
 * @param {number} depth - Profundidad de búsqueda para Stockfish.  
 * @param {number} customTimeout - Tiempo máximo de búsqueda en milisegundos.  
 * @returns {Promise<object|null>} Objeto de movimiento válido de chess.js o null si no se encuentra.  
 */    
async function getBestMoveStockfish(depth = 20) {    
    // Calcular un timeout apropiado para la profundidad de búsqueda.  
    const customTimeout = 1000 + (depth * 200); // Base de 1s + 200ms por cada profundidad  
  
    console.log(`Buscando el mejor movimiento con Stockfish a profundidad ${depth} (timeout: ${customTimeout}ms)...`);  
    const result = await evaluateWithStockfish(depth, customTimeout);  
  
    // Si Stockfish no devuelve un mejor movimiento, usar uno aleatorio como fallback.  
    if (!result.bestMove) {  
        console.warn('Stockfish no pudo encontrar un bestMove, usando movimiento aleatorio.');  
        const moves = window.game.moves({ verbose: true });  
        return moves.length > 0 ? moves[Math.floor(Math.random() * moves.length)] : null;  
    }  
  
    // Parsear el movimiento UCI (e.g., 'e2e4', 'e7e8q') a componentes 'from', 'to', 'promotion'.  
    const from = result.bestMove.substring(0, 2);  
    const to = result.bestMove.substring(2, 4);  
    const promotion = result.bestMove.length > 4 ? result.bestMove[4].toLowerCase() : undefined;  
  
    // Usar una instancia temporal de Chess.js para validar y obtener el objeto de movimiento.  
    // Esto es crucial para no alterar el estado de `window.game` y para obtener un objeto de movimiento estándar.  
    const tempGame = new Chess(window.game.fen());   
    const moveObj = tempGame.move({ from, to, promotion });  
  
    if (moveObj) {  
        console.log(`Stockfish sugirió el mejor movimiento: ${result.bestMove}`);  
        return moveObj;  
    }  
  
    // Si el movimiento sugerido por Stockfish no es válido (raro, pero posible en casos extremos).  
    console.warn('Stockfish sugirió un movimiento no válido:', result.bestMove, '. Intentando movimiento aleatorio.');  
    const moves = window.game.moves({ verbose: true });  
    return moves.length > 0 ? moves[Math.floor(Math.random() * moves.length)] : null;  
}  
  
// ===================== IA JUEGA CON STOCKFISH =====================    
  
/**    
 * Calcula el movimiento de la IA usando Stockfish.  
 * @returns {Promise<object|null>} El objeto de movimiento de chess.js o null si no se puede mover.  
 */    
async function makeAIMove() {    
    if (window.game.game_over()) {  
        console.log('El juego ha terminado, la IA no puede hacer un movimiento.');  
        return null;  
    }  
  
    // Obtener la dificultad seleccionada por el usuario.  
    const difficultyElem = document.getElementById('difficulty');  
    const difficulty = difficultyElem ? parseInt(difficultyElem.value) : 3;  
  
    // Mapear la dificultad a una profundidad de búsqueda de Stockfish.  
    const depthMap = {  
        1: 6,  // Novato: búsqueda superficial.  
        2: 10, // Intermedio: búsqueda un poco más profunda.  
        3: 14, // Avanzado: buen equilibrio entre fuerza y velocidad.  
        4: 18, // Experto: búsqueda considerable.  
        5: 22  // Maestro: búsqueda muy profunda, puede tardar.  
    };  
  
    const depth = depthMap[difficulty] || 14; // Usar 14 como profundidad por defecto si la dificultad no está mapeada.  
  
    console.log(`IA pensando con profundidad ${depth} (dificultad: ${difficulty})...`);  
  
    // Obtener el mejor movimiento de Stockfish.  
    const aiMoveObj = await getBestMoveStockfish(depth);  
  
    if (!aiMoveObj) {  
        console.error("La IA no pudo encontrar un movimiento válido con Stockfish.");  
    } else {  
        console.log("IA ha elegido el movimiento:", aiMoveObj);  
    }  
    return aiMoveObj;  
}  
  
// ===================== FUNCIONES DE UTILIDAD DE UI =====================    
  
/**    
 * Actualiza el panel de evaluación de Stockfish en la interfaz principal.  
 * Realiza una evaluación ligera para mostrar el estado actual del juego.  
 */    
async function updateEvaluationDisplay() {    
    const displayDepth = 12; // Una profundidad razonable para la actualización de la UI.  
    const displayTimeout = 1500; // Un timeout corto para que la UI no se quede congelada.  
  
    if (!window.game || typeof window.game.fen !== 'function') {  
        console.error("La instancia global 'game' (Chess.js) no está disponible o es inválida.");  
        return;  
    }  
  
    // Si Stockfish ya está procesando una evaluación (ej. la IA haciendo su movimiento),  
    // no iniciar otra para la UI.  
    if (stockfishIsProcessing) {  
        // console.log('Evaluación de UI en curso, saltando nueva actualización de display.');  
        return;  
    }  
  
    // Realizar la evaluación y actualizar los elementos de la interfaz.  
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
        // Unir los movimientos de la PV para mostrar.  
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
// Estas funciones se hacen accesibles globalmente para otros scripts (como game.js)  
// ya que no se está utilizando un sistema de módulos ES6.  
window.initializeStockfishEngine = initializeStockfishEngine;  
window.getBestMoveStockfish = getBestMoveStockfish;  
window.makeAIMove = makeAIMove;  
window.evaluateWithStockfish = evaluateWithStockfish;  
window.updateEvaluationDisplay = updateEvaluationDisplay;  
// `engineReady` se expone como una propiedad con getter para que su estado  
// se obtenga dinámicamente cada vez que se accede, reflejando el valor actual.  
Object.defineProperty(window, 'engineReady', {  
    get: () => engineReady,  
    configurable: true // Permite que esta propiedad pueda ser reconfigurada si fuera necesario.  
});  
