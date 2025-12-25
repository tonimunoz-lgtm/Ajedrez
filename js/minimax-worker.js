// js/minimax-worker.js  
  
// Importar la biblioteca Chess.js dentro del worker  
// Esto asume que Chess.js está disponible globalmente en el scope del worker  
// En un setup moderno con módulos, usarías `importScripts('chess.min.js');`  
// Sin embargo, si Chess.js se carga vía CDN en el HTML principal,  
// el worker no tendrá acceso a Chess por defecto.  
// La mejor forma es pasar el FEN y que el worker cree su propia instancia de Chess.  
self.importScripts('https://cdnjs.cloudflare.com/ajax/libs/chess.js/0.10.3/chess.min.js');  
  
// Importar la lógica de Minimax desde stockfish-ai.js  
// Esto es un poco hacky porque stockfish-ai.js no está diseñado como un módulo.  
// Lo más limpio sería refactorizar stockfish-ai.js para exportar minimax y evaluatePositionLocal.  
// Por simplicidad para esta respuesta, voy a copiar las funciones aquí,  
// o podrías usar `importScripts('stockfish-ai.js');` y luego acceder a las funciones.  
// Voy a copiar las funciones para que este worker sea autónomo.  
  
// ===================== VALORES GLOBALES DE PIEZAS (Copiado de stockfish-ai.js) =====================  
const pieceValues = { 'p': 100, 'n': 320, 'b': 330, 'r': 500, 'q': 900, 'k': 0 };  
  
