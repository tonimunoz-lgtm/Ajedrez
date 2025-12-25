// js/game.js  
  
// ===================== VARIABLES GLOBALES =====================  
const game = new Chess(); // Instancia principal del juego Chess.js  
let selectedSquare = null; // Cuadrado actualmente seleccionado por el jugador  
let highlights = []; // Cuadrados a resaltar (movimientos legales, selección)  
let lastFromSquare = null; // Origen del último movimiento  
let lastToSquare = null; // Destino del último movimiento  
let moveCount = 0; // Contador de movimientos  
let goodMoves = 0; // Contador de movimientos 'buenos' del jugador  
let badMoves = 0; // Contador de movimientos 'malos' del jugador  
let boardFlipped = false; // Estado del tablero (true si está girado)  
let aiThinking = false; // Bandera para indicar si la IA está pensando  
let playerElo = 1600; // ELO actual del jugador  
let currentStockfishScore = 0; // Almacena la última evaluación de Stockfish (desde la perspectiva de las blancas)  
  
// Variables de estadísticas (ejemplo, se pueden cargar/guardar en localStorage)  
let stats = { totalGames: 0, maxElo: 1600, sessions: 0 };  
  
// Símbolos de piezas para la visualización del tablero  
const pieceSymbols = {  
    'P': '♙', 'R': '♖', 'N': '♘', 'B': '♗', 'Q': '♕', 'K': '♔',  
    'p': '♟', 'r': '♜', 'n': '♞', 'b': '♝', 'q': '♛', 'k': '♚'  
};  
  
// Frases del entrenador para diferentes tipos de jugadas  
const coachPhrases = {  
    excellent: ["¡Perfecto! Esa es la mejor jugada.", "Increíble, análisis excelente.", "¡Óptimo movimiento!"],  
    good: ["Buen movimiento.", "Sigue así, buena elección.", "Movimiento sólido."],  
    mistake: ["Hay movimientos mejores.", "No es la mejor opción aquí.", "Cuidado con tu posición."],  
    blunder: ["¡Error grave!", "Pierdes ventaja importante.", "¡Cuidado, este movimiento es malo!"],  
    hint: ["Considera este movimiento:", "Una buena opción podría ser:", "Analiza esta jugada:"]  
};  
  
  
// ===================== EVALUACIÓN LOCAL (FALLBACK) =====================  
  
/**  
 * Función de evaluación heurística local, usada como fallback si Stockfish no está disponible.  
 * Evalúa la posición basándose en el material y una simplificación de movilidad.  
 * @returns {number} El score de la posición (positivo para blancas, negativo para negras).  
 */  
function _internalEvaluatePosition() {  
    const board = game.board();  
    let score = 0;  
    const pieceValues = { 'p': 1, 'n': 3, 'b': 3.25, 'r': 5, 'q': 9, 'k': 0 }; // Valores de piezas estándar  
  
    // Evaluar material  
    for (let i = 0; i < 8; i++) {  
        for (let j = 0; j < 8; j++) {  
            const piece = board[i][j];  
            if (!piece) continue;  
            const val = pieceValues[piece.type] || 0;  
            if (piece.color === 'w') {  
                score += val;  
            } else {  
                score -= val;  
            }  
        }  
    }  
  
    // Evaluar movilidad (muy simplista)  
    // Se añade un pequeño valor por cada movimiento legal posible.  
    // Stockfish hace esto mucho más sofisticado.  
    const moves = game.moves();  
    score += (moves.length * 0.05) * (game.turn() === 'w' ? 1 : -1);  
  
    return score;  
}  
  
/**  
 * Calcula las probabilidades de victoria para blancas, negras y tablas basándose en el score de Stockfish.  
 * Utiliza una función logística ajustada para mapear el score a probabilidades.  
 * @param {number} score - El score de la posición en centipeones (positivo para blancas).  
 * @returns {object} Un objeto con las probabilidades en porcentaje.  
 */  
function calculateWinProbability(score) {  
    // k es un factor de escala ajustado para centipeones (tomado de stockfish.js en lichess)  
    const k = 0.00368208;  
    const whiteProb = 1 / (1 + Math.exp(-k * score)); // Probabilidad de victoria para las blancas  
  
    // Estimación simplificada de probabilidad de tablas:  
    // Si la posición es relativamente igual (score cercano a 0), hay más chances de tablas.  
    let drawProb = 0.0;  
    if (Math.abs(score) < 100) { // Si la ventaja es menor a 1 peón  
        // Ajuste heurístico para dar un rango de probabilidad de tablas  
        drawProb = 0.2 + (1 - whiteProb - (1 - whiteProb)) * 0.5;  
        drawProb = Math.min(0.5, Math.max(0.05, drawProb)); // Asegura un rango razonable (5%-50%)  
    }  
  
    const blackProb = 1 - whiteProb - drawProb;  
  
    return {  
        white: Math.round(whiteProb * 100),  
        black: Math.round(blackProb * 100),  
        draw: Math.round(drawProb * 100),  
        decisive: Math.round((whiteProb + blackProb) * 100) // Probabilidad de que el resultado no sea tablas  
    };  
}  
  
  
// ===================== RENDERIZADO DEL TABLERO =====================  
  
