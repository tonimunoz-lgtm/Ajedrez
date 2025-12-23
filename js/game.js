// ===================== VARIABLES GLOBALES =====================  
const game = new Chess();  
let selectedSquare = null;  
let highlights = [];  
let lastFromSquare = null;  
let lastToSquare = null;  
let moveCount = 0;  
let goodMoves = 0;  
let badMoves = 0;  
let boardFlipped = false;  
let aiThinking = false;  
let playerElo = 1600;  
let currentStockfishScore = 0; // Guardaremos la última evaluación de Stockfish aquí  
let stats = { totalGames: 0, maxElo: 1600, sessions: 0 };  
  
const pieceSymbols = {  
    'P': '♙', 'R': '♖', 'N': '♘', 'B': '♗', 'Q': '♕', 'K': '♔',  
    'p': '♟', 'r': '♜', 'n': '♞', 'b': '♝', 'q': '♛', 'k': '♚'  
};  
  
const coachPhrases = {  
    excellent: ["¡Perfecto! Esa es la mejor jugada.", "Increíble, análisis excelente.", "¡Óptimo movimiento!"],  
    good: ["Buen movimiento.", "Sigue así, buena elección.", "Movimiento sólido."],  
    mistake: ["Hay movimientos mejores.", "No es la mejor opción aquí.", "Cuidado con tu posición."],  
    blunder: ["¡Error grave!", "Pierdes ventaja importante.", "¡Cuidado, este movimiento es malo!"],  
    hint: ["Considera este movimiento:", "Una buena opción podría ser:", "Analiza esta jugada:"]  
};  
  
  
// ===================== EVALUACIÓN Y PROBABILIDADES (AHORA BASADO EN STOCKFISH) =====================  
// Estas funciones ahora usarán el `currentStockfishScore` que se actualizará con Stockfish  
async function updateGameEvaluation() {  
    if (!engineReady) { // Si Stockfish no está listo, usamos la evaluación heurística local (temporal)  
        currentStockfishScore = _internalEvaluatePosition(); // Tu función original, renombrada  
        return;  
    }  
    const result = await evaluateWithStockfish(10); // Profundidad moderada para actualización constante  
    currentStockfishScore = result.score;  
    // console.log("Stockfish Score:", currentStockfishScore); // Para depuración  
}  
  
function _internalEvaluatePosition() { // Tu antigua evaluatePosition, renombrada para fallback  
    const board = game.board();  
    let score = 0;  
    const pieceValues = { 'p': 1, 'n': 3, 'b': 3.25, 'r': 5, 'q': 9, 'k': 0 };  
      
    // Material  
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
  
    // Movilidad (muy simplista, Stockfish hace esto mucho mejor)  
    const moves = game.moves();  
    score += (moves.length * 0.05) * (game.turn() === 'w' ? 1 : -1); // Suma si es tu turno, resta si es del oponente  
  
    return score;  
}  
  
