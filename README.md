# Zetabiz – Trang chủ

Website giới thiệu nền tảng Zetabiz (CÔNG TY MHT BUSINESS SOLUTIONS).

- Trang tĩnh một file: `index.html`, không cần build.
- Triển khai: Vercel, dự án `zetabiz-web` (team MHTBIZ). Mỗi lần đẩy code lên nhánh `main` sẽ tự cập nhật bản chính thức.
- Link sản phẩm: sửa khối `ZETABIZ_LINKS` gần cuối `index.html`.

## Chatbot tư vấn (Trợ lý Zetabiz)
- Giao diện: `assets/zb-chat.js`, đã nhúng vào trang chủ, báo giá và 2 trang pháp lý. Nút nào có thuộc tính `data-zb-chat` cũng mở được khung chat (ví dụ `data-zb-chat="Nhận báo giá"`).
- Bộ não: `api/chat.js` + `api/_kb.js`, gọi AI qua Vercel AI Gateway (xác thực OIDC tự động).
- **Đào tạo AI không cần sửa code:** Quản trị › Đào tạo Trợ lý AI (`/admin/ai.html`) – sản phẩm, hỏi đáp, giá, hỗ trợ, kiến thức, quy tắc, thử trò chuyện với bản nháp, xem hội thoại khách (tự xoá sau 90 ngày). Lưu trong `settings.chatbot_ai`; tên/mô tả sản phẩm và hỏi đáp trang chủ lấy từ `settings.zetabiz_site`.
- API đọc cấu hình và ghi hội thoại qua RPC `chatbot_runtime` / `chatbot_log`, xác thực bằng biến môi trường `CHATBOT_SERVER_TOKEN` (mã băm lưu ở `private.chatbot_secret`).
- Khi AI lỗi, bot tự trả lời theo từ khoá và mời để lại thông tin.
- Khách để lại thông tin trong chat được ghi vào bảng `leads` với nguồn `website-chatbot`, kèm tóm tắt hội thoại.
- Đổi model: đặt biến môi trường `CHAT_MODEL` trên Vercel.

## Việc còn lại
- Điền link trang con cho 5 sản phẩm (AutoPro, SkyAgent, SpaCare, TradeHub, FactoryOne).
- Điền 3 câu trả lời Hỏi đáp đang để trong ngoặc vuông.