/**  
 * Renderiza el tablero de ajedrez en el elemento HTML 'board'.  
 * Dibuja cuadrados, piezas y aplica resaltados de selección/movimientos.  
 */  
function renderBoard() {  
    const boardEl = document.getElementById('board');  
    if (!boardEl) {  
        console.error("Elemento 'board' no encontrado.");  
        return;  
    }  
    boardEl.innerHTML = ''; // Limpiar el tablero existente  
  
    for (let row = 0; row < 8; row++) {  
        for (let col = 0; col < 8; col++) {  
            // Ajustar fila y columna si el tablero está girado  
            const r = boardFlipped ? 7 - row : row;  
            const c = boardFlipped ? 7 - col : col;  
            const square = String.fromCharCode(97 + c) + (8 - r); // Convertir a notación de cuadrado (ej. "a1", "h8")  
            const piece = game.get(square); // Obtener la pieza en ese cuadrado  
  
            const squareEl = document.createElement('div');  
            squareEl.className = 'square ' + ((r + c) % 2 === 0 ? 'light' : 'dark');  
  
            // Aplicar clases de estilo para selección y resaltados  
            if (selectedSquare === square) squareEl.classList.add('selected');  
            if (highlights.includes(square)) squareEl.classList.add('highlight');  
            if ((square === lastFromSquare || square === lastToSquare) && moveCount > 0) {  
                squareEl.classList.add('last-move');  
            }  
  
            // Mostrar la pieza si existe en el cuadrado  
            if (piece) {  
                squareEl.textContent = pieceSymbols[piece.type];  
                squareEl.style.color = piece.color === 'w' ? '#fff' : '#000';  
                // Añadir un pequeño text-shadow para mejorar la visibilidad  
                squareEl.style.textShadow = piece.color === 'w' ? '2px 2px 4px rgba(0,0,0,0.7)' : '1px 1px 3px rgba(255,255,255,0.7)';  
            }  
  
            // Añadir el evento click a cada cuadrado  
            squareEl.addEventListener('click', () => handleSquareClick(square));  
            boardEl.appendChild(squareEl);  
        }  
    }  
}  
  
  
// ===================== MANEJO DE CLICKS EN CUADRADOS =====================  
  
/**  
 * Maneja el evento de click en un cuadrado del tablero.  
 * Gestiona la selección de piezas, movimientos y la interacción con la IA.  
 * @param {string} square - La notación del cuadrado donde se hizo clic (ej. "e2").  
 */  
async function handleSquareClick(square) {  
    if (aiThinking || game.game_over()) return; // Ignorar clics si la IA está pensando o el juego terminó  
  
    const pieceOnClickedSquare = game.get(square);  
    const mode = document.getElementById('gameMode').value;  
  
    // Caso 1: Hay una pieza seleccionada  
    if (selectedSquare) {  
        const selectedPiece = game.get(selectedSquare);  
  
        // Si se hace clic en una pieza del mismo color que la seleccionada, cambiar selección  
        if (pieceOnClickedSquare && selectedPiece.color === pieceOnClickedSquare.color) {  
            selectedSquare = square;  
            highlights = game.moves({ square, verbose: true }).map(m => m.to);  
        } else {  
            // Intentar realizar el movimiento  
            const playerColor = selectedPiece.color; // Capturar el color del jugador antes de que se mueva  
  
            // Intentar con promoción a reina por defecto (chess.js la gestiona automáticamente si es necesaria)  
            const tempMove = { from: selectedSquare, to: square, promotion: 'q' };  
            const move = game.move(tempMove);  
  
            if (move) {  
                // Movimiento válido  
                lastFromSquare = selectedSquare;  
                lastToSquare = square;  
                moveCount++;  
                selectedSquare = null;  
                highlights = [];  
  
                // Evaluar la calidad del movimiento del jugador (asíncrono)  
                await evaluateMoveQuality(move);  
  
                // Si estamos en modo IA o entrenador y el juego no ha terminado  
                if ((mode === 'vs-ia' || mode === 'coach') && !game.game_over()) {  
                    aiThinking = true;  
                    // Mostrar indicador de pensamiento de la IA en el coachMessage  
                    document.getElementById('coachMessage').innerHTML = '<strong>Pensando...</strong> <span class="loading"></span>';  
                    document.getElementById('coachMessage').classList.remove('good', 'bad'); // Limpiar estilos previos  
  
                    // Pequeño retraso para la experiencia de usuario (ver mensaje "pensando")  
                    setTimeout(async () => {  
                        const aiMove = await window.makeAIMove(); // Obtener movimiento de la IA (de stockfish-ai.js)  
  
                        if (aiMove) {  
                            game.move(aiMove); // Aplicar movimiento de la IA  
                            lastFromSquare = aiMove.from;  
                            lastToSquare = aiMove.to;  
                            moveCount++;  
                        } else {  
                            console.error("La IA no pudo hacer un movimiento o el juego terminó.");  
                        }  
                        aiThinking = false; // La IA ha terminado de pensar  
                        updateUI(); // Actualizar toda la interfaz después del movimiento de la IA  
                    }, 1000); // 1 segundo de "pensamiento" visible  
                } else {  
                    // Si no hay IA o juego terminado, actualizar UI solo por el movimiento del jugador  
                    updateUI();  
                }  
            } else {  
                // Movimiento inválido, deseleccionar pieza y borrar resaltados  
                selectedSquare = null;  
                highlights = [];  
            }  
        }  
    } else if (pieceOnClickedSquare && pieceOnClickedSquare.color === game.turn()) {  
        // Caso 2: No hay pieza seleccionada, pero se hace clic en una pieza del turno actual  
        selectedSquare = square;  
        highlights = game.moves({ square, verbose: true }).map(m => m.to);  
    } else {  
        // Caso 3: Clic en cuadrado vacío o pieza del oponente sin pieza seleccionada  
        selectedSquare = null;  
        highlights = [];  
    }  
  
    renderBoard(); // Volver a dibujar el tablero para reflejar los cambios (selección, resaltados)  
}  
  
  
// ===================== EVALUAR CALIDAD DE MOVIMIENTO (CON STOCKFISH) =====================  
  
