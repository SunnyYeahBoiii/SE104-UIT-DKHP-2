# 0007. Modular monolith bằng NestJS

- Trạng thái: accepted
- Ngày: 2026-09-30
- Nguồn: phiên grill 2026-09-30, câu 22

## Bối cảnh

Hệ thống có vài miền rõ ràng (hồ sơ, đào tạo, đăng ký, điểm, học phí), nhưng các bất biến quan trọng cắt ngang
miền. Ví dụ đăng ký phải đọc kết quả hiện hành (điểm) và ghi phụ thu (học phí) trong cùng transaction. Nhóm nhỏ,
triển khai bằng Docker Compose.

## Quyết định

Một ứng dụng NestJS, chia module theo miền:

- `identity` (tài khoản, vai trò, session)
- `student-records` (hồ sơ, trạng thái, đối tượng ưu tiên)
- `academics` (môn học, chương trình học, học kỳ, môn mở, lớp, lịch)
- `registration`
- `grading`
- `tuition` (bảng phí, sổ cái, thanh toán, SePay)
- `notification`, `audit`

Quy ước:

- Module chỉ gọi nhau qua service/command/query được export, không import repository của module khác.
- Chung một database, mỗi module sở hữu nhóm bảng của mình.
- Worker là cùng codebase, chạy bằng entrypoint khác.

## Hệ quả

- Transaction xuyên module vẫn là một transaction Postgres, không cần saga.
- Scale ngang API bằng nhiều bản sao (`--scale api=3`) sau nginx.
- Ranh giới module cần được giữ bằng quy ước và review, vì compiler không chặn import chéo.

## Phương án đã cân nhắc

- **Microservices:** mỗi bất biến xuyên miền thành saga, quá tốn công so với quy mô nhóm và tải.
- **Monolith không chia module:** nhanh lúc đầu, rối khi lớn dần.
