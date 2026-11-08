# 0002. Đăng ký theo lớp học phần; tách LT và TH thành hai môn

- Trạng thái: accepted
- Ngày: 2026-09-30
- Nguồn: phiên grill 2026-09-30, câu 3, 5 và 29
- Sửa đổi: 2026-10-02, phiên grill môn LT/TH (nhóm thực hành, HT1/HT2, bỏ đổi lớp)
- Sửa đổi: 2026-10-07, đối chiếu thời khoá biểu HK1 2025–2026 (môn TH đứng riêng, nhóm `.n` không giới hạn, lớp 0 buổi)

## Bối cảnh

QĐ2 cho mỗi môn đúng một loại (LT hoặc TH). Nhưng thực tế nhiều học phần có cả lý thuyết lẫn thực hành, và nhóm
thực hành phải đi theo lớp lý thuyết (ví dụ `SE104.P21` và `SE104.P21.1`). Sinh viên cũng không đăng ký "môn"
trừu tượng: họ giành một chỗ trong một lớp cụ thể có lịch và sĩ số.

## Quyết định

- Đơn vị đăng ký là **lớp học phần**. Mỗi môn mở có một hoặc nhiều lớp, mỗi lớp có sĩ số tối đa, giảng viên (có thể chưa phân công) và 0 hoặc nhiều buổi học. Lớp không có buổi học (đồ án, khoá luận) không bao giờ trùng lịch.
- Học phần có cả hai phần được mô hình thành **hai môn riêng**, một LT và một TH. Như vậy QĐ2 (một môn một loại, tín chỉ theo số tiết) giữ nguyên.
  - Môn TH đi kèm có mã là mã môn LT thêm hậu tố `TH` (`IT004` và `IT004TH`). Mỗi môn LT có tối đa một môn TH đi kèm.
  - Môn TH đứng riêng (không có phần LT, ví dụ `CE119`) giữ mã không hậu tố. Lớp của nó là lớp thường: có buổi học, không có lớp cha, không có hình thức thực hành.
- Nhóm thực hành là con của một lớp LT có môn TH đi kèm, mã `<mã lớp LT>.n` với n ≥ 1, không cần liên tiếp, không giới hạn số nhóm (`MA006.R1.1`, `MA006.R1.2`). Mỗi nhóm có sĩ số riêng.
- **Hình thức thực hành** là thuộc tính của lớp LT, áp cho mọi nhóm con, không trộn. Phòng Đào tạo nhập ở giai đoạn Chuẩn bị, từ giai đoạn Đăng ký thì không đổi.
  - **HT1 – theo lịch:** mỗi nhóm có buổi học cố định. Học xen kẽ là hai nhóm học cách tuần, nhóm sau bắt đầu muộn hơn một tuần.
  - **HT2 – tự xếp lịch:** nhóm không có buổi học nên không bao giờ trùng lịch. Có thể có nhiều nhóm.
- Lớp LT và nhóm thực hành là **hai dòng đăng ký riêng**, mỗi dòng giành một chỗ. Học LT không bắt buộc có nhóm thực hành. Chỉ chọn được nhóm con của lớp LT mà sinh viên đang có dòng còn hiệu lực.
- **Huỷ hai chiều:** huỷ LT thì huỷ luôn nhóm thực hành con, huỷ nhóm thực hành thì huỷ luôn lớp LT cha.
- **Không có đổi lớp:** muốn sang lớp khác thì huỷ rồi đăng ký lại.
- Ngoại lệ học lại tách: đã Đạt môn LT thì được đăng ký riêng nhóm thực hành, chọn trong nhóm con của bất kỳ lớp LT nào. Đã Đạt môn TH thì đăng ký lớp LT như môn không có thực hành.
- Phụ thu và hình thức học tính riêng cho từng môn.

## Hệ quả

- Điểm, tín chỉ, tiên quyết của LT và TH độc lập. Trượt TH mà đậu LT thì chỉ học lại TH.
- Mỗi lần giành chỗ chỉ đụng một lớp. Chỉ huỷ hai chiều mới đụng hai lớp cùng lúc, nên thứ tự khoá vẫn phải cố định (id lớp tăng dần) để tránh deadlock ([ADR-0005](./0005-chien-luoc-dong-thoi-khi-dang-ky.md)).
- Vì đăng ký tách dòng mà huỷ thì hai chiều, có lúc sinh viên giữ lớp LT mà chưa có nhóm thực hành, nhưng không bao giờ giữ nhóm thực hành mà thiếu lớp LT cha (trừ ngoại lệ học lại tách).
- Sinh viên huỷ để đổi lớp có thể mất chỗ cũ nếu lớp mới đã đầy. Chấp nhận: thiếu chỗ thì liên hệ Phòng Đào tạo.
- Trùng lịch phải kiểm tra theo buổi học, không theo lớp, vì một lớp có nhiều buổi.

## Phương án đã cân nhắc

- **Một môn có cả LT và TH (số tiết LT + số tiết TH):** gần thực tế hơn, nhưng phá công thức tín chỉ của QĐ2, và điểm hay học lại từng phần trở nên mơ hồ.
- **Đăng ký theo môn, hệ thống tự xếp lớp:** không có tranh chấp chỗ theo lớp, nhưng sinh viên mất quyền chọn lịch.
- **Đăng ký LT kèm bắt buộc một nhóm TH, giành hai chỗ nguyên tử** (quyết định cũ, bỏ ngày 2026-10-02): an toàn hơn, nhưng không khớp cách sinh viên chọn nhiều lớp trong một lượt, và ép mọi người học LT phải có nhóm TH.
- **Đổi lớp nguyên tử (giữ lớp cũ cho tới khi vào được lớp mới):** tiện cho sinh viên, nhưng thêm một luồng giành nhiều chỗ, thêm rủi ro deadlock và thêm test. Bỏ cho gọn.
- **Hình thức thực hành theo từng nhóm (trộn HT1 và HT2 trong một lớp LT):** không có nhu cầu thực tế.
- **Tối đa hai nhóm `.1`/`.2`, HT2 đúng một nhóm bằng sĩ số lớp LT** (quyết định cũ, bỏ ngày 2026-10-07): gọn, nhưng thời khoá biểu thật có lớp nhiều hơn hai nhóm, lớp HT2 chia nhiều nhóm, và môn TH không có phần LT.