/**  
 * Evalúa la calidad del último movimiento del jugador utilizando Stockfish.  
 * Compara la evaluación de la posición antes y después del movimiento para dar feedback.  
 * @param {object} playerMove - El objeto de movimiento de chess.js que el jugador acaba de realizar.  
 */  
async function evaluateMoveQuality(playerMove) {  
    // Verificar si Stockfish está listo a través de la variable global 'engineReady' de stockfish-ai.js  
    if (!window.engineReady) {  
        giveCoachFeedback('good', "Stockfish no cargado, evaluación local."); // Fallback  
        return;  
    }  
  
    // Determinar el color del jugador que acaba de hacer el movimiento  
    // Obtenemos el color de la pieza que se movió, ya que game.turn() ya ha cambiado.  
    const playerColor = playerMove.color;   
  
    // Obtener la evaluación ANTES del movimiento del jugador  
    game.undo(); // Deshacer el movimiento del jugador para volver a la posición anterior  
    // Usamos evaluateWithStockfish de stockfish-ai.js  
    const prevEvalResult = await window.evaluateWithStockfish(10); // Profundidad moderada para rapidez  
    const prevScore = prevEvalResult.score; // Score desde la perspectiva de las blancas  
  
    game.move(playerMove); // Rehacer el movimiento del jugador  
  
    // Obtener la evaluación DESPUÉS del movimiento del jugador  
    const currentEvalResult = await window.evaluateWithStockfish(10);  
    const currentScore = currentEvalResult.score; // Score desde la perspectiva de las blancas  
  
    // Actualizar la evaluación global de Stockfish para la UI  
    currentStockfishScore = currentEvalResult.score;  
  
    // Calcular la diferencia en la puntuación desde la perspectiva del jugador que acaba de mover  
    let scoreDifference; // Representa cuánto mejoró/empeoró la posición para el jugador  
    if (playerColor === 'w') {  
        scoreDifference = currentScore - prevScore; // Si blancas movieron, un score más alto es mejor para ellas  
    } else { // playerColor === 'b'  
        scoreDifference = prevScore - currentScore; // Si negras movieron, un score más bajo (para blancas) es mejor para ellas  
    }  
  
    // Definir umbrales para clasificar la calidad del movimiento  
    let quality = 'good'; // Por defecto  
    if (scoreDifference > 1.0) { // Mejoró significativamente (ej. +1 peón)  
        quality = 'excellent';  
    } else if (scoreDifference > 0.2) { // Mejoró ligeramente (ej. +0.2 peones)  
        quality = 'good';  
    } else if (scoreDifference < -0.2 && scoreDifference >= -0.8) { // Empeoró un poco (entre -0.2 y -0.8 peones)  
        quality = 'mistake';  
    } else if (scoreDifference < -0.8) { // Empeoró mucho (más de -0.8 peones)  
        quality = 'blunder';  
    } else {  
        quality = 'good'; // Si el cambio es muy pequeño, se considera un movimiento neutral o bueno  
    }  
  
    // Actualizar contadores de buenos/malos movimientos  
    if (quality === 'excellent' || quality === 'good') goodMoves++;  
    if (quality === 'mistake' || quality === 'blunder') badMoves++;  
  
    // Dar feedback al jugador  
    giveCoachFeedback(quality);  
}  
  
  
// ===================== FEEDBACK DEL ENTRENADOR =====================  
  
