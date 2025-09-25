// script.js

// --- Cấu hình và Trạng thái Trò chơi ---
const initialBoard = [
    ['♜', '♞', '♝', '♛', '♚', '♝', '♞', '♜'],
    ['♟', '♟', '♟', '♟', '♟', '♟', '♟', '♟'],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    ['♙', '♙', '♙', '♙', '♙', '♙', '♙', '♙'],
    ['♖', '♘', '♗', '♕', '♔', '♗', '♘', '♖']
];

let currentBoard = JSON.parse(JSON.stringify(initialBoard)); 
let selectedSquare = null; 
let currentPlayer = 'white'; 
let isGameOver = false;

const HUMAN_COLOR = 'white'; 
const AI_COLOR = 'black';    
// ĐÃ SỬA: Giảm AI_DELAY xuống 50ms để AI phản hồi gần như ngay lập tức
const AI_DELAY = 50; 

let enPassantTarget = null; // Tọa độ (row, col) của ô Tốt có thể bắt qua đường
let promotionMove = null; // Lưu trữ nước đi Tốt sắp phong cấp

let canCastle = {
    white: { kingMoved: false, rookKSMoved: false, rookQSMoved: false },
    black: { kingMoved: false, rookKSMoved: false, rookQSMoved: false }
};

const PIECES = {
    white: ['♔', '♕', '♖', '♗', '♘', '♙'],
    black: ['♚', '♛', '♜', '♝', '♞', '♟']
};

const PROMOTION_PIECES = {
    white: { '♕': '♕', '♖': '♖', '♗': '♗', '♘': '♘' },
    black: { '♛': '♛', '♜': '♜', '♝': '♝', '♞': '♞' }
};

const chessboardElement = document.getElementById('chessboard');
const promotionDialog = document.getElementById('promotion-dialog');
const promotionOptions = document.getElementById('promotion-options');
const restartButton = document.getElementById('restart-button'); 

// --- Hàm Hỗ trợ Dữ liệu ---

function getPieceColor(piece) {
    if (!piece) return null;
    if (PIECES.white.includes(piece)) return 'white';
    if (PIECES.black.includes(piece)) return 'black';
    return null;
}

function getPieceType(piece) {
    if (piece === '♔' || piece === '♚') return 'King';
    if (piece === '♕' || piece === '♛') return 'Queen';
    if (piece === '♖' || piece === '♜') return 'Rook';
    if (piece === '♗' || piece === '♝') return 'Bishop';
    if (piece === '♘' || piece === '♞') return 'Knight';
    if (piece === '♙' || piece === '♟') return 'Pawn';
    return null;
}

function getKingPosition(board, color) {
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if (getPieceType(board[r][c]) === 'King' && getPieceColor(board[r][c]) === color) {
                return { row: r, col: c };
            }
        }
    }
    return null; 
}

// --- LOGIC LUẬT CƠ BẢN (Pseudo-Legal Moves) ---

function isPathClear(board, fromRow, fromCol, toRow, toCol) {
    const dRow = Math.sign(toRow - fromRow);
    const dCol = Math.sign(toCol - fromCol);

    let r = fromRow + dRow;
    let c = fromCol + dCol;

    while (r !== toRow || c !== toCol) {
        if (board[r][c] !== null) {
            return false;
        }
        r += dRow;
        c += dCol;
    }
    return true;
}

