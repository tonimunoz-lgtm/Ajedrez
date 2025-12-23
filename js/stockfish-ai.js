// ===================== STOCKFISH - MOTOR REAL =====================  
let engine = null; // Esto será una referencia al objeto global Stockfish (A)  
let engineReady = false;  
  
// Esta función debe ser llamada después de que stockfish.js se haya cargado  
// y cuando el DOM esté listo (DOMContentLoaded).  
async function initializeStockfishEngine() { // Renombrada para evitar conflictos y claridad  
    try {  
        // La variable global `Stockfish` es establecida por el script js/stockfish.js  
        // Suponemos que ya está cargado.  
          
        // Esperamos a que el motor interno de Stockfish esté listo.  
        // Stockfish.ready es una promesa definida en el stockfish.js que nos proporcionaste.  
        engine = Stockfish; // Asignamos la referencia al objeto global Stockfish  
        await engine.ready; // Esperamos la promesa 'ready'  
          
        engineReady = true;  
        console.log('✅ Stockfish WASM cargado y listo.');  
        document.getElementById('coachMessage').innerHTML = '<strong>✅ Stockfish Real</strong> Motor profesional activado.';  
  
        // Comandos UCI iniciales para configurar el motor  
        engine.postMessage('uci');  
        engine.postMessage('isready'); // Esperar 'readyok' para confirmar  
        engine.postMessage('ucinewgame');  
  
        // Escuchar 'readyok' antes de proceder, si es necesario, pero engine.ready ya lo cubrió.  
        // Podrías poner una pequeña demora si los comandos iniciales necesitan asentarse.  
        // setTimeout(() => { ... }, 100);  
  
    } catch (e) {  
        console.error('Error inicializando Stockfish:', e);  
        engineReady = false;  
        document.getElementById('coachMessage').innerHTML = '<strong>⚠️ Stockfish No Disponible</strong> Usando análisis local. (Revisa la consola)';  
    }  
}  
  
// ===================== EVALUAR CON STOCKFISH REAL =====================  
function evaluateWithStockfish(depth = 20) {  
    return new Promise((resolve) => {  
        if (!engineReady || !engine) {  
            resolve({ score: 0, bestMove: null, depth: 0, pv: [] });  
            return;  
        }  
  
        let bestMove = null;  
        let score = 0;  
        let depthReached = 0;  
        let pv = [];  
        let isResolved = false;  
  
        // Establecer un timeout si Stockfish tarda demasiado  
        const timeout = setTimeout(() => {  
            if (!isResolved) {  
                isResolved = true;  
                // Si el análisis no termina a tiempo, enviamos 'stop'  
                engine.postMessage('stop');   
                resolve({ score, bestMove, depth: depthReached, pv });  
            }  
        }, 5000); // 5 segundos de tiempo máximo para la evaluación  
  
        // Listener específico para esta llamada de evaluación  
        // Ojo: Si hay múltiples llamadas concurrentes a evaluateWithStockfish,  
        // este listener se sobrescribirá. Lo ideal sería usar `A.addMessageListener`  
        // para un listener general y filtrar mensajes.  
        // Para simplificar, asumimos que no habrá llamadas concurrentes complejas.  
        const originalOnMessage = engine.onmessage; // Guarda el original si existe  
  
        engine.onmessage = (message) => {  
            // El mensaje de Stockfish viene en event.data si es un Worker,  
            // pero si es el objeto global, es directamente el string.  
            const data = typeof message === 'string' ? message : message.data;  
  
            if (isResolved) return; // Ya se resolvió, ignora mensajes posteriores  
  
            // `bestmove` es la señal final para resolver la promesa  
            if (data.startsWith('bestmove')) {  
                isResolved = true;  
                clearTimeout(timeout);  
                const match = data.match(/bestmove (\S+)/);  
                if (match) bestMove = match[1];  
                  
                engine.onmessage = originalOnMessage; // Restaurar el listener original  
                resolve({ score, bestMove, depth: depthReached, pv });  
            }  
  
            // Procesar la información de análisis  
            if (data.startsWith('info')) {  
                // Score  
                const scoreMatch = data.match(/score (cp|mate) (-?\d+)/);  
                if (scoreMatch) {  
                    if (scoreMatch[1] === 'cp') {  
                        score = parseInt(scoreMatch[2]) / 100; // Centipeones a peones  
                    } else if (scoreMatch[1] === 'mate') {  
                        // Un valor muy alto/bajo para mate  
                        score = scoreMatch[2] > 0 ? 9999 : -9999;   
                    }  
                }  
  
                // Depth  
                const depthMatch = data.match(/depth (\d+)/);  
                if (depthMatch) {  
                    depthReached = parseInt(depthMatch[1]);  
                }  
  
                // Principal Variation (PV)  
                const pvMatch = data.match(/pv (.+)/);  
                if (pvMatch) {  
                    pv = pvMatch[1].split(' ');  
                }  
            }  
        };  
  
        try {  
            engine.postMessage('position fen ' + game.fen());  
            engine.postMessage('go depth ' + depth);  
        } catch (e) {  
            if (!isResolved) {  
                isResolved = true;  
                clearTimeout(timeout);  
                engine.onmessage = originalOnMessage;  
                resolve({ score: 0, bestMove: null, depth: 0, pv: [] });  
            }  
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
