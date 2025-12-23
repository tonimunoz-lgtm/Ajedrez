// ===================== STOCKFISH - MOTOR REAL =====================  
let engine = null;  
let engineReady = false;  
let currentStockfishResolve = null; // Para resolver la promesa de la evaluación actual  
let currentStockfishTimeout = null; // Para limpiar el timeout de la evaluación actual  
let stockfishIsProcessing = false; // Bandera para evitar mandar múltiples comandos 'go'  
  
// Cola de comandos UCI si necesitamos ejecutar comandos en secuencia  
// Opcional, pero útil para comandos complejos más allá de 'go'  
const stockfishCommandQueue = [];  
  
// Listener global para todos los mensajes de Stockfish  
function stockfishMessageListener(message) {  
    const data = typeof message === 'string' ? message : message.data;  
  
    if (data === 'readyok') {  
        // Confirmación de que el motor está listo después de 'isready'  
        console.log('✅ Stockfish reporta readyok.');  
        // Aquí podrías procesar la cola si hubiera comandos en espera  
        processStockfishQueue(); // Si se implementa una cola  
    } else if (data.startsWith('info')) {  
        // Si hay una evaluación activa, procesar la info  
        if (currentStockfishResolve) {  
            // Actualizar score, depth, pv en algún objeto temporal  
            // o directamente en la lógica de evaluateWithStockfish  
            // Por simplicidad, esta parte la gestionará evaluateWithStockfish  
        }  
    } else if (data.startsWith('bestmove')) {  
        // Esto es crucial: Si hay una promesa de evaluación pendiente  
        if (currentStockfishResolve) {  
            clearTimeout(currentStockfishTimeout); // Limpiar timeout  
            stockfishIsProcessing = false; // Ya no está procesando un 'go'  
  
            // Extraer bestMove y resolver la promesa  
            const match = data.match(/bestmove (\S+)/);  
            const bestMove = match ? match[1] : null;  
  
            // La lógica para extraer score, depth, pv durante el proceso  
            // debe haber actualizado un objeto accesible aquí.  
            // Para este ejemplo, pasaré solo el bestMove y el resto se asume  
            // que se manejó en la lógica interna de evaluateWithStockfish.  
            currentStockfishResolve({ bestMove: bestMove }); // Resolvemos con el bestMove  
  
            currentStockfishResolve = null; // Limpiar la promesa resuelta  
            // Podrías también limpiar el estado de score, depth, pv si lo tuvieras global  
        }  
        // Procesar el siguiente comando en la cola si existe  
        processStockfishQueue(); // Si se implementa una cola  
    }  
    // Otros mensajes UCI...  
}  
  
// Esta función debe ser llamada después de que stockfish.js se haya cargado  
async function initializeStockfishEngine() {  
    try {  
        engine = Stockfish;  
        // Asignar el listener global inmediatamente  
        engine.onmessage = stockfishMessageListener; // Esto es clave  
  
        await engine.ready; // Esperamos la promesa 'ready'  
  
        engineReady = true;  
        console.log('✅ Stockfish WASM cargado y listo.');  
        document.getElementById('coachMessage').innerHTML = '<strong>✅ Stockfish Real</strong> Motor profesional activado.';  
  
        engine.postMessage('uci');  
        engine.postMessage('isready');  
        engine.postMessage('ucinewgame');  
  
    } catch (e) {  
        console.error('Error inicializando Stockfish:', e);  
        engineReady = false;  
        document.getElementById('coachMessage').innerHTML = '<strong>⚠️ Stockfish No Disponible</strong> Usando análisis local. (Revisa la consola)';  
    }  
}  
  
// Función para enviar comandos a Stockfish de forma segura  
function sendStockfishCommand(command) {  
    if (!engine || !engineReady) {  
        console.warn('Stockfish no está listo para recibir comandos.');  
        return;  
    }  
    // Podrías poner esto en una cola si necesitas manejar orden y respuestas  
    engine.postMessage(command);  
}  
  