function isPseudoLegalMove(board, fromRow, fromCol, toRow, toCol) {
    if (fromRow === toRow && fromCol === toCol) return false;
    
    const piece = board[fromRow][fromCol];
    const targetPiece = board[toRow][toCol];

    if (!piece) return false;
    if (targetPiece && getPieceColor(targetPiece) === getPieceColor(piece)) return false;

    const pieceColor = getPieceColor(piece);
    const pieceType = getPieceType(piece);
    const rowDiff = Math.abs(toRow - fromRow);
    const colDiff = Math.abs(toCol - fromCol);

    switch (pieceType) {
        case 'Pawn':
            const direction = pieceColor === 'white' ? -1 : 1;
            const startRow = pieceColor === 'white' ? 6 : 1;
            const isCapturing = colDiff === 1;

            // Di chuyển thẳng
            if (fromCol === toCol) {
                if (toRow - fromRow === direction && targetPiece === null) return true;
                if (fromRow === startRow && toRow - fromRow === 2 * direction && targetPiece === null && board[fromRow + direction][fromCol] === null) return true;
            }
            // Bắt chéo thông thường
            if (isCapturing && toRow - fromRow === direction && targetPiece !== null) return true;
            
            // Bắt Tốt qua đường (En Passant)
            if (isCapturing && toRow - fromRow === direction && targetPiece === null && 
                enPassantTarget && enPassantTarget.row === toRow && enPassantTarget.col === toCol) {
                return true;
            }
            return false;

        case 'Knight':
            return (rowDiff === 2 && colDiff === 1) || (rowDiff === 1 && colDiff === 2);

        case 'Rook':
        case 'Queen':
        case 'Bishop':
            const isStraight = (rowDiff > 0 && colDiff === 0) || (rowDiff === 0 && colDiff > 0);
            const isDiagonal = rowDiff === colDiff;
            
            if ((pieceType === 'Rook' && isStraight) || 
                (pieceType === 'Bishop' && isDiagonal) || 
                (pieceType === 'Queen' && (isStraight || isDiagonal))) {
                return isPathClear(board, fromRow, fromCol, toRow, toCol);
            }
            return false;

        case 'King':
            // 1. Nước đi Vua thông thường (1 ô)
            if (rowDiff <= 1 && colDiff <= 1) return true;

            // 2. Kiểm tra Nhập Thành (Castling)
            if (rowDiff === 0 && colDiff === 2 && pieceColor === currentPlayer) {
                const playerState = canCastle[currentPlayer];
                if (playerState.kingMoved) return false;
                
                const rookCol = (toCol === 6) ? 7 : 0;
                const pathClear = (toCol === 6) 
                    ? (board[fromRow][5] === null && board[fromRow][6] === null) 
                    : (board[fromRow][3] === null && board[fromRow][2] === null && board[fromRow][1] === null);

                const rookMoved = (rookCol === 7) ? playerState.rookKSMoved : playerState.rookQSMoved;

                if (pathClear && !rookMoved) {
                    // Cần kiểm tra Vua không bị chiếu và các ô đi qua không bị tấn công.
                    return !isSquareAttacked(board, fromRow, fromCol, pieceColor) &&
                           !isSquareAttacked(board, fromRow, (fromCol + toCol) / 2, pieceColor) && 
                           !isSquareAttacked(board, toRow, toCol, pieceColor); 
                }
            }
            return false;

        default:
            return false;
    }
}

// --- LOGIC KIỂM TRA CHIẾU (Check) ---

function isSquareAttacked(board, targetRow, targetCol, kingColor) {
    const attackingColor = kingColor === 'white' ? 'black' : 'white';

    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            if (getPieceColor(piece) === attackingColor) {
                // Xử lý đặc biệt cho Tốt tấn công (vì Tốt bắt khác đi)
                if (getPieceType(piece) === 'Pawn') {
                    const direction = attackingColor === 'white' ? -1 : 1;
                    if (r + direction === targetRow && Math.abs(c - targetCol) === 1) {
                        return true;
                    }
                } 
                // Sử dụng isPseudoLegalMove để kiểm tra các quân khác
                else if (isPseudoLegalMove(board, r, c, targetRow, targetCol)) {
                    return true;
                }
            }
        }
    }
    return false;
}

function isKingInCheck(board, color) {
    const kingPos = getKingPosition(board, color);
    if (!kingPos) return false;
    return isSquareAttacked(board, kingPos.row, kingPos.col, color);
}

/**
 * Kiểm tra nước đi có hợp lệ không (Bao gồm kiểm tra Vua không bị Chiếu).
 */
function isLegalMove(board, fromRow, fromCol, toRow, toCol) {
    if (!isPseudoLegalMove(board, fromRow, fromCol, toRow, toCol)) {
        return false;
    }

    const pieceColor = getPieceColor(board[fromRow][fromCol]);
    
    // 1. Thực hiện nước đi trên một bản sao của bàn cờ
    const tempBoard = board.map(arr => [...arr]);
    const piece = tempBoard[fromRow][fromCol];
    
    // Xử lý Bắt Tốt qua đường trên bản sao
    if (getPieceType(piece) === 'Pawn' && tempBoard[toRow][toCol] === null && Math.abs(fromCol - toCol) === 1) {
        const capturedPawnRow = pieceColor === 'white' ? toRow + 1 : toRow - 1;
        tempBoard[capturedPawnRow][toCol] = null; 
    }

    // Di chuyển quân
    tempBoard[toRow][toCol] = piece;
    tempBoard[fromRow][fromCol] = null;

    // 2. Kiểm tra xem King có bị chiếu sau nước đi không
    if (isKingInCheck(tempBoard, pieceColor)) {
        return false;
    }
    
    return true;
}

