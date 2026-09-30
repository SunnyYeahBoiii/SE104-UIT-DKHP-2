# 0002. Đăng ký theo lớp học phần; tách LT và TH thành hai môn

- Trạng thái: accepted
- Ngày: 2026-09-30
- Nguồn: phiên grill 2026-09-30, câu 3, 5 và 29

## Bối cảnh

QĐ2 cho mỗi môn đúng một loại (LT hoặc TH). Nhưng thực tế nhiều học phần có cả lý thuyết lẫn thực hành, và nhóm
thực hành phải đi theo lớp lý thuyết (ví dụ `SE104.P21` và `SE104.P21.1`). Sinh viên cũng không đăng ký "môn"
trừu tượng: họ giành một chỗ trong một lớp cụ thể có lịch và sĩ số.

## Quyết định

- Đơn vị đăng ký là **lớp học phần**. Mỗi môn mở có một hoặc nhiều lớp, mỗi lớp có giảng viên, sĩ số tối đa và các buổi học.
- Học phần có cả hai phần được mô hình thành **hai môn riêng**, một LT và một TH. Môn TH có thể khai báo môn LT đi kèm. Như vậy QĐ2 (một môn một loại, tín chỉ theo số tiết) giữ nguyên.
- Nhóm thực hành là con của một lớp LT. Đăng ký lớp LT thì phải chọn đúng một nhóm TH con, và hai chỗ được giành trong cùng transaction. Huỷ LT thì huỷ luôn TH.
- Ngoại lệ học lại tách: nếu đã Đạt một trong hai môn thì được đăng ký riêng môn còn lại. Nhóm TH khi đó chọn trong bất kỳ lớp LT nào.
- Phụ thu và hình thức học tính riêng cho từng môn.

## Hệ quả

- Điểm, tín chỉ, tiên quyết của LT và TH độc lập. Trượt TH mà đậu LT thì chỉ học lại TH.
- Một thao tác đăng ký có thể giành 2 chỗ, nên thứ tự khoá phải cố định (id lớp tăng dần) để tránh deadlock ([ADR-0005](./0005-chien-luoc-dong-thoi-khi-dang-ky.md)).
- Trùng lịch phải kiểm tra theo buổi học, không theo lớp, vì một lớp có nhiều buổi.

## Phương án đã cân nhắc

- **Một môn có cả LT và TH (số tiết LT + số tiết TH):** gần thực tế hơn, nhưng phá công thức tín chỉ của QĐ2, và điểm hay học lại từng phần trở nên mơ hồ.
- **Đăng ký theo môn, hệ thống tự xếp lớp:** không có tranh chấp chỗ theo lớp, nhưng sinh viên mất quyền chọn lịch.