// ===================== EVALUAR CON STOCKFISH REAL (REFACTORIZADO) =====================  
// Ahora usa el listener global y gestiona su propia resolución  
function evaluateWithStockfish(depth = 20, customTimeout = 5000) {  
    return new Promise((resolve) => {  
        if (!engineReady || !engine) {  
            resolve({ score: 0, bestMove: null, depth: 0, pv: [] });  
            return;  
        }  
  
        if (stockfishIsProcessing) {  
            console.warn("Stockfish ya está procesando un comando 'go'. Ignorando nueva solicitud.");  
            // O podrías poner esta solicitud en una cola y procesarla después  
            resolve({ score: 0, bestMove: null, depth: 0, pv: [] }); // O rechazar  
            return;  
        }  
  
        let currentScore = 0;  
        let currentDepth = 0;  
        let currentPv = [];  
        let currentBestMove = null; // Esto se llenará con el 'bestmove' final  
  
        // Preparar para la resolución de esta promesa específica  
        currentStockfishResolve = ({ bestMove, score = currentScore, depth = currentDepth, pv = currentPv }) => {  
            clearTimeout(currentStockfishTimeout); // Asegurarse de limpiar  
            currentStockfishResolve = null; // Resetear para la siguiente llamada  
            stockfishIsProcessing = false; // Liberar el motor  
            resolve({ score, bestMove, depth, pv });  
        };  
  
        // Establecer un timeout si Stockfish tarda demasiado  
        currentStockfishTimeout = setTimeout(() => {  
            console.warn('Stockfish timeout. Forzando detención y resolución.');  
            engine.postMessage('stop'); // Detener el cálculo actual  
            currentStockfishResolve({ bestMove: currentBestMove, score: currentScore, depth: currentDepth, pv: currentPv });  
        }, customTimeout);  
  
        // Modificar el listener global temporalmente para capturar info para esta evaluación  
        // Esto es un poco hacky si Stockfish.onmessage puede ser 'addMessageListener'  
        // Lo ideal sería tener un manejador más avanzado en el stockfish.js  
        const originalListener = engine.onmessage;  
        engine.onmessage = (message) => {  
            const data = typeof message === 'string' ? message : message.data;  
  
            if (data.startsWith('info')) {  
                // Actualizar las variables de esta evaluación  
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
                // Cuando llega el bestmove, resolver la promesa con la info acumulada  
                const match = data.match(/bestmove (\S+)/);  
                currentBestMove = match ? match[1] : null;  
  
                // Restaurar el listener original (global) antes de resolver  
                engine.onmessage = originalListener;  
                currentStockfishResolve({ bestMove: currentBestMove }); // Pasar los datos acumulados  
            }  
            // Asegurarse de que el listener global también procesa otros mensajes si es necesario  
            originalListener(message);  
        };  
  
        try {  
            sendStockfishCommand('position fen ' + game.fen());  
            sendStockfishCommand('go depth ' + depth);  
            stockfishIsProcessing = true; // Indicar que Stockfish está ocupado  
        } catch (e) {  
            console.error('Error al enviar comando a Stockfish:', e);  
            clearTimeout(currentStockfishTimeout);  
            engine.onmessage = originalListener; // Restaurar en caso de error  
            currentStockfishResolve({ score: 0, bestMove: null, depth: 0, pv: [] });  
        }  
    });  
}   
  
// ===================== OBTENER MEJOR MOVIMIENTO =====================  
async function getBestMoveStockfish(depth = 20) {  
    const result = await evaluateWithStockfish(depth);  
      
    if (!result.bestMove) {  
        // Fallback: obtener un movimiento legal aleatorio si Stockfish no devuelve nada  
        const moves = game.moves({ verbose: true });  
        return moves.length > 0 ? moves[0] : null;  
    }  
  
    // Convertir notación Stockfish (e.g., "e2e4") a objeto chess.js  
    const from = result.bestMove.substring(0, 2);  
    const to = result.bestMove.substring(2, 4);  
    const promotion = result.bestMove.length > 4 ? result.bestMove[4] : undefined;  
      
    // Necesitamos que chess.js valide y genere el objeto de movimiento completo  
    const tempGame = new Chess(game.fen()); // Usar una instancia temporal para validar  
    const moveObj = tempGame.move({ from, to, promotion });  
  
    if (moveObj) {  
        return moveObj;  
    }  
      
    console.warn('Stockfish sugirió un movimiento no válido o con promoción incorrecta:', result.bestMove);  
    // Fallback si el movimiento de Stockfish no es directamente aplicable  
    const moves = game.moves({ verbose: true });  
    return moves.length > 0 ? moves[0] : null;  
}  
  