/**  
 * Muestra un mensaje de feedback al jugador en el elemento 'coachMessage'.  
 * @param {string} type - Tipo de feedback (ej. 'excellent', 'good', 'mistake', 'blunder', 'hint').  
 * @param {string} [message=null] - Mensaje específico a mostrar. Si es null, se elige una frase aleatoria.  
 */  
function giveCoachFeedback(type, message = null) {  
    const mode = document.getElementById('gameMode').value;  
    if (mode === 'free') return; // No dar feedback en modo libre  
  
    const phrases = coachPhrases[type];  
    const phrase = message || phrases[Math.floor(Math.random() * phrases.length)]; // Elegir frase aleatoria si no se da mensaje  
  
    const coachMsg = document.getElementById('coachMessage');  
    if (!coachMsg) {  
        console.error("Elemento 'coachMessage' no encontrado.");  
        return;  
    }  
  
    let icon = '';  
    let className = 'coach-message'; // Clase base  
  
    // Asignar icono y clase de estilo según el tipo de feedback  
    if (type === 'excellent' || type === 'good') {  
        icon = '✅';  
        className += ' good';  
    } else if (type === 'mistake' || type === 'blunder') {  
        icon = '❌';  
        className += ' bad';  
    } else if (type === 'hint') {  
        icon = '💡';  
        className += ' good'; // Podrías tener una clase 'hint' específica para estilos  
    }  
        
    coachMsg.innerHTML = `<strong>${icon}</strong> ${phrase}`;  
    coachMsg.className = className; // Aplicar las clases  
}  
  
  
// ===================== ACTUALIZACIÓN DE LA INTERFAZ DE USUARIO =====================  
  
/**  
 * Actualiza todos los componentes de la interfaz de usuario.  
 * Esto incluye el tablero, la barra de evaluación, información del último movimiento, historial, etc.  
 */  
async function updateUI() {  
    renderBoard(); // Redibujar el tablero  
    // Llamada a la función global de stockfish-ai.js para actualizar la evaluación en el panel lateral  
    //await window.updateEvaluationDisplay();   
    updateLastMoveInfo(); // Actualizar información del último movimiento  
    updateMoveHistory(); // Actualizar historial de movimientos  
    updateStats(); // Actualizar estadísticas rápidas  
  
    if (game.game_over()) {  
        showGameOver(); // Mostrar mensaje de fin de partida  
    }  
}  
  
/**  
 * Actualiza visualmente la barra de evaluación vertical y el score numérico.  
 * Esta función es llamada por `window.updateEvaluationDisplay()` (en `stockfish-ai.js`).  
 * @param {number} score - El score de Stockfish actual de la posición.  
 */  
function updateEvalBar(score) {  
    const prob = calculateWinProbability(score);  
  
    // Mapear el score a un porcentaje para la altura de la barra.  
    // Un score de 1000 (10 peones) se considera una ventaja muy grande.  
    const maxScore = 1000;  
    let percentage = 50 + (score / (maxScore * 2)) * 100; // Normalizar a un rango de 0-100%  
    percentage = Math.min(100, Math.max(0, percentage)); // Asegurarse de que esté entre 0 y 100  
  
    const fillEl = document.getElementById('evalBarFill');  
    if(fillEl) {  
        fillEl.style.height = percentage + '%';  
        fillEl.textContent = Math.abs(score).toFixed(1); // Muestra el valor absoluto de la puntuación en peones  
        fillEl.className = 'eval-bar-fill'; // Resetear clases  
        if (score > 50) { // Ventaja de blancas (+0.5 peones)  
            fillEl.classList.add('white-advantage');  
        } else if (score < -50) { // Ventaja de negras (-0.5 peones)  
            fillEl.classList.add('black-advantage');  
        }  
    } else {  
        console.warn("Elemento 'evalBarFill' no encontrado.");  
    }  
      
    const evalScoreEl = document.getElementById('evalScore');  
    if(evalScoreEl) {  
        evalScoreEl.textContent = score.toFixed(2);  
    } else {  
        console.warn("Elemento 'evalScore' no encontrado.");  
    }  
  
    const winProbEl = document.getElementById('winProb');  
    if(winProbEl) {  
        winProbEl.innerHTML = `B:${prob.white}% N:${prob.black}%`;  
    } else {  
        console.warn("Elemento 'winProb' no encontrado.");  
    }  
}  
  
/**  
 * Actualiza la información del último movimiento del jugador.  
 */  
