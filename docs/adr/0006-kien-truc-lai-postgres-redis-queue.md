# 0006. Kiến trúc lai: Postgres ghi, Redis đọc nhanh, queue cho việc phụ

- Trạng thái: accepted
- Ngày: 2026-09-30
- Nguồn: phiên grill 2026-09-30, câu 18

## Bối cảnh

Tải đợt đăng ký khoảng 1000 người dùng đồng thời, 80–90% là đọc (danh sách lớp, chỗ còn, thời khoá biểu). Có hai
hướng: đưa mọi request đăng ký qua message queue (xử lý tuần tự, trả kết quả sau), hoặc dùng Redis làm nơi giữ chỗ
chính. Cả hai đều giảm tải DB nhưng có giá.

## Quyết định

Phương án D (lai), mỗi công cụ một việc:

- **Postgres:** nguồn sự thật cho mọi thao tác ghi và bất biến ([ADR-0005](./0005-chien-luoc-dong-thoi-khi-dang-ky.md)). Đăng ký là **đồng bộ**: sinh viên nhận thành công hoặc lỗi ngay trong response.
- **Redis (cache):** cache-aside cho danh sách lớp mở và số chỗ còn, TTL vài giây. Ngoài ra dùng cho giới hạn tần suất, khoá chống lặp, và phòng chờ ảo ở cổng vào nếu cần.
- **Message queue (BullMQ, outbox):** chỉ cho việc phụ, không nằm trên đường giành chỗ. Gồm sự kiện khoá điểm, webhook SePay, thông báo, báo cáo.

## Hệ quả

- Số chỗ còn hiển thị có thể trễ vài giây. Chấp nhận được, vì bước giành chỗ luôn kiểm tra lại trên DB.
- Mất Redis cache thì hệ thống chậm đi nhưng vẫn đúng.
- Hai Redis tách riêng: cache (`allkeys-lru`) và queue (`noeviction`, AOF), để việc đẩy key cache ra không xoá mất job ([ADR-0010](./0010-bullmq-cho-job-va-queue.md)).

## Phương án đã cân nhắc

- **A. Queue cho mọi request đăng ký:** tuần tự hoá tự nhiên, nhưng UX bất đồng bộ (phải chờ và poll kết quả), và độ trễ tăng dồn theo độ dài hàng đợi lúc cao điểm.
- **B. Redis là nơi giữ chỗ chính (Lua script) + đồng bộ về DB:** nhanh nhất, nhưng có hai nguồn sự thật, phải xử lý lệch khi crash và phải đối soát.
- **C. Chỉ Postgres:** đúng và đơn giản, nhưng 80–90% đọc đổ thẳng vào DB.