// ===================== IA JUEGA CON STOCKFISH =====================  
async function makeAIMove() {  
    if (game.game_over()) {  
        aiThinking = false;  
        return;  
    }  
  
    const difficulty = parseInt(document.getElementById('difficulty').value);  
      
    const depthMap = {  
        1: 6,   // Novato  
        2: 10,  // Intermedio  
        3: 14,  // Avanzado  
        4: 18,  // Experto  
        5: 22   // Maestro  
    };  
  
    const depth = depthMap[difficulty] || 14;  
      
    // Obtener el movimiento de Stockfish  
    const move = await getBestMoveStockfish(depth);  
      
    if (move) {  
        game.move(move);  
        lastFromSquare = move.from;  
        lastToSquare = move.to;  
        moveCount++;  
          
        // Actualizar la evaluación global después del movimiento de la IA  
        const evalAfterAIMove = await evaluateWithStockfish(10); // Evaluación rápida después del movimiento de la IA  
        currentStockfishScore = evalAfterAIMove.score;  
    } else {  
        console.error("La IA no pudo hacer un movimiento.");  
    }  
  
    // `aiThinking` se resetea en el setTimeout en `handleSquareClick`  
    // updateUI() también se llama allí, por lo que no es necesario aquí.  
}  

// ===================== FUNCIONES DE UTILIDAD DE UI =====================  
  
/**  
 * Actualiza el panel de evaluación de Stockfish en la interfaz principal.  
 * Esta función es global para ser llamada desde game.js después de cada movimiento.  
 */  
async function updateEvaluationDisplay() {  
    // Definir la profundidad y timeout para esta visualización continua  
    // Puede ser menor que para la IA o el análisis detallado para mantener la fluidez  
    const displayDepth = 12; // Una profundidad razonable para el feedback continuo  
    const displayTimeout = 2000; // 2 segundos para no bloquear la UI  
  
    // Importante: No usar getBestMoveStockfish aquí, porque ese es para que la IA mueva.  
    // Usamos evaluateWithStockfish directamente.  
    const result = await evaluateWithStockfish(displayDepth, displayTimeout);  
  
    // Asegurarse de que los elementos existan antes de intentar actualizarlos  
    const currentScoreElem = document.getElementById('currentScoreDisplay');  
    const currentDepthElem = document.getElementById('currentDepthDisplay');  
    const currentPVElem = document.getElementById('currentPVDisplay');  
    const bestMoveSuggestionElem = document.getElementById('bestMoveSuggestionDisplay');  
  
    if (currentScoreElem) {  
        currentScoreElem.textContent = result.score !== undefined ? result.score.toFixed(2) : 'N/A';  
    }  
    if (currentDepthElem) {  
        currentDepthElem.textContent = result.depth !== undefined ? result.depth : 'N/A';  
    }  
    if (currentPVElem) {  
        currentPVElem.textContent = result.pv && result.pv.length > 0 ? result.pv.join(' ') : 'N/A';  
    }  
    if (bestMoveSuggestionElem) {  
        bestMoveSuggestionElem.textContent = result.bestMove ? result.bestMove : 'N/A';  
    }  
  
    // Además, actualiza la barra de evaluación vertical y el score principal (si estas variables son globales)  
    // (Asumiendo que evalScore y updateEvalBar están definidas en game.js y son accesibles/globales)  
    if (typeof evalScore !== 'undefined') { // evalScore es el ID del div en el eval-bar-vertical  
        document.getElementById('evalScore').textContent = result.score !== undefined ? result.score.toFixed(1) : '0.0';  
    }  
    if (typeof updateEvalBar === 'function') { // updateEvalBar es una función en game.js  
        updateEvalBar(result.score);  
    }  
}  
  
// Exportar funciones si se usan módulos, de lo contrario, son globales  
// Por ahora, asumimos que son globales porque se carga con <script>  
// export { initializeStockfishEngine, getBestMoveStockfish, makeAIMove, updateEvaluationDisplay, evaluateWithStockfish };