function calculateWinProbability(score) {  
    // Función de cálculo de probabilidad de victoria basada en el score de Stockfish  
    // El score de Stockfish está en centipeones. Una puntuación de 200 (2 peones) ya es significativa.  
    // Usaremos una función logística (sigmoid) ajustada para valores de Stockfish.  
    // k es un factor de escala, t es el umbral para 50/50.  
    const k = 0.00368208; // Ajustado para centipeones, de stockfish.js en lichess  
    const whiteProb = 1 / (1 + Math.exp(-k * score)); // Probabilidad de ganar para las blancas  
  
    // Para tablas, podemos estimar un porcentaje.  
    // Una simplificación: asumiendo que si la probabilidad de victoria para un lado no es muy alta, hay chances de tablas.  
    // Esto es muy simplificado, Stockfish puede dar probabilidades de tablas, pero el wrapper actual no lo expone.  
    let drawProb = 0.0;  
    if (Math.abs(score) < 100) { // Si la posición es relativamente igual (-1 a +1 peón)  
        drawProb = 0.2 + (1 - whiteProb - (1-whiteProb)) * 0.5; // Ajuste heurístico  
        drawProb = Math.min(0.5, Math.max(0.05, drawProb)); // Aseguramos que esté en un rango razonable  
    }  
  
    const blackProb = 1 - whiteProb - drawProb;  
  
    return {  
        white: Math.round(whiteProb * 100),  
        black: Math.round(blackProb * 100),  
        draw: Math.round(drawProb * 100),  
        // Decisive es la suma de ganar para blancas o negras  
        decisive: Math.round((whiteProb + blackProb) * 100)  
    };  
}  
  
  
// ===================== RENDER BOARD =====================  
// (Sin cambios, ya está bien)  
function renderBoard() {  
    const boardEl = document.getElementById('board');  
    boardEl.innerHTML = '';  
  
    for (let row = 0; row < 8; row++) {  
        for (let col = 0; col < 8; col++) {  
            const r = boardFlipped ? 7 - row : row;  
            const c = boardFlipped ? 7 - col : col;  
            const square = String.fromCharCode(97 + c) + (8 - r);  
            const piece = game.get(square);  
  
            const squareEl = document.createElement('div');  
            squareEl.className = 'square ' + ((r + c) % 2 === 0 ? 'light' : 'dark');  
  
            if (selectedSquare === square) squareEl.classList.add('selected');  
            if (highlights.includes(square)) squareEl.classList.add('highlight');  
            if ((square === lastFromSquare || square === lastToSquare) && moveCount > 0) {  
                squareEl.classList.add('last-move');  
            }  
  
            if (piece) {  
                squareEl.textContent = pieceSymbols[piece.type];  
                squareEl.style.color = piece.color === 'w' ? '#fff' : '#000';  
                squareEl.style.textShadow = piece.color === 'w' ? '2px 2px 4px #000' : '1px 1px 3px #fff';  
            }  
  
            squareEl.addEventListener('click', () => handleSquareClick(square));  
            boardEl.appendChild(squareEl);  
        }  
    }  
}  
  
// ===================== HANDLE SQUARE CLICK =====================  
async function handleSquareClick(square) { // Convertido a async  
    if (aiThinking || game.game_over()) return;  
  
    const piece = game.get(square);  
  
    if (selectedSquare && piece && game.get(selectedSquare).color === piece.color) {  
        selectedSquare = square;  
        highlights = game.moves({ square, verbose: true }).map(m => m.to);  
    } else if (selectedSquare) {  
        const tempMove = { from: selectedSquare, to: square, promotion: 'q' }; // Intenta con promoción a reina por defecto  
  
        const move = game.move(tempMove);  
  
        if (move) {  
            lastFromSquare = selectedSquare;  
            lastToSquare = square;  
            moveCount++;  
            selectedSquare = null;  
            highlights = [];  
  
            // Evaluar la calidad del movimiento antes de que se mueva la IA  
            await evaluateMoveQuality(move); // Esperamos la evaluación de Stockfish  
  
            const mode = document.getElementById('gameMode').value;  
            if ((mode === 'vs-ia' || mode === 'coach') && !game.game_over()) {  
                aiThinking = true;  
                // Muestra un indicador de pensamiento de la IA  
                document.getElementById('coachMessage').innerHTML = '<strong>Pensando...</strong> <span class="loading"></span>';  
                document.getElementById('coachMessage').classList.remove('good', 'bad'); // Limpia estilos  
  
                // Retraso para que el usuario vea el movimiento y el mensaje de "pensando"  
                setTimeout(async () => {  
                    await makeAIMove(); // Ahora makeAIMove es asíncrono  
                    aiThinking = false; // Importante resetear esto después de que la IA ha movido  
                    updateUI(); // Actualizar la UI después del movimiento de la IA y su evaluación  
                }, 1000); // 1 segundo de "pensamiento" visible  
            } else {  
                await updateGameEvaluation(); // Actualiza la evaluación del tablero después del movimiento del jugador  
                updateUI();  
            }  
        } else {  
            selectedSquare = null;  
            highlights = [];  
        }  
    } else if (piece && piece.color === game.turn()) {  
        selectedSquare = square;  
        highlights = game.moves({ square, verbose: true }).map(m => m.to);  
    }  
  
    renderBoard();  
}  
  