function updateLastMoveInfo() {  
    const el = document.getElementById('lastMoveInfo');  
    if (!el) {  
        console.warn("Elemento 'lastMoveInfo' no encontrado.");  
        return;  
    }  
  
    if (moveCount === 0) {  
        el.style.display = 'none';  
        return;  
    }  
  
    el.style.display = 'grid';  
    const history = game.history({ verbose: true });  
    const lastMove = history[history.length - 1];  
      
    const playerLastMoveEl = document.getElementById('playerLastMove');  
    if (playerLastMoveEl) {  
        playerLastMoveEl.textContent = lastMove?.san || '-';  
    } else {  
        console.warn("Elemento 'playerLastMove' no encontrado.");  
    }  
  
    const moveEvalEl = document.getElementById('moveEval');  
    if (moveEvalEl) {  
        moveEvalEl.textContent = currentStockfishScore.toFixed(2);  
    } else {  
        console.warn("Elemento 'moveEval' no encontrado.");  
    }  
}  
  
/**  
 * Actualiza el historial de movimientos en el panel lateral.  
 */  
function updateMoveHistory() {  
    const historyEl = document.getElementById('moveHistory');  
    if (!historyEl) {  
        console.warn("Elemento 'moveHistory' no encontrado.");  
        return;  
    }  
  
    historyEl.innerHTML = '';  
    const history = game.history(); // Obtiene los movimientos en notación SAN  
  
    if (history.length === 0) {  
        historyEl.innerHTML = '<p style="color: #888; text-align: center;">Movimientos aquí...</p>';  
        return;  
    }  
  
    let moveNum = 1;  
    let turnMoves = '';  
    for (let i = 0; i < history.length; i++) {  
        if (i % 2 === 0) { // Movimiento de blancas  
            if (i > 0) { // Añadir el turno anterior completo  
                historyEl.innerHTML += `<div class="move-item">${moveNum-1}. ${turnMoves}</div>`;  
            }  
            turnMoves = `${history[i]}`;  
            moveNum++;  
        } else { // Movimiento de negras  
            turnMoves += ` ${history[i]}`;  
        }  
    }  
    // Añadir el último turno (siempre habrá uno si history.length > 0)  
    historyEl.innerHTML += `<div class="move-item">${moveNum-1}. ${turnMoves}</div>`;  
      
    // Scroll automático al final del historial  
    historyEl.scrollTop = historyEl.scrollHeight;  
}  
  
/**  
 * Actualiza las estadísticas rápidas del juego.  
 */  
function updateStats() {  
    const moveCountEl = document.getElementById('moveCount');  
    if (moveCountEl) moveCountEl.textContent = moveCount;  
  
    // Los cálculos de precisión, buenos/malos movimientos son simplistas y requieren más lógica  
    // document.getElementById('accuracy').textContent = (goodMoves / (moveCount || 1) * 100).toFixed(0) + '%';  
    // document.getElementById('goodMoves').textContent = goodMoves;  
    // document.getElementById('badMoves').textContent = badMoves;  
  
    // Actualizar las estadísticas persistentes (si se implementan)  
    const totalGamesEl = document.getElementById('totalGames');  
    if (totalGamesEl) totalGamesEl.textContent = stats.totalGames;  
    const maxEloEl = document.getElementById('maxElo');  
    if (maxEloEl) maxEloEl.textContent = stats.maxElo;  
    const currentEloEl = document.getElementById('currentElo');  
    if (currentEloEl) currentEloEl.textContent = playerElo;  
    const sessionsEl = document.getElementById('sessions');  
    if (sessionsEl) sessionsEl.textContent = stats.sessions;  
}  
  
/**  
 * Muestra el mensaje de Game Over cuando la partida finaliza.  
 */  
function showGameOver() {  
    let message = '';  
    if (game.in_checkmate()) {  
        message = `¡Jaque Mate! ${game.turn() === 'w' ? 'Negras' : 'Blancas'} ganan.`;  
    } else if (game.in_draw()) {  
        message = "¡Tablas!";  
    } else if (game.in_stalemate()) {  
        message = "¡Ahogado! Tablas.";  
    } else if (game.in_threefold_repetition()) {  
        message = "¡Tablas por triple repetición!";  
    } else if (game.insufficient_material()) {  
        message = "¡Tablas por material insuficiente!";  
    }  
    const coachMsg = document.getElementById('coachMessage');  
    if (coachMsg) {  
        coachMsg.innerHTML = `<strong>Game Over!</strong> ${message}`;  
        coachMsg.classList.add('good'); // Podría ser una clase 'game-over'  
    }  
}  
  
  
// ===================== CONTROLES DEL JUEGO =====================  
  
/**  
 * Reinicia el juego a la posición inicial.  
 */  