/**
 * Trả về danh sách tất cả các nước đi hợp lệ (legal) cho màu hiện tại.
 */
function getAllLegalMoves(color) {
    const moves = [];
    for (let fromRow = 0; fromRow < 8; fromRow++) {
        for (let fromCol = 0; fromCol < 8; fromCol++) {
            const piece = currentBoard[fromRow][fromCol];
            if (getPieceColor(piece) === color) {
                for (let toRow = 0; toRow < 8; toRow++) {
                    for (let toCol = 0; toCol < 8; toCol++) {
                        if (isLegalMove(currentBoard, fromRow, fromCol, toRow, toCol)) {
                            moves.push({ fromRow, fromCol, toRow, toCol });
                        }
                    }
                }
            }
        }
    }
    return moves;
}

// --- LOGIC NHẬP THÀNH (Castling Execution) ---

function performCastling(fromRow, fromCol, toRow, toCol) {
    // Kingside: e -> g, h -> f
    if (toCol === 6) { 
        currentBoard[toRow][6] = currentBoard[fromRow][4];
        currentBoard[fromRow][4] = null;
        currentBoard[toRow][5] = currentBoard[fromRow][7];
        currentBoard[fromRow][7] = null;
        canCastle[currentPlayer].rookKSMoved = true;

    } 
    // Queenside: e -> c, a -> d
    else if (toCol === 2) { 
        currentBoard[toRow][2] = currentBoard[fromRow][4];
        currentBoard[fromRow][4] = null;
        currentBoard[toRow][3] = currentBoard[fromRow][0];
        currentBoard[fromRow][0] = null;
        canCastle[currentPlayer].rookQSMoved = true;
    }
    canCastle[currentPlayer].kingMoved = true;
}


// --- Logic Xử lý Game ---

function finishMove(fromRow, fromCol, toRow, toCol, promotionPiece = null) {
    const piece = currentBoard[fromRow][fromCol];
    const pieceType = getPieceType(piece);

    let isCastling = false;
    let isPromotion = false;
    let newEnPassantTarget = null;

    // Cập nhật luật đặc biệt trước khi di chuyển
    if (pieceType === 'King') {
        canCastle[currentPlayer].kingMoved = true;
        isCastling = Math.abs(fromCol - toCol) === 2;
    } else if (pieceType === 'Pawn') {
        if (Math.abs(fromRow - toRow) === 2) {
            newEnPassantTarget = { row: (fromRow + toRow) / 2, col: fromCol };
        }
        if (toRow === 0 || toRow === 7) {
            isPromotion = true;
        }
    } else if (pieceType === 'Rook') {
        if (fromCol === 0) canCastle[currentPlayer].rookQSMoved = true;
        if (fromCol === 7) canCastle[currentPlayer].rookKSMoved = true;
    }

    // 1. Thực hiện nước đi
    if (isCastling) {
        performCastling(fromRow, fromCol, toRow, toCol);
    } else {
        // Xử lý Bắt Tốt qua đường
        if (pieceType === 'Pawn' && currentBoard[toRow][toCol] === null && Math.abs(fromCol - toCol) === 1) {
            const capturedPawnRow = currentPlayer === 'white' ? toRow + 1 : toRow - 1;
            currentBoard[capturedPawnRow][toCol] = null; 
        }

        // Đặt quân cờ mới (hoặc quân được phong cấp)
        currentBoard[toRow][toCol] = promotionPiece || piece; 
        currentBoard[fromRow][fromCol] = null;
    }

    enPassantTarget = newEnPassantTarget; 

    // 2. Xử lý Phong cấp
    if (isPromotion && !promotionPiece) {
        promotionMove = { fromRow, fromCol, toRow, toCol };
        showPromotionDialog();
        return; 
    }
    
    // 3. Chuyển lượt và Kiểm tra Chiếu hết
    unhighlightSelectedSquare(fromRow, fromCol);
    currentPlayer = currentPlayer === 'white' ? 'black' : 'white';
    selectedSquare = null;
    
    checkGameStatus();

    if (!isGameOver) {
        renderBoard();
        updateTurnDisplay();
        
        // Gọi AI nếu đến lượt
        if (currentPlayer === AI_COLOR) {
            handleAIMove();
        }
    }
}