// ===================== EVALUAR CALIDAD DE MOVIMIENTO (CON STOCKFISH) =====================  
async function evaluateMoveQuality(playerMove) {  
    if (!engineReady) {  
        giveCoachFeedback('good'); // Fallback si Stockfish no está cargado  
        return;  
    }  
  
    // Obtener la evaluación antes del movimiento del jugador  
    game.undo(); // Deshacer el movimiento del jugador para evaluar la posición ANTES  
    const prevEvalResult = await evaluateWithStockfish(10); // Profundidad de 10 para una evaluación rápida  
    game.move(playerMove); // Rehacer el movimiento del jugador  
  
    // Obtener la evaluación después del movimiento del jugador  
    const currentEvalResult = await evaluateWithStockfish(10); // Profundidad de 10  
  
    const prevScore = prevEvalResult.score;  
    const currentScore = currentEvalResult.score;  
  
    // Ajustar la puntuación según el turno  
    const turnMultiplier = game.turn() === 'b' ? 1 : -1; // Si es turno de las negras, el movimiento del jugador blanco es positivo, si es turno de las blancas, el movimiento del jugador negro es negativo.  
  
    // El `currentStockfishScore` debe reflejar la evaluación después del movimiento del jugador  
    currentStockfishScore = currentEvalResult.score;  
  
  
    // Calcular la diferencia en la puntuación desde la perspectiva del jugador que acaba de mover  
    let scoreDifference;  
    if (game.turn() === 'b') { // Si las negras están a punto de mover (jugador blanco acaba de mover)  
        scoreDifference = currentScore - prevScore;  
    } else { // Si las blancas están a punto de mover (jugador negro acaba de mover)  
        scoreDifference = prevScore - currentScore; // Invertimos para el punto de vista del jugador negro  
    }  
  
  
    // Ajustar los umbrales para la retroalimentación  
    let quality = 'good';  
    if (scoreDifference > 1.5) { // Mejoró mucho la posición (1.5 peones)  
        quality = 'excellent';  
    } else if (scoreDifference > 0.3) { // Mejoró la posición (0.3 peones)  
        quality = 'good';  
    } else if (scoreDifference < -0.3 && scoreDifference >= -1) { // Empeoró un poco (0.3 a 1 peón)  
        quality = 'mistake';  
    } else if (scoreDifference < -1) { // Empeoró mucho (más de 1 peón)  
        quality = 'blunder';  
    }  
  
    if (quality === 'excellent' || quality === 'good') goodMoves++;  
    if (quality === 'mistake' || quality === 'blunder') badMoves++;  
  
    giveCoachFeedback(quality);  
}  
  
// ===================== FEEDBACK DEL ENTRENADOR =====================  
function giveCoachFeedback(type, message = null) {  
    const mode = document.getElementById('gameMode').value;  
    if (mode === 'free') return;  
  
    const phrases = coachPhrases[type];  
    const phrase = message || phrases[Math.floor(Math.random() * phrases.length)];  
  
    const coachMsg = document.getElementById('coachMessage');  
    let icon = '';  
    let className = 'coach-message';  
  
    if (type === 'excellent' || type === 'good') {  
        icon = '✅';  
        className += ' good';  
    } else if (type === 'mistake' || type === 'blunder') {  
        icon = '❌';  
        className += ' bad';  
    } else if (type === 'hint') {  
        icon = '💡';  
        className += ' good'; // Podrías tener un estilo específico para pistas si quieres  
    }  
      
    coachMsg.innerHTML = `<strong>${icon}</strong> ${phrase}`;  
    coachMsg.className = className;  
}  
  
// ===================== UPDATE UI =====================  
async function updateUI() { // Convertido a async  
    renderBoard();  
    await updateEvalBar(); // Esperar a que la barra de evaluación se actualice con Stockfish  
    updateLastMoveInfo();  
    updateMoveHistory();  
    updateStats();  
  
    if (game.game_over()) showGameOver();  
}  
  
async function updateEvalBar() { // Convertido a async para usar currentStockfishScore  
    // currentStockfishScore ya se actualiza en makeAIMove y handleSquareClick  
    const score = currentStockfishScore;  
    const prob = calculateWinProbability(score);  
  
    // Ajustar el porcentaje de la barra de evaluación  
    // El score de Stockfish es en centipeones. Un score de +200 significa +2 peones.  
    // Necesitamos mapear esto a un porcentaje de 0 a 100.  
    // Un rango de -10 a +10 peones (1000 centipeones) es un buen punto de partida.  
    const maxScore = 1000; // Equivalente a 10 peones  
    let percentage = 50 + (score / (maxScore * 2)) * 100; // Divide por 2 porque el rango total es 2*maxScore  
    percentage = Math.min(100, Math.max(0, percentage)); // Asegura que esté entre 0 y 100  
  
    const fillEl = document.getElementById('evalBarFill');  
    fillEl.style.height = percentage + '%';  
    fillEl.textContent = Math.abs(score).toFixed(1); // Muestra el valor absoluto de la puntuación en peones  
  
    // Ajustar el color de la barra  
    fillEl.className = 'eval-bar-fill';  
    if (score > 50) { // +0.5 peones, ventaja blanca  
        fillEl.classList.add('white-advantage');  
    } else if (score < -50) { // -0.5 peones, ventaja negra  
        fillEl.classList.add('black-advantage');  
    }  
  
    document.getElementById('evalScore').textContent = score.toFixed(2);  
    document.getElementById('winProb').innerHTML = `B:${prob.white}% N:${prob.black}%`;  
}  
  
  
// ... (El resto de funciones como updateLastMoveInfo, updateMoveHistory, updateStats, showGameOver  
// permanecen igual, o solo necesitas que makeAIMove sea async como ya lo hicimos en stockfish-ai.js)  
  