async function resetGame() {  
    game.reset(); // Restablecer el estado del juego  
    selectedSquare = null;  
    highlights = [];  
    lastFromSquare = null;  
    lastToSquare = null;  
    moveCount = 0;  
    goodMoves = 0;  
    badMoves = 0;  
    boardFlipped = false; // Asegurarse de que el tablero no esté girado al reiniciar  
    aiThinking = false;  
    currentStockfishScore = 0; // Reiniciar la evaluación de Stockfish  
  
    const coachMsg = document.getElementById('coachMessage');  
    if (coachMsg) {  
        coachMsg.innerHTML = '<strong>¡Bienvenido!</strong> Realiza tu primer movimiento.';  
        coachMsg.classList.remove('good', 'bad'); // Limpiar estilos  
    }  
    const lastMoveInfoEl = document.getElementById('lastMoveInfo');  
    if (lastMoveInfoEl) lastMoveInfoEl.style.display = 'none';  
  
    // Actualizar la evaluación para la posición inicial (llamada a stockfish-ai.js)  
    await window.updateEvaluationDisplay();   
    updateUI(); // Actualizar toda la interfaz  
}  
  
/**  
 * Deshace los últimos movimientos (del jugador y de la IA si aplica).  
 */  
async function undoMove() {  
    if (aiThinking) return; // No deshacer si la IA está pensando  
  
    game.undo(); // Deshace el último movimiento (del jugador)  
    if (game.history().length > 0) { // Si hay movimientos previos, deshacer también el de la IA  
        game.undo();  
    }  
    moveCount = game.history().length; // Sincronizar moveCount con el historial real  
  
    // Re-evaluar la posición después de deshacer (llamada a stockfish-ai.js)  
    await window.updateEvaluationDisplay();   
    updateUI(); // Actualizar toda la interfaz  
}  
  
/**  
 * Gira el tablero para cambiar la perspectiva del jugador.  
 */  
function flipBoard() {  
    boardFlipped = !boardFlipped;  
    renderBoard(); // Redibujar el tablero con la nueva orientación  
}  
  
/**  
 * Solicita una pista a Stockfish para el mejor movimiento en la posición actual.  
 */  
async function requestHint() {  
    if (game.game_over() || aiThinking) return;  
  
    // Verificar si Stockfish está disponible  
    if (!window.engineReady) {  
        giveCoachFeedback('hint', "Stockfish no está cargado. No puedo dar una pista precisa.");  
        return;  
    }  
  
    giveCoachFeedback('hint', 'Pensando en la mejor pista... <span class="loading"></span>');  
    aiThinking = true; // Establecer bandera para evitar clics duplicados  
  
    // Determinar la profundidad de la pista basada en la dificultad seleccionada  
    const difficultyElem = document.getElementById('difficulty');  
    const difficulty = difficultyElem ? parseInt(difficultyElem.value) : 3;  
    const hintDepth = difficulty * 3 + 6; // Por ejemplo, 9 para novato, 21 para maestro  
    const hintTimeout = 5000; // Timeout de 5 segundos para la pista  
  
    // Solicitar el mejor movimiento a Stockfish  
    const result = await window.evaluateWithStockfish(hintDepth, hintTimeout);  
  
    aiThinking = false; // La IA ha terminado de pensar para la pista  
  
    if (result.bestMove) {  
        const from = result.bestMove.substring(0, 2);  
        const to = result.bestMove.substring(2, 4);  
        selectedSquare = from; // Seleccionar el cuadrado de origen de la pista  
        highlights = [to]; // Resaltar el cuadrado de destino de la pista  
        renderBoard(); // Redibujar el tablero para mostrar la pista visualmente  
          
        // Convertir la PV de UCI a SAN para la pista  
        let pvHintSan = '';  
        if (result.pv && result.pv.length > 0) {  
            pvHintSan = convertPvUciToSan(result.pv, game.fen());  
        }  
  
        // Mostrar la pista con el movimiento y la Variante Principal  
        giveCoachFeedback('hint', `Considera mover ${from}-${to}. PV: ${pvHintSan || 'N/A'}`);  
    } else {  
        giveCoachFeedback('hint', "No pude encontrar una buena pista. ¿Hay un error?");  
    }  
}  
  
/**  
 * Abre el modal de análisis detallado.  
 */  
async function analysisMode() {  
    const analysisModal = document.getElementById('analysisModal');  
    if (analysisModal) analysisModal.classList.add('active');  
  
    const analysisLoading = document.getElementById('analysisLoading');  
    if (analysisLoading) analysisLoading.style.display = 'inline-block';  
    const analysisStatus = document.getElementById('analysisStatus');  
    if (analysisStatus) analysisStatus.textContent = 'Analizando posición...';  
  
    await performAnalysis(); // Esperar a que el análisis se complete  
}  
  
/**  
 * Cierra el modal de análisis detallado.  
 */  
