# 0014. Tên trong code bằng tiếng Anh, glossary giữ ánh xạ

- Trạng thái: accepted
- Ngày: 2026-09-30
- Nguồn: phiên grill 2026-09-30, câu 32

## Bối cảnh

Nghiệp vụ và tài liệu bằng tiếng Việt, nhưng thư viện, framework và công cụ đều bằng tiếng Anh. Viết tên không
dấu (`hocPhi`, `phieuDangKy`) thì khó đọc và dễ nhầm. Trộn hai ngôn ngữ thì không nhất quán.

## Quyết định

- Mọi định danh trong code, schema DB, API, enum đều bằng tiếng Anh.
- [CONTEXT.md](../../CONTEXT.md) là nguồn duy nhất ánh xạ thuật ngữ tiếng Việt → tên tiếng Anh. Mỗi khái niệm có **đúng một** tên.
- Giao diện, thông báo lỗi cho người dùng và tài liệu nghiệp vụ bằng tiếng Việt.

## Hệ quả

- Thêm khái niệm mới thì phải thêm vào glossary trước khi đặt tên trong code.
- Review code cần đối chiếu glossary để không có tên đồng nghĩa (ví dụ `Registration` và `Enrollment` cho cùng một thứ).

## Phương án đã cân nhắc

- **Tiếng Việt không dấu:** sát nghiệp vụ, nhưng khó đọc và không nhất quán với thư viện.