function updateLastMoveInfo() {  
    const el = document.getElementById('lastMoveInfo');  
    if (moveCount === 0) { el.style.display = 'none'; return; }  
    el.style.display = 'grid';  
    const history = game.history({ verbose: true });  
    const lastMove = history[history.length - 1];  
    document.getElementById('playerLastMove').textContent = lastMove?.san || '-';  
    // Muestra la evaluación de Stockfish, no tu evaluación local  
    document.getElementById('moveEval').textContent = currentStockfishScore.toFixed(2);  
}  
  
  
// ===================== CONTROLES =====================  
async function resetGame() { // Convertido a async  
    game.reset();  
    selectedSquare = null;  
    highlights = [];  
    lastFromSquare = null;  
    lastToSquare = null;  
    moveCount = 0;  
    goodMoves = 0;  
    badMoves = 0;  
    aiThinking = false;  
    currentStockfishScore = 0; // Resetear la evaluación de Stockfish  
  
    document.getElementById('coachMessage').innerHTML = '<strong>¡Bienvenido!</strong> Realiza tu primer movimiento.';  
    document.getElementById('coachMessage').classList.remove('good', 'bad'); // Limpia estilos  
    document.getElementById('lastMoveInfo').style.display = 'none';  
  
    await updateGameEvaluation(); // Obtener la evaluación inicial del tablero  
    updateUI();  
}  
  
async function undoMove() { // Convertido a async  
    if (aiThinking) return;  
    game.undo(); // Deshace el movimiento de la IA  
    game.undo(); // Deshace el movimiento del jugador  
    moveCount = Math.max(0, moveCount - 2);  
    await updateGameEvaluation(); // Re-evaluar la posición después de deshacer  
    updateUI();  
}  
  
// ... (flipBoard permanece igual)  
function flipBoard() {  
    boardFlipped = !boardFlipped;  
    renderBoard();  
}  
  
  
async function requestHint() { // Convertido a async  
    if (game.game_over() || aiThinking) return;  
  
    if (!engineReady) {  
        giveCoachFeedback('hint', "Stockfish no está cargado. No puedo dar una pista precisa.");  
        return;  
    }  
  
    giveCoachFeedback('hint', 'Pensando en la mejor pista... <span class="loading"></span>');  
    aiThinking = true; // Para evitar clicks duplicados mientras Stockfish piensa  
  
    const hintDepth = parseInt(document.getElementById('difficulty').value) * 3; // Pista con profundidad decente  
    const result = await evaluateWithStockfish(hintDepth);  
  
    aiThinking = false;  
  
    if (result.bestMove) {  
        const from = result.bestMove.substring(0, 2);  
        const to = result.bestMove.substring(2, 4);  
        selectedSquare = from;  
        highlights = [to];  
        renderBoard();  
        giveCoachFeedback('hint', `Considera mover ${from}-${to}.`);  
    } else {  
        giveCoachFeedback('hint', "No pude encontrar una buena pista. ¿Hay un error?");  
    }  
}  
  
  
async function analysisMode() { // Convertido a async  
    document.getElementById('analysisModal').classList.add('active');  
    document.getElementById('analysisLoading').style.display = 'inline-block';  
    document.getElementById('analysisStatus').textContent = 'Analizando posición...';  
    await performAnalysis(); // Esperar a que el análisis se complete  
}  
  
function closeAnalysis() {  
    document.getElementById('analysisModal').classList.remove('active');  
}  
  