function closeAnalysis() {  
    const analysisModal = document.getElementById('analysisModal');  
    if (analysisModal) analysisModal.classList.remove('active');  
}  
  
/**  
 * Realiza un análisis profundo de la posición actual y muestra los resultados en el modal.  
 */  
async function performAnalysis() {  
    // Verificar si Stockfish está disponible  
    if (!window.engineReady) {  
        const analysisStatus = document.getElementById('analysisStatus');  
        if (analysisStatus) analysisStatus.textContent = '⚠️ Stockfish no está disponible para análisis detallado.';  
        const analysisLoading = document.getElementById('analysisLoading');  
        if (analysisLoading) analysisLoading.style.display = 'none';  
          
        // --- Fallback a evaluación local si Stockfish no está disponible ---  
        const localScore = _internalEvaluatePosition();  
        const localProb = calculateWinProbability(localScore);  
  
        // Actualizar elementos del modal con valores locales/predefinidos  
        document.getElementById('currentScore').innerHTML = localScore.toFixed(2);  
        document.getElementById('whiteWinProb').innerHTML = localProb.white + '%';  
        document.getElementById('drawProb').innerHTML = localProb.draw + '%';  
        document.getElementById('blackWinProb').innerHTML = localProb.black + '%';  
        document.getElementById('anyWinProb').innerHTML = localProb.decisive + '%';  
        document.getElementById('bestMoveAnalysis').innerHTML = '-';  
        document.getElementById('analysisDepth').innerHTML = 'N/A';  
        document.getElementById('principalVariation').innerHTML = 'N/A (Stockfish no disponible)';  
        document.getElementById('openingEval').innerHTML = '-';  
        document.getElementById('middlegameEval').innerHTML = '-';  
        document.getElementById('endgameEval').innerHTML = '-';  
        document.getElementById('materialEval').innerHTML = _internalEvaluatePosition().toFixed(2);  
        return;  
    }  
  
    const analysisStatus = document.getElementById('analysisStatus');  
    if (analysisStatus) analysisStatus.textContent = 'Analizando posición...';  
    const analysisLoading = document.getElementById('analysisLoading');  
    if (analysisLoading) analysisLoading.style.display = 'inline-block';  
  
    const analysisDepth = 24; // Profundidad alta para un análisis detallado  
    const analysisTimeout = 15000; // Timeout generoso (15 segundos) para este análisis profundo  
    const result = await window.evaluateWithStockfish(analysisDepth, analysisTimeout); // Llamada a stockfish-ai.js  
  
    const score = result.score;  
    const prob = calculateWinProbability(score); // Probabilidades basadas en el score de Stockfish  
    const bestMoveUci = result.bestMove;  
    let bestMoveSan = '-';  
  
    // Convertir el mejor movimiento UCI a notación SAN para mostrarlo  
    if (bestMoveUci) {  
        // Usamos una instancia temporal de Chess.js para esta conversión sin alterar el juego principal  
        const tempGameForSan = new Chess(game.fen());  
        const from = bestMoveUci.substring(0, 2);  
        const to = bestMoveUci.substring(2, 4);  
        const promotion = bestMoveUci.length > 4 ? bestMoveUci[4].toLowerCase() : undefined;  
        const tempMove = tempGameForSan.move({ from, to, promotion });  
        if (tempMove) {  
            bestMoveSan = tempMove.san;  
        } else {  
            console.warn("No se pudo convertir el bestMove UCI a SAN:", bestMoveUci);  
            bestMoveSan = bestMoveUci; // Si falla la conversión, mostrar el UCI directamente  
        }  
    }  
  
    // --- Actualizar elementos del modal con los resultados del análisis ---  
    document.getElementById('whiteWinProb').innerHTML = prob.white + '%';  
    document.getElementById('drawProb').innerHTML = prob.draw + '%';  
    document.getElementById('blackWinProb').innerHTML = prob.black + '%';  
    document.getElementById('anyWinProb').innerHTML = prob.decisive + '%';  
    document.getElementById('currentScore').innerHTML = score.toFixed(2);  
    document.getElementById('bestMoveAnalysis').innerHTML = bestMoveSan;  
    document.getElementById('analysisDepth').innerHTML = result.depth + ' movimientos';  
  
    // MOSTRAR LA VARIANTE PRINCIPAL (PV) CONVERTIENDO A SAN  
    const principalVariationEl = document.getElementById('principalVariation');  
    if (principalVariationEl) {  
        if (result.pv && result.pv.length > 0) {  
            // Convertir la PV de UCI a SAN usando la nueva función  
            const pvSan = convertPvUciToSan(result.pv, game.fen());  
            principalVariationEl.innerHTML = pvSan;  
        } else {  
            principalVariationEl.innerHTML = 'No se encontró variante principal.';  
        }  
    } else {  
        console.warn("Elemento 'principalVariation' no encontrado.");  
    }  
  
    // Evaluación por fases del juego y material  
    // Esto se hace con lógica local ya que Stockfish solo devuelve el score total por defecto  
    const board = game.board();  
    let material = 0;  
    const pieceValues = { 'p': 1, 'n': 3, 'b': 3.25, 'r': 5, 'q': 9 };  
    for (let row of board) {  
        for (let p of row) {  
            if (!p) continue;  
            const val = pieceValues[p.type] || 0;  
            material += p.color === 'w' ? val : -val;  
        }  
    }  
    const history = game.history({ verbose: true });  
    // Heurística simple para determinar la fase del juego  
    const phase = history.length < 10 ? 'Apertura' : history.length < 40 ? 'Medio Juego' : 'Final';  
  
    document.getElementById('materialEval').innerHTML = material.toFixed(2);  
    // Para la evaluación por fase, se muestra el score total de Stockfish,  
    // ya que no tenemos scores específicos por fase directamente de Stockfish.  
    document.getElementById('openingEval').innerHTML = phase === 'Apertura' ? score.toFixed(2) : '-';  
    document.getElementById('middlegameEval').innerHTML = phase === 'Medio Juego' ? score.toFixed(2) : '-';  
    document.getElementById('endgameEval').innerHTML = phase === 'Final' ? score.toFixed(2) : '-';  
  
    // Finalizar el estado de carga  
    if (analysisStatus) analysisStatus.textContent = '✅ Análisis completado';  
    if (analysisLoading) analysisLoading.style.display = 'none';  
}  
  
  
// ===================== CONVERTIDOR UCI A SAN PARA PV =====================  
  
