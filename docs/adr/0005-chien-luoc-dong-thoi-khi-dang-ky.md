# 0005. Chiến lược xử lý đồng thời khi đăng ký

- Trạng thái: accepted
- Ngày: 2026-09-30
- Nguồn: phiên grill 2026-09-30, câu 18

## Bối cảnh

Đợt đăng ký có khoảng 1000 người dùng đồng thời, và nhiều người giành cùng một lớp. Có hai loại bất biến:

- **Theo lớp:** số đã đăng ký ≤ sĩ số. Tranh chấp giữa nhiều sinh viên trên một hàng "nóng".
- **Theo sinh viên:** không vượt tín chỉ tối đa, không trùng lịch, không trùng môn. Tranh chấp giữa các request song song của cùng một sinh viên (bấm nhiều lần, mở nhiều tab).

Kiểm tra rồi mới ghi ở tầng ứng dụng mà không khoá thì hỏng cả hai loại bất biến.

## Quyết định

Postgres là nguồn sự thật duy nhất cho mọi bất biến ghi. Trong một transaction đăng ký:

1. `SELECT … FOR UPDATE` hàng **phiếu đăng ký** của sinh viên. Bước này tuần tự hoá mọi thao tác của cùng một sinh viên, nên kiểm tra tín chỉ, trùng lịch và trùng môn đọc được trạng thái ổn định.
2. Chạy các kiểm tra theo thứ tự DK-10 trong [requirements.md](../requirements.md).
3. **Giành chỗ cuối cùng** bằng câu lệnh điều kiện nguyên tử:
   `UPDATE course_section SET enrolled_count = enrolled_count + 1 WHERE id = $1 AND enrolled_count < capacity`.
   Nếu 0 hàng bị ảnh hưởng thì lớp đã đầy và rollback. Làm cuối để giữ khoá hàng nóng trong thời gian ngắn nhất.
4. Thứ tự khoá cố định: phiếu trước, sau đó các lớp theo id tăng dần, để không deadlock. Giành chỗ chỉ đụng một lớp; chỉ huỷ hai chiều (lớp LT và nhóm thực hành, DK-11) mới đụng hai lớp.
5. Một lượt đăng ký nhiều lớp (DK-18) xử lý từng lớp trong transaction riêng, theo thứ tự trong lượt. Lớp này rollback không ảnh hưởng lớp khác.

Lưới an toàn ở tầng DB:

- Partial unique index `(form_id, course_id) WHERE status <> 'CANCELLED'`.
- `CHECK (enrolled_count >= 0 AND enrolled_count <= capacity)`.

Ở tầng API:

- Khoá chống lặp (idempotency key) lưu Redis, TTL 24 giờ.
- Giới hạn tần suất theo sinh viên.
- PgBouncer để giới hạn số kết nối thật tới Postgres.

## Hệ quả

- Không cần khoá phân tán ở Redis. Postgres đảm bảo đúng kể cả khi Redis hỏng.
- Hàng lớp nóng chỉ bị khoá trong một câu `UPDATE`, nên thông lượng giành chỗ cao.
- Tiêu chí nghiệm thu: bài load test 1000 sinh viên giành một lớp 50 chỗ phải ra đúng 50. Các test tranh chấp bắt buộc được liệt kê ở [ADR-0016](./0016-chien-luoc-kiem-thu.md).

## Phương án đã cân nhắc

- **Optimistic locking (cột version) trên lớp:** hàng nóng khiến tỉ lệ retry rất cao.
- **`SERIALIZABLE` toàn cục:** đúng, nhưng lỗi serialization và retry tăng mạnh khi tải cao.
- **Đếm chỗ bằng Redis `DECR` rồi ghi DB sau:** nhanh, nhưng hai nguồn sự thật dễ lệch khi crash giữa chừng.
- **Hàng đợi tuần tự hoá mọi request đăng ký:** đúng, nhưng sinh viên không nhận kết quả ngay (xem [ADR-0006](./0006-kien-truc-lai-postgres-redis-queue.md)).