function checkGameStatus() {
    const opponentColor = currentPlayer;
    const legalMoves = getAllLegalMoves(opponentColor);

    const inCheck = isKingInCheck(currentBoard, opponentColor);
    const messageElement = document.getElementById('status-message');

    if (legalMoves.length === 0) {
        isGameOver = true;
        chessboardElement.style.pointerEvents = 'none';

        if (inCheck) {
            // Chiếu hết
            const winner = opponentColor === 'white' ? 'Đen (AI)' : 'Trắng (Bạn)';
            messageElement.innerHTML = `🏆 **CHIẾU HẾT! ${winner} THẮNG!** 🏆`;
        } else {
            // Hòa cờ do hết nước đi
            messageElement.innerHTML = `**HÒA CỜ!** (Hết nước đi hợp lệ)`;
        }
        
        restartButton.classList.remove('hidden');

    } else if (inCheck) {
        // Chỉ bị chiếu
        messageElement.innerHTML = `**CẢNH BÁO: ${opponentColor === 'white' ? 'Vua Trắng' : 'Vua Đen'} đang bị Chiếu!**`;
    } else {
        messageElement.innerHTML = '';
    }
}

// --- Logic AI (Quân Đen) ---

function handleAIMove() {
    chessboardElement.style.pointerEvents = 'none'; 
    document.getElementById('currentTurn').textContent = "Lượt đi: AI (Đen) đang tính toán..."; 

    setTimeout(() => {
        // AI chỉ tìm nước đi ngẫu nhiên (sử dụng findAIMove từ ai.js)
        const move = findAIMove(currentBoard, AI_COLOR, getAllLegalMoves); 

        if (move) {
            let promotionPiece = null;
            
            // Tự động Phong cấp Tốt thành Hậu cho AI
            const pieceType = getPieceType(currentBoard[move.fromRow][move.fromCol]);
            
            // Kiểm tra xem nước đi này có phải là nước phong cấp không
            const isPromotionRow = (pieceType === 'Pawn') && 
                                   (AI_COLOR === 'black' && move.toRow === 7); 

            if (isPromotionRow) {
                promotionPiece = '♛'; // AI luôn phong Hậu đen
            }
            
            finishMove(move.fromRow, move.fromCol, move.toRow, move.toCol, promotionPiece); 
        } 
    }, AI_DELAY); 
}

// --- Logic Người chơi (Quân Trắng) ---

function handleSquareClick(row, col) {
    if (currentPlayer !== HUMAN_COLOR || isGameOver) return;

    const piece = currentBoard[row][col];
    const color = getPieceColor(piece);
    const clickedSquare = { row, col };
    
    // 1. CHỌN QUÂN CỜ
    if (!selectedSquare) {
        if (piece && color === HUMAN_COLOR) {
            selectedSquare = clickedSquare;
            highlightSelectedSquare(row, col);
            highlightValidMoves(row, col);
        }
    } 
    
    // 2. THỰC HIỆN HOẶC HỦY NƯỚC ĐI
    else {
        const fromRow = selectedSquare.row;
        const fromCol = selectedSquare.col;

        unhighlightAllValidMoves();

        // B. Hủy chọn
        if (fromRow === row && fromCol === col) {
            unhighlightSelectedSquare(fromRow, fromCol);
            selectedSquare = null;
            return;
        }

        // A. Kiểm tra và Thực hiện nước đi
        if (isLegalMove(currentBoard, fromRow, fromCol, row, col)) {
            finishMove(fromRow, fromCol, row, col);
        } else {
            // Nếu click vào quân khác cùng màu, chọn quân đó thay thế
            if (piece && color === HUMAN_COLOR) {
                unhighlightSelectedSquare(fromRow, fromCol);
                selectedSquare = clickedSquare;
                highlightSelectedSquare(row, col);
                highlightValidMoves(row, col);
            } 
            // Nếu click vào ô không hợp lệ, giữ nguyên ô đã chọn
            else {
                highlightValidMoves(fromRow, fromCol); 
            }
        }
    }
}