/**  
 * Convierte una secuencia de movimientos en notación UCI (Universal Chess Interface)  
 * a notación SAN (Standard Algebraic Notation).  
 *  
 * @param {string[]} pvUciArray - Un array de strings de movimientos en formato UCI (ej. ['e2e4', 'e7e5', 'g1f3']).  
 * @param {string} initialFen - El FEN de la posición desde donde comienza la PV.  
 * @returns {string} La secuencia de movimientos convertida a SAN (ej. "e4 e5 Nf3").  
 */  
function convertPvUciToSan(pvUciArray, initialFen) {  
    // Creamos una instancia temporal de Chess.js para simular la PV  
    // sin afectar el estado actual del juego principal.  
    const tempGame = new Chess(initialFen);  
    const pvSanArray = [];  
  
    for (const uciMove of pvUciArray) {  
        // Parsear el movimiento UCI en sus componentes  
        const from = uciMove.substring(0, 2);  
        const to = uciMove.substring(2, 4);  
        // La promoción es el quinto carácter si existe (ej. 'e7e8q'), se pasa a minúscula para chess.js  
        const promotion = uciMove.length > 4 ? uciMove[4].toLowerCase() : undefined;  
  
        try {  
            // Intentar hacer el movimiento en la instancia temporal del juego  
            // Chess.js devolverá el objeto de movimiento con la propiedad 'san'  
            const move = tempGame.move({ from, to, promotion });  
            if (move) {  
                pvSanArray.push(move.san);  
            } else {  
                // Si por alguna razón el movimiento UCI no es válido en el contexto de tempGame,  
                // lo añadimos tal cual y emitimos una advertencia. Esto no debería pasar con PVs válidas de Stockfish.  
                console.warn(`Movimiento UCI inválido en PV: '${uciMove}' en FEN: '${tempGame.fen()}'`);  
                pvSanArray.push(uciMove); // Fallback a UCI si no se puede convertir a SAN  
            }  
        } catch (error) {  
            console.error(`Error al procesar movimiento UCI '${uciMove}' en FEN '${tempGame.fen()}':`, error);  
            pvSanArray.push(uciMove); // Añadir el UCI si hay un error en el procesamiento  
        }  
    }  
    return pvSanArray.join(' '); // Unir todos los movimientos SAN con espacios  
}  
  
  
// ===================== EXPORTAR GLOBALES =====================  
// Asignamos variables y funciones al objeto `window` para que sean accesibles  
// desde otros scripts o el HTML directamente, ya que no estamos usando módulos ES6.  
window.game = game;  
window.updateEvalBar = updateEvalBar; // Necesario para que stockfish-ai.js pueda llamarla  
window.renderBoard = renderBoard; // Puede que se necesite en index.html  
window.updateUI = updateUI; // La función principal para refrescar la interfaz  
window.resetGame = resetGame;  
window.undoMove = undoMove;  
window.flipBoard = flipBoard;  
window.requestHint = requestHint;  
window.analysisMode = analysisMode;  
window.closeAnalysis = closeAnalysis;  
window.convertPvUciToSan = convertPvUciToSan; // La nueva función de conversión  
