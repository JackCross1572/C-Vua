// ai.js (Chế độ ĐÁNH NGẪU NHIÊN - Đơn giản và Nhanh nhất)

// Khai báo các hằng số và hàm (chỉ để giữ lại cấu trúc và tránh lỗi tham chiếu)
const PIECE_VALUES = {
    'King': 10000, 
    'Queen': 900,
    'Rook': 500,
    'Bishop': 330,
    'Knight': 320,
    'Pawn': 100
};

// Hàm đánh giá không cần thiết nữa
function evaluateBoard(board) {
    return 0;
}

// Thuật toán Minimax không cần thiết nữa
function minimaxAlphaBeta() {
    return 0;
}


/**
 * Hàm chính để tìm nước đi (Đã được đơn giản hóa thành Chọn Ngẫu nhiên).
 * AI chỉ đảm bảo nước đi là HỢP LỆ, không cần thông minh.
 */
function findAIMove(board, playerColor, getAllLegalMoves) {
    // 1. Lấy tất cả các nước đi hợp lệ (dựa trên script.js)
    const possibleMoves = getAllLegalMoves(playerColor);

    if (possibleMoves.length === 0) {
        return null; // Không có nước đi nào
    }
    
    // 2. Chọn ngẫu nhiên một nước đi trong danh sách hợp lệ
    const randomIndex = Math.floor(Math.random() * possibleMoves.length);
    
    // 3. Trả về nước đi đã chọn
    return possibleMoves[randomIndex];
}