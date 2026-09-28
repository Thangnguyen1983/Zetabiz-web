# Zetabiz – Trang chủ

Website giới thiệu nền tảng Zetabiz (CÔNG TY MHT BUSINESS SOLUTIONS).

- Trang tĩnh một file: `index.html`, không cần build.
- Triển khai: Vercel, dự án `zetabiz-web` (team MHTBIZ). Mỗi lần đẩy code lên nhánh `main` sẽ tự cập nhật bản chính thức.
- Link sản phẩm: sửa khối `ZETABIZ_LINKS` gần cuối `index.html`.

## Chatbot tư vấn (Trợ lý Zetabiz)
- Giao diện: `assets/zb-chat.js`, đã nhúng vào trang chủ, báo giá và 2 trang pháp lý. Nút nào có thuộc tính `data-zb-chat` cũng mở được khung chat (ví dụ `data-zb-chat="Nhận báo giá"`).
- Bộ não: `api/chat.js`, gọi AI qua Vercel AI Gateway (xác thực OIDC tự động). Nội dung kiến thức nằm trong `SYSTEM_PROMPT` – sửa ở đó khi có thông tin mới (giá, chính sách…).
- Khi AI lỗi, bot tự trả lời theo từ khoá và mời để lại thông tin.
- Khách để lại thông tin trong chat được ghi vào bảng `leads` với nguồn `website-chatbot`, kèm tóm tắt hội thoại.
- Đổi model: đặt biến môi trường `CHAT_MODEL` trên Vercel.

## Việc còn lại
- Điền link trang con cho 5 sản phẩm (AutoPro, SkyAgent, SpaCare, TradeHub, FactoryOne).
- Điền 3 câu trả lời Hỏi đáp đang để trong ngoặc vuông.