// --- Logic Phong cấp Tốt ---

function showPromotionDialog() {
    promotionDialog.classList.remove('hidden');
    promotionOptions.innerHTML = '';
    
    const pieces = PROMOTION_PIECES[currentPlayer];
    for (const symbol in pieces) {
        const button = document.createElement('button');
        button.textContent = symbol;
        button.addEventListener('click', () => {
            handlePromotionSelection(symbol);
        });
        promotionOptions.appendChild(button);
    }
    chessboardElement.style.pointerEvents = 'none'; 
}

function handlePromotionSelection(symbol) {
    if (!promotionMove) return;

    promotionDialog.classList.add('hidden');
    
    const { fromRow, fromCol, toRow, toCol } = promotionMove;
    
    finishMove(fromRow, fromCol, toRow, toCol, symbol);
    promotionMove = null;
}


// --- Hàm Hỗ trợ Giao diện (UI) ---

function updateTurnDisplay() {
    let turnText;
    if (isGameOver) {
        turnText = "GAME OVER";
    } else {
        turnText = currentPlayer === 'white' ? 'Bạn (Trắng) 💡' : 'AI (Đen)';
    }
    
    let turnDisplayElement = document.getElementById('currentTurn');
    if (!turnDisplayElement) {
        turnDisplayElement = document.createElement('h2');
        turnDisplayElement.id = 'currentTurn';
        chessboardElement.before(turnDisplayElement);
    }
    
    turnDisplayElement.textContent = `Lượt đi: ${turnText}`;
    chessboardElement.style.pointerEvents = currentPlayer === HUMAN_COLOR ? 'auto' : 'none';
}

function highlightValidMoves(fromRow, fromCol) {
    const moves = getAllLegalMoves(currentPlayer).filter(move => 
        move.fromRow === fromRow && move.fromCol === fromCol
    );

    moves.forEach(move => {
        const square = document.querySelector(`.square[data-row="${move.toRow}"][data-col="${move.toCol}"]`);
        square.classList.add('valid-move');
    });
}

function unhighlightAllValidMoves() {
    document.querySelectorAll('.valid-move').forEach(square => {
        square.classList.remove('valid-move');
    });
}

function highlightSelectedSquare(row, col) {
    const square = document.querySelector(`.square[data-row="${row}"][data-col="${col}"]`);
    square.classList.add('selected');
}

function unhighlightSelectedSquare(row, col) {
    const square = document.querySelector(`.square[data-row="${row}"][data-col="${col}"]`);
    square.classList.remove('selected');
}

function renderBoard() {
    chessboardElement.innerHTML = '';
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const square = document.createElement('div');
            square.classList.add('square');
            square.classList.add((r + c) % 2 === 0 ? 'light' : 'dark');
            square.dataset.row = r;
            square.dataset.col = c;
            
            const piece = currentBoard[r][c];
            if (piece) {
                square.textContent = piece;
                square.dataset.piece = getPieceType(piece);
            }
            
            square.addEventListener('click', () => handleSquareClick(r, c));
            chessboardElement.appendChild(square);
        }
    }
}

// --- Hàm Reset Game (Bắt đầu Lại) ---

function resetGame() {
    currentBoard = JSON.parse(JSON.stringify(initialBoard)); 
    selectedSquare = null; 
    currentPlayer = 'white'; 
    isGameOver = false;
    enPassantTarget = null;
    promotionMove = null;
    canCastle = {
        white: { kingMoved: false, rookKSMoved: false, rookQSMoved: false },
        black: { kingMoved: false, rookKSMoved: false, rookQSMoved: false }
    };

    document.getElementById('status-message').innerHTML = '';
    restartButton.classList.add('hidden');
    promotionDialog.classList.add('hidden');
    chessboardElement.style.pointerEvents = 'auto';
    
    renderBoard();
    updateTurnDisplay();
}


// --- Khởi tạo ---

document.addEventListener('DOMContentLoaded', () => {
    if (restartButton) {
        restartButton.addEventListener('click', resetGame);
    }
    
    renderBoard();
    updateTurnDisplay(); 
});