# 0003. Mô hình học phí lai: cố định theo khoá + phụ thu theo tín chỉ

- Trạng thái: accepted
- Ngày: 2026-09-30
- Nguồn: phiên grill 2026-09-30, câu 6 và 19

## Bối cảnh

QĐ5 tính học phí = số tín chỉ đăng ký × đơn giá (27.000đ LT, 37.000đ TH). Ở UIT, học phí học kỳ chính là **một
mức cố định theo khoá**, không phụ thuộc số môn đăng ký. Tiền chỉ tăng thêm khi học lại, học cải thiện, hoặc
học hè. Làm đúng QĐ5 sẽ ra số tiền sai với thực tế. Bỏ hẳn QĐ5 thì BM7 và QĐ7 mất nghĩa.

## Quyết định

- **Học phí cố định** theo khoá cho mỗi học kỳ chính, tự ghi nợ khi học kỳ vào giai đoạn Đăng ký cho mọi sinh viên có hồ sơ.
- **Phụ thu** = tín chỉ × đơn giá QĐ5 (LT/TH), cho dòng đăng ký Học lại và Cải thiện. Học kỳ hè không có học phí cố định: mọi dòng đều phụ thu.
- Lần đầu (kể cả học vượt) ở học kỳ chính không phụ thu.
- **Giảm trừ** theo đối tượng ưu tiên (một đối tượng cao nhất) áp cho cả học phí cố định lẫn phụ thu. Tỉ lệ chốt lúc khoản nợ phát sinh.
- Tín chỉ và đơn giá chốt vào dòng đăng ký. Không có khoản điều chỉnh. Thay đổi duy nhất là **tính lại học phí** khi sửa khoá, hệ hoặc đối tượng ưu tiên trong đợt đăng ký: đảo toàn bộ nợ và giảm trừ của học kỳ rồi ghi lại ([ADR-0019](./0019-thu-hep-pham-vi-du-lieu-nen.md)).
- Cột BM7: Số tiền đăng ký = tổng ghi nợ trước giảm. Số tiền phải đóng = sau giảm. Số tiền còn lại = phải đóng − đã đóng.

## Hệ quả

- QĐ5 (đơn giá), QĐ6 (đóng nhiều lần) và QĐ7 (phải đóng ≤ đăng ký) đều còn nghĩa và kiểm thử được.
- Đăng ký hay huỷ một môn lần đầu không đổi công nợ, nên đa số thao tác đăng ký không chạm tới sổ cái. Chỉ dòng học lại, cải thiện và học hè ghi thêm dòng phụ thu hoặc đảo phụ thu.
- Hình thức học quyết định tiền, nên việc suy ra hình thức học (dựa trên kết quả hiện hành) trở thành logic tài chính và phải có test.

## Phương án đã cân nhắc

- **A. Đúng QĐ5 (thuần tín chỉ):** khớp đề nhưng sai thực tế.
- **B. Thuần cố định:** khớp UIT nhưng QĐ5 bị bỏ, và học lại thì không tốn thêm tiền.