// ===================== EVALUADOR LOCAL INTELIGENTE (Copiado de stockfish-ai.js) =====================  
function evaluatePositionLocal(gameState) {  
    const board = gameState.board();  
    let score = 0;  
  
    // pieceValues ya está definido globalmente arriba  
  
    // Tablas de valores posicionales (ejemplo simplificado)  
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
    ];  
    const kingEndgamePositional = [  
        [-50, -40, -30, -20, -20, -30, -40, -50],  
        [-30, -20, -10, 0, 0, -10, -20, -30],  
        [-30, -10, 20, 30, 30, 20, -10, -30],  
        [-30, -10, 30, 40, 40, 30, -10, -30],  
        [-30, -10, 30, 40, 40, 30, -10, -30],  
        [-30, -10, 20, 30, 30, 20, -10, -30],  
        [-30, -30, 0, 0, 0, 0, -30, -30],  
        [-50, -30, -30, -30, -30, -30, -30, -50]  
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
  
// ===================== MINIMAX CON PODA ALFA-BETA (Copiado de stockfish-ai.js) =====================  
function minimax(gameState, depth, alpha, beta, isMaximizing, difficulty) {  
    if (depth === 0 || gameState.game_over()) {  
        return evaluatePositionLocal(gameState);  
    }  
  
    const moves = gameState.moves({ verbose: true });  
    if (moves.length === 0) {  
        return evaluatePositionLocal(gameState);  
    }  
  
    const moveLimits = { 1: 3, 2: 5, 3: 8, 4: 12, 5: moves.length };  
    const maxMovesToConsider = Math.min(moves.length, moveLimits[difficulty] || moves.length);  
  
    moves.sort((a, b) => {  
        let scoreA = 0;  
        let scoreB = 0;  
  
        if (a.captured) scoreA += pieceValues[a.captured];  
        if (b.captured) scoreB += pieceValues[b.captured];  
  
        if (a.captured && pieceValues[a.piece] < pieceValues[a.captured]) scoreA += 50;  
        if (b.captured && pieceValues[b.piece] < pieceValues[b.captured]) scoreB += 50;  
  
        if (a.promotion) scoreA += pieceValues[a.promotion];  
        if (b.promotion) scoreB += pieceValues[b.promotion];  
  
        return scoreB - scoreA;  
    });  
  
    if (isMaximizing) {  
        let maxEval = -Infinity;  
        for (let i = 0; i < maxMovesToConsider; i++) {  
            const move = moves[i];  
            const tempGame = new Chess(gameState.fen());  
            tempGame.move(move);  
  
            const eval = minimax(tempGame, depth - 1, alpha, beta, false, difficulty);  
  
            maxEval = Math.max(maxEval, eval);  
            alpha = Math.max(alpha, eval);  
            if (beta <= alpha) break;  
        }  
        return maxEval;  
    } else {  
        let minEval = Infinity;  
        for (let i = 0; i < maxMovesToConsider; i++) {  
            const move = moves[i];  
            const tempGame = new Chess(gameState.fen());  
            tempGame.move(move);  
  
            const eval = minimax(tempGame, depth - 1, alpha, beta, true, difficulty);  
  
            minEval = Math.min(minEval, eval);  
            beta = Math.min(beta, eval);  
            if (beta <= alpha) break;  
        }  
        return minEval;  
    }  
}  
  
// ===================== ENCONTRAR MEJOR MOVIMIENTO (Copiado de stockfish-ai.js) =====================  
function findBestMoveWithMinimax(gameState, depth, difficulty) {  
    const moves = gameState.moves({ verbose: true });  
    if (moves.length === 0) return null;  
  
    let bestMove = null;  
    let bestScore = -Infinity;  
  
    moves.sort((a, b) => {  
        let scoreA = 0;  
        let scoreB = 0;  
  
        if (a.captured) scoreA += pieceValues[a.captured];  
        if (b.captured) scoreB += pieceValues[b.captured];  
  
        if (a.captured && pieceValues[a.piece] < pieceValues[a.captured]) scoreA += 50;  
        if (b.captured && pieceValues[b.piece] < pieceValues[b.captured]) scoreB += 50;  
  
        if (a.promotion) scoreA += pieceValues[a.promotion];  
        if (b.promotion) scoreB += pieceValues[b.promotion];  
  
        return scoreB - scoreA;  
    });  
  
    for (const move of moves) {  
        const tempGame = new Chess(gameState.fen());  
        tempGame.move(move);  
  
        const score = minimax(tempGame, depth - 1, -Infinity, Infinity, false, difficulty);  
  
        if (score > bestScore) {  
            bestScore = score;  
            bestMove = move;  
        }  
    }  
  
    return bestMove;  
}  
  
// ===================== MANEJADOR DE MENSAJES DEL WORKER =====================  
self.onmessage = function(event) {  
    const { type, fen, depth, difficulty, taskId } = event.data;  
    const game = new Chess(fen);  
    let result = { bestMove: null, score: 0, depth: depth, pv: [] };  
  
    if (type === 'findBestMove') {  
        const bestMove = findBestMoveWithMinimax(game, depth, difficulty);  
        if (bestMove) {  
            result.bestMove = bestMove.from + bestMove.to + (bestMove.promotion ? bestMove.promotion : '');  
            // Para la PV, simplemente tomamos el mejor movimiento encontrado para esta búsqueda  
            result.pv = [result.bestMove];  
        }  
        result.score = evaluatePositionLocal(game); // Obtener la evaluación final del estado  
    } else if (type === 'evaluatePosition') {  
        result.score = evaluatePositionLocal(game);  
        // Para el display rápido, también podemos buscar un bestMove superficial  
        const bestMoveObj = findBestMoveWithMinimax(new Chess(fen), 2, 3); // Profundidad 2, dificultad media  
        if (bestMoveObj) {  
            result.bestMove = bestMoveObj.from + bestMoveObj.to + (bestMoveObj.promotion ? bestMoveObj.promotion : '');  
            result.pv = [result.bestMove];  
        }  
    }  
  
    self.postMessage({ type: 'result', result, taskId });  
};  
  
// Necesario para la conversión de PV  
// Asumimos que convertPvUciToSan no se llama directamente en el worker para análisis  
// sino que se prepara en el hilo principal.  
// Si se necesitara, habría que copiarla o importarla.  