async function performAnalysis() { // Convertido a async  
    if (!engineReady) {  
        document.getElementById('analysisStatus').textContent = '⚠️ Stockfish no está disponible para análisis detallado.';  
        document.getElementById('analysisLoading').style.display = 'none';  
        // Rellenar con los valores locales si es necesario  
        const localScore = _internalEvaluatePosition();  
        const localProb = calculateWinProbability(localScore);  
        document.getElementById('currentScore').innerHTML = localScore.toFixed(2);  
        document.getElementById('whiteWinProb').innerHTML = localProb.white + '%';  
        document.getElementById('drawProb').innerHTML = localProb.draw + '%';  
        document.getElementById('blackWinProb').innerHTML = localProb.black + '%';  
        document.getElementById('anyWinProb').innerHTML = localProb.decisive + '%';  
        document.getElementById('bestMoveAnalysis').innerHTML = '-'; // No podemos saber sin Stockfish  
        document.getElementById('analysisDepth').innerHTML = 'N/A';  
        document.getElementById('principalVariation').innerHTML = '-';  
        document.getElementById('openingEval').innerHTML = '-';  
        document.getElementById('middlegameEval').innerHTML = '-';  
        document.getElementById('endgameEval').innerHTML = '-';  
        document.getElementById('materialEval').innerHTML = _internalEvaluatePosition().toFixed(2); // Usar la local  
        return;  
    }  
  
    document.getElementById('analysisStatus').textContent = 'Analizando posición...';  
    document.getElementById('analysisLoading').style.display = 'inline-block';  
  
    const analysisDepth = 24; // Una profundidad alta para análisis detallado  
    const result = await evaluateWithStockfish(analysisDepth);  
  
    const score = result.score;  
    const prob = calculateWinProbability(score); // Usar la función ajustada para scores de Stockfish  
    const bestMoveUci = result.bestMove;  
    let bestMoveSan = '-';  
  
    if (bestMoveUci) {  
        // Convertir UCI a SAN para mostrar en la UI  
        const from = bestMoveUci.substring(0, 2);  
        const to = bestMoveUci.substring(2, 4);  
        const promotion = bestMoveUci.length > 4 ? bestMoveUci[4] : '';  
        const tempMove = game.move({ from, to, promotion });  
        if (tempMove) {  
            bestMoveSan = tempMove.san;  
            game.undo(); // Deshacer el movimiento temporal  
        }  
    }  
  
  
    document.getElementById('whiteWinProb').innerHTML = prob.white + '%';  
    document.getElementById('drawProb').innerHTML = prob.draw + '%';  
    document.getElementById('blackWinProb').innerHTML = prob.black + '%';  
    document.getElementById('anyWinProb').innerHTML = prob.decisive + '%';  
    document.getElementById('currentScore').innerHTML = score.toFixed(2);  
    document.getElementById('bestMoveAnalysis').innerHTML = bestMoveSan;  
    document.getElementById('analysisDepth').innerHTML = result.depth + ' movimientos';  
  
    // Para la variante principal, necesitaríamos que Stockfish nos la envíe.  
    // El `evaluateWithStockfish` actual no la extrae de los mensajes `info`.  
    // Si quieres la PV, tendrías que modificar `evaluateWithStockfish` para parsear  
    // mensajes como 'info depth X seldepth Y multipv 1 score cp Z nodes A nps B tbhits C time D pv e2e4 e7e5 ...'  
    // Por ahora, lo dejamos simple.  
    document.getElementById('principalVariation').innerHTML = 'Análisis de PV no implementado aún.';  
  
    // Evaluación por fases del juego y material: Stockfish lo hace internamente.  
    // Nuestro wrapper solo devuelve el score total. Obtener scores específicos por fase  
    // o material directamente de Stockfish requeriría una integración más profunda o  
    // el uso de un Stockfish compilado con funcionalidades especiales.  
    // Por ahora, estos los dejaremos como marcadores de posición o usaremos tu lógica anterior.  
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
    const phase = history.length < 10 ? 'Apertura' : history.length < 40 ? 'Medio Juego' : 'Final';  
  
    document.getElementById('materialEval').innerHTML = material.toFixed(2);  
    document.getElementById('openingEval').innerHTML = phase === 'Apertura' ? score.toFixed(2) : '-';  
    document.getElementById('middlegameEval').innerHTML = phase === 'Medio Juego' ? score.toFixed(2) : '-';  
    document.getElementById('endgameEval').innerHTML = phase === 'Final' ? score.toFixed(2) : '-';  
  
  
    document.getElementById('analysisStatus').textContent = '✅ Análisis completado';  
    document.getElementById('analysisLoading').style.display = 'none';  
}  
