# Yêu cầu hệ thống DKHP

Tài liệu này là đặc tả nghiệp vụ và phi chức năng của hệ thống. Thuật ngữ in đậm được định nghĩa trong
[CONTEXT.md](../CONTEXT.md). Đề gốc nằm ở [de-bai.md](./de-bai.md). Lý do của các quyết định lớn nằm trong
[adr/](./adr/).

Mỗi quy tắc có một mã (ví dụ `DK-05`). **Mọi quy tắc phải có ít nhất một test tham chiếu mã của nó** (xem
[ADR-0016](./adr/0016-chien-luoc-kiem-thu.md)). Cột "Nguồn" ghi QĐ của đề, hoặc "Mở rộng" nếu là phần bổ sung
(xem [ADR-0001](./adr/0001-mo-rong-pham-vi-so-voi-de.md)).

## 1. Phạm vi

Hệ thống thực hiện đủ 7 yêu cầu của đề (BM1–BM7, QĐ1–QĐ7) và mở rộng thêm:

- lớp học phần có giảng viên, sĩ số, lịch học; kiểm tra trùng lịch và hết chỗ
- vòng đời học kỳ và đợt đăng ký (Đăng ký, Điều chỉnh, chốt phiếu)
- điều kiện tiên quyết, môn tương đương, chương trình học theo khối kiến thức
- nhập điểm, bảng điểm, GPA, tín chỉ tích lũy, xếp loại
- học phí lai (cố định theo khoá + phụ thu theo tín chỉ), sổ cái công nợ
- thanh toán online qua SePay (VietQR) và thu tại quầy
- cấm thi khi quá hạn đóng học phí

### Ngoài phạm vi

- Xét tốt nghiệp, cấp bằng.
- Rút môn sau khi chốt phiếu.
- Danh sách chờ khi lớp đầy.
- Môn song hành.
- Hoàn tiền qua cổng thanh toán (Phòng Tài vụ hoàn thủ công, chỉ ghi nhận vào sổ cái).
- Tự động xếp thời khoá biểu và phòng học, lịch thi, đánh giá giảng viên.
- Gửi email và SMS (chỉ có thông báo trong ứng dụng).
- Đa ngôn ngữ (chỉ tiếng Việt), ứng dụng di động native.
- SSO và đăng nhập qua bên thứ ba.

## 2. Vai trò và quyền

Một tài khoản có thể giữ nhiều vai trò.

| Vai trò | Mã | Được làm |
|---|---|---|
| Sinh viên | `STUDENT` | Đăng ký, huỷ và đổi lớp của chính mình. Xem bảng điểm, tiến độ, công nợ, QR học phí, phiếu thu, thời khoá biểu. |
| Giảng viên | `LECTURER` | Xem danh sách lớp mình dạy. Nhập và nộp bảng điểm lớp. |
| Phòng Đào tạo | `ACADEMIC_OFFICE` | Hồ sơ sinh viên (BM1), đối tượng ưu tiên, trạng thái sinh viên. Danh mục môn học (BM2), môn tương đương, tiên quyết. Chương trình học (BM3). Học kỳ, môn mở (BM4), lớp học phần, lịch học. Khoá bảng điểm, sửa điểm, gỡ cấm thi. |
| Phòng Tài vụ | `FINANCE_OFFICE` | Bảng phí, hạn đóng. Thu tại quầy (BM6). Khoản điều chỉnh, hoàn tiền thủ công. Gán giao dịch chưa khớp, đối soát. Báo cáo BM7. |
| Quản trị | `ADMIN` | Tài khoản, vai trò, danh mục Tỉnh/Huyện/Khoa/Ngành, tham số hệ thống. |

| Mã | Quy tắc | Nguồn |
|---|---|---|
| QV-01 | Chỉ Phòng Đào tạo được tạo và sửa hồ sơ sinh viên và đối tượng ưu tiên của sinh viên. | Mở rộng |
| QV-02 | Sinh viên chỉ đọc và thao tác trên dữ liệu của chính mình. Giảng viên chỉ thao tác trên lớp mình dạy. | Mở rộng |
| QV-03 | Mọi command (thao tác ghi) đều được ghi vào nhật ký kiểm toán chỉ ghi thêm: người làm, vai trò, thời điểm, dữ liệu vào, kết quả. | Mở rộng |

## 3. Hồ sơ sinh viên và tổ chức

| Mã | Quy tắc | Nguồn |
|---|---|---|
| HS-01 | Quê quán gồm Huyện và Tỉnh, chọn từ danh mục. Mỗi Huyện có cờ vùng sâu/vùng xa. | QĐ1 |
| HS-02 | Mỗi đối tượng ưu tiên có tỉ lệ giảm và độ ưu tiên. Sinh viên thuộc nhiều đối tượng thì chỉ áp dụng đối tượng có độ ưu tiên cao nhất. | QĐ1 |
| HS-03 | Mỗi Khoa có nhiều Ngành. Mỗi sinh viên thuộc đúng một Ngành và một Khoá tuyển sinh tại một thời điểm. | QĐ1 |
| HS-04 | Khoá tuyển sinh của sinh viên không bao giờ đổi. | Mở rộng |
| HS-05 | Đổi ngành: sinh viên theo chương trình học của ngành mới + khoá gốc. Môn đã học không thuộc chương trình mới trở thành môn tự do khi tính tích lũy. Khoản phụ thu đã chốt thì giữ nguyên. | Mở rộng |
| HS-06 | Trạng thái sinh viên (`ACTIVE`, `ON_LEAVE`, `WITHDRAWN`, `GRADUATED`) chỉ đổi qua quyết định của Phòng Đào tạo, có lý do và lịch sử. Bảo lưu là quyết định theo học kỳ. | Mở rộng |
| HS-07 | Quyết định bảo lưu cho học kỳ đã bắt đầu: nếu còn trong đợt đăng ký thì tự huỷ các dòng đăng ký, và hệ thống tự tạo khoản điều chỉnh đảo học phí cố định và phụ thu của học kỳ đó. | Mở rộng |
| HS-08 | Nhập hàng loạt BM1–BM4 từ CSV/Excel theo kiểu tất cả hoặc không: một dòng lỗi thì không ghi gì, trả báo cáo lỗi theo từng dòng. | Mở rộng |

## 4. Đào tạo

| Mã | Quy tắc | Nguồn |
|---|---|---|
| DT-01 | Môn học có đúng một loại: LT hoặc TH. Học phần có cả hai phần được khai báo thành hai môn; môn TH có thể trỏ tới môn LT đi kèm. | QĐ2, ADR-0002 |
| DT-02 | Số tiết môn LT phải chia hết cho 15, môn TH phải chia hết cho 30. Số tín chỉ = số tiết / 15 (LT) hoặc số tiết / 30 (TH). | QĐ2 |
| DT-03 | Chương trình học thuộc một cặp (Ngành, Khoá), gồm các khối kiến thức bắt buộc và tự chọn, mỗi môn có học kỳ gợi ý, và có tổng tín chỉ tối thiểu. | QĐ3 |
| DT-04 | Môn tương đương được coi là một môn khi xét hình thức học, tiên quyết và tín chỉ tích lũy. | Mở rộng |
| DT-05 | Điều kiện tiên quyết có hai loại: Tiên quyết (phải Đạt) và Học trước (phải có điểm). Không hỗ trợ song hành. Đồ thị tiên quyết không được có chu trình. | Mở rộng |
| DT-06 | Một năm học có HK1, HK2 và có thể có học kỳ hè. | QĐ4 |
| DT-07 | Môn mở của học kỳ được lập dựa trên chương trình học. Hệ thống gợi ý môn theo học kỳ gợi ý nhưng không bắt buộc. | QĐ3, QĐ4 |
| DT-08 | Lớp học phần thuộc một môn mở, có giảng viên, sĩ số tối đa > 0, và một hoặc nhiều buổi học. Nhóm thực hành là con của một lớp thuộc môn LT đi kèm. | Mở rộng |
| DT-09 | Buổi học: thứ 2–8, tiết bắt đầu ≤ tiết kết thúc trong khoảng 1–10, phòng, tập tuần học. | Mở rộng |
| DT-10 | Khi Phòng Đào tạo xếp lịch, hệ thống cảnh báo trùng phòng và trùng giảng viên nhưng không chặn. | Mở rộng |

### Học kỳ

| Mã | Quy tắc | Nguồn |
|---|---|---|
| HK-01 | Mã học kỳ = năm bắt đầu của năm học + số kỳ (1, 2, 3 = hè). Ví dụ `20251`. | Mở rộng |
| HK-02 | Thứ tự mốc thời gian bắt buộc: bắt đầu Đăng ký < kết thúc Đăng ký ≤ bắt đầu Điều chỉnh < kết thúc Điều chỉnh < hạn đóng học phí < thi cuối kỳ. | Mở rộng |
| HK-03 | Giai đoạn học kỳ chuyển tự động theo mốc thời gian: `PREPARATION` → `REGISTRATION` → `ADJUSTMENT` → `IN_PROGRESS` → `CLOSED`. Không chuyển ngược. | Mở rộng |
| HK-04 | Tại mọi thời điểm có tối đa một học kỳ đang ở `REGISTRATION` hoặc `ADJUSTMENT`. | Mở rộng |
| HK-05 | Giai đoạn Đăng ký chia thành các khung giờ đăng ký theo khoá. Giai đoạn Điều chỉnh mở cho mọi khoá. | Mở rộng |

## 5. Đăng ký

| Mã | Quy tắc | Nguồn |
|---|---|---|
| DK-01 | Mỗi sinh viên có tối đa một phiếu đăng ký cho mỗi học kỳ. Phiếu tạo khi sinh viên đăng ký lớp đầu tiên. | QĐ5 |
| DK-02 | Sinh viên chỉ thêm, huỷ, đổi lớp khi: học kỳ đang ở `REGISTRATION` hoặc `ADJUSTMENT`, sinh viên `ACTIVE` trong học kỳ đó, và (nếu đang ở `REGISTRATION`) đang trong khung giờ của khoá mình. | Mở rộng |
| DK-03 | Chỉ đăng ký được lớp của môn có mở trong học kỳ. | QĐ5 |
| DK-04 | Mỗi phiếu có tối đa một dòng đăng ký còn hiệu lực cho mỗi môn (tính cả môn tương đương). | Mở rộng |
| DK-05 | Tiên quyết: môn Tiên quyết phải Đạt, môn Học trước phải có điểm, theo kết quả hiện hành và tính cả môn tương đương. Nếu môn tiên quyết đang được học trong học kỳ trước và chưa có điểm thì cho đăng ký có điều kiện. | Mở rộng |
| DK-06 | Khi bảng điểm môn tiên quyết khoá và sinh viên Không đạt: nếu phiếu còn trong đợt đăng ký thì tự huỷ dòng đăng ký có điều kiện và thông báo sinh viên. Nếu đã chốt thì thông báo Phòng Đào tạo. | Mở rộng |
| DK-07 | Lớp mới không được trùng lịch với bất kỳ lớp nào còn hiệu lực trong phiếu. Hai buổi trùng khi cùng thứ, khoảng tiết giao nhau và có ít nhất một tuần chung. Lớp chưa có lịch không bao giờ trùng. | Mở rộng |
| DK-08 | Tổng tín chỉ của phiếu (không tính dòng đã huỷ) không vượt tối đa. Mức tối thiểu chỉ kiểm tra lúc chốt phiếu và chỉ cảnh báo cho Phòng Đào tạo. | Mở rộng |
| DK-09 | Lớp chỉ nhận thêm sinh viên khi số đã đăng ký < sĩ số tối đa. Không có danh sách chờ. | Mở rộng |
| DK-10 | Thứ tự kiểm tra khi đăng ký: DK-02 → DK-03 → DK-04 → DK-05 → DK-07 → DK-08 → DK-09. Lỗi trả về là lỗi đầu tiên gặp phải. Giành chỗ (DK-09) luôn làm cuối cùng. | Mở rộng |
| DK-11 | Đăng ký lớp LT có nhóm thực hành thì phải chọn đúng một nhóm thực hành con. Hai chỗ được giành cùng lúc: thiếu một thì không giành chỗ nào. Huỷ lớp LT thì huỷ luôn nhóm thực hành. | Mở rộng, ADR-0002 |
| DK-12 | Ngoại lệ học lại tách: nếu một trong hai môn LT/TH đã Đạt thì được đăng ký riêng môn còn lại. Nhóm thực hành khi đó được chọn trong bất kỳ lớp LT nào. | Mở rộng |
| DK-13 | Đổi lớp là một thao tác duy nhất: hoặc giữ lớp cũ, hoặc chuyển hẳn sang lớp mới. | Mở rộng |
| DK-14 | Huỷ lớp chỉ trong đợt đăng ký. Dòng đã huỷ không tạo lần học và không xuất hiện trên bảng điểm. | Mở rộng |
| DK-15 | Hết giai đoạn Điều chỉnh, mọi phiếu tự chốt: dòng `REGISTERED` thành `FINALIZED`. Sau khi chốt không có rút môn. | Mở rộng |
| DK-16 | Hình thức học được suy ra tự động lúc đăng ký: môn không thuộc chương trình học → Môn tự do. Kết quả hiện hành là Không đạt → Học lại. Kết quả hiện hành là Đạt → Cải thiện. Còn lại → Lần đầu (kể cả học vượt). | Mở rộng |
| DK-17 | Sau khi đổi ngành, hình thức học được suy ra lại theo chương trình mới khi tính tích lũy. Khoản phụ thu đã chốt không đổi. | Mở rộng |

## 6. Kết quả học tập

| Mã | Quy tắc | Nguồn |
|---|---|---|
| KQ-01 | Mỗi lớp học phần khai báo các thành phần điểm với trọng số. Tổng trọng số = 100%, bắt buộc có thành phần cuối kỳ. | Mở rộng |
| KQ-02 | Điểm theo thang 10. Điểm thành phần và điểm học phần làm tròn tới 0,1. | Mở rộng |
| KQ-03 | Đạt khi điểm học phần ≥ 5,0. Mỗi môn chỉ hiển thị Đạt / Không đạt, không có điểm chữ. | Mở rộng |
| KQ-04 | Thang 4 = thang 10 × 0,4, chỉ dùng để hiển thị. | Mở rộng |
| KQ-05 | Bảng điểm lớp: `DRAFT` → `SUBMITTED` (giảng viên nộp) → `LOCKED` (Phòng Đào tạo khoá). Giảng viên chỉ sửa khi ở `DRAFT`. | Mở rộng |
| KQ-06 | Sau khi khoá, chỉ Phòng Đào tạo được sửa điểm, bắt buộc có lý do, lưu đầy đủ lịch sử, và phát lại sự kiện khoá điểm để tính lại các phần phụ thuộc. | Mở rộng |
| KQ-07 | Kết quả hiện hành = lần Đạt gần nhất nếu có, nếu không thì lần học gần nhất. | Mở rộng |
| KQ-08 | Tín chỉ tích lũy = tổng tín chỉ các môn có kết quả hiện hành Đạt, mỗi môn hoặc nhóm tương đương tính một lần, không tính môn tự do. Tín chỉ tự chọn vượt mức vẫn được cộng. | Mở rộng |
| KQ-09 | GPA học kỳ = trung bình điểm học phần có trọng số tín chỉ trên mọi lần học đã chốt của học kỳ, kể cả Không đạt, không tính môn tự do. | Mở rộng |
| KQ-10 | GPA tích lũy = trung bình có trọng số tín chỉ của điểm kết quả hiện hành, trên các môn Đạt, không tính môn tự do. | Mở rộng |
| KQ-11 | Xếp loại: Xuất sắc [9,0; 10], Giỏi [8,0; 9,0), Khá [7,0; 8,0), Trung bình [5,0; 7,0), Yếu < 5,0. Áp cho học lực học kỳ và hạng bằng dự kiến. Không có quy tắc hạ bậc. | Mở rộng |
| KQ-12 | Tiến độ chương trình hiển thị tín chỉ đã đạt theo từng khối kiến thức và so với tổng tín chỉ tối thiểu. | Mở rộng |

### Cấm thi

| Mã | Quy tắc | Nguồn |
|---|---|---|
| CT-01 | Sau hạn đóng học phí (job chạy trễ 1 giờ để chờ giao dịch về muộn), sinh viên có số tiền còn lại > 0 của học kỳ bị cấm thi ở mọi lớp của học kỳ đó. Giao dịch chuyển khoản tính theo thời điểm giao dịch ngân hàng, không theo lúc webhook đến. | QĐ6 |
| CT-02 | Cấm thi cố định: đóng tiền sau hạn không gỡ cấm thi. | QĐ6 |
| CT-03 | Lớp bị cấm thi: điểm cuối kỳ đặt bằng 0 và khoá, giảng viên không sửa được. | Mở rộng |
| CT-04 | Phòng Đào tạo gỡ được cấm thi, bắt buộc có lý do. | Mở rộng |

## 7. Học phí

Xem [ADR-0003](./adr/0003-mo-hinh-hoc-phi-lai.md) và [ADR-0004](./adr/0004-so-cai-cong-no-append-only.md).

| Mã | Quy tắc | Nguồn |
|---|---|---|
| HP-01 | Mỗi khoá có bảng phí gồm học phí cố định mỗi học kỳ chính và đơn giá tín chỉ LT, TH. | Mở rộng, thay QĐ5 |
| HP-02 | Khi học kỳ chính vào `REGISTRATION`, hệ thống ghi nợ học phí cố định cho mọi sinh viên `ACTIVE` trong học kỳ. Học kỳ hè không có học phí cố định. | Mở rộng |
| HP-03 | Phụ thu = số tín chỉ × đơn giá theo loại môn, áp cho dòng đăng ký Học lại và Cải thiện ở học kỳ chính, và mọi dòng (trừ môn tự do) ở học kỳ hè. Lần đầu và môn tự do ở học kỳ chính không phụ thu. | QĐ5 (đơn giá) |
| HP-04 | Số tín chỉ và đơn giá được chốt vào dòng đăng ký lúc đăng ký. Đổi bảng phí sau đó không ảnh hưởng. | Mở rộng |
| HP-05 | Huỷ lớp thì ghi một dòng đảo phụ thu tương ứng. Không sửa hay xoá dòng sổ cái cũ. | Mở rộng |
| HP-06 | Giảm trừ = khoản nợ × tỉ lệ giảm của đối tượng ưu tiên, áp cho cả học phí cố định lẫn phụ thu. Tỉ lệ được chốt lúc khoản nợ phát sinh. Làm tròn xuống tới đồng. | QĐ1, QĐ7 |
| HP-07 | Đổi đối tượng ưu tiên có hiệu lực hồi tố chỉ qua khoản điều chỉnh do Phòng Tài vụ tạo. | Mở rộng |
| HP-08 | Tiền lưu dưới dạng số nguyên đồng (VND), không dùng số thực. | Mở rộng |
| HP-09 | BM7: Số tiền đăng ký = tổng ghi nợ trước giảm. Số tiền phải đóng = Số tiền đăng ký − giảm trừ. Số tiền còn lại = Số tiền phải đóng − đã thanh toán. Luôn có Số tiền phải đóng ≤ Số tiền đăng ký. | QĐ7 |
| HP-10 | Báo cáo BM7 liệt kê sinh viên có số tiền còn lại > 0 của một học kỳ, xuất được Excel và PDF. | BM7 |
| HP-11 | Đóng thừa tạo số dư có, tự trừ vào học kỳ kế tiếp. Phòng Tài vụ có thể hoàn tiền thủ công và ghi nhận vào sổ cái. | Mở rộng |

## 8. Thanh toán

Xem [ADR-0011](./adr/0011-sepay-voi-ma-thanh-toan-tat-dinh.md).

| Mã | Quy tắc | Nguồn |
|---|---|---|
| TT-01 | Sinh viên được đóng nhiều lần cho một học kỳ. Mỗi lần tạo một phiếu thu (BM6) và một dòng ghi có. | QĐ6 |
| TT-02 | Mã thanh toán = `HP` + mã số sinh viên + mã học kỳ, ví dụ `HP2352000120251`. | Mở rộng |
| TT-03 | QR học phí chỉ hiển thị khi số tiền còn lại > 0. Số tiền trên QR = số tiền còn lại tại lúc hiển thị, sinh viên không chỉnh được. | Mở rộng |
| TT-04 | Webhook SePay: kiểm tra header `Authorization: Apikey`, `transferType = in` và số tài khoản nhận. Lưu giao dịch với ràng buộc duy nhất trên `id` của SePay rồi trả 200 ngay. Xử lý ghi sổ ở worker. | Mở rộng |
| TT-05 | Một giao dịch SePay chỉ tạo tối đa một phiếu thu, dù webhook đến bao nhiêu lần. | Mở rộng |
| TT-06 | Ghi có đúng số tiền thực nhận. Thiếu thì còn nợ, và QR kế tiếp hiện phần còn lại. Thừa thì thành số dư có. | QĐ6 |
| TT-07 | Giao dịch không khớp mã thanh toán vào hàng chờ gán thủ công của Phòng Tài vụ. | Mở rộng |
| TT-08 | Đối soát hằng ngày với API SePay để bắt giao dịch có trên ngân hàng mà webhook bỏ sót. | Mở rộng |
| TT-09 | Thu tại quầy dùng cùng cấu trúc phiếu thu với kênh `COUNTER`. | QĐ6 |

## 9. Phi chức năng

| Mã | Yêu cầu |
|---|---|
| NFR-01 | Chịu được 1000 người dùng đồng thời trong đợt đăng ký, 80–90% là đọc. |
| NFR-02 | p95 thời gian phản hồi < 500 ms và 0 lỗi 5xx ở bài k6 1000 VU. |
| NFR-03 | Tính đúng dưới tranh chấp: không bao giờ vượt sĩ số, vượt tín chỉ tối đa, trùng lịch hay trùng môn trong một phiếu, dù sinh viên gửi song song bao nhiêu request (xem [ADR-0005](./adr/0005-chien-luoc-dong-thoi-khi-dang-ky.md)). |
| NFR-04 | Request ghi quan trọng (đăng ký, huỷ, đổi lớp, thu tiền) có khoá chống lặp: gửi lại cùng khoá trả cùng kết quả. |
| NFR-05 | Giới hạn tần suất theo sinh viên cho API đăng ký, và theo tài khoản/IP cho đăng nhập. |
| NFR-06 | Giao diện sinh viên mobile-first: rộng tối thiểu 360 px, không cuộn ngang, vùng chạm ≥ 44 px. QR có nút lưu ảnh, và các nút sao chép số tài khoản, số tiền, nội dung chuyển khoản. |
| NFR-07 | Giao diện nhân viên desktop-first nhưng dùng được trên di động. Bảng rộng cuộn ngang trong khung riêng của bảng. |
| NFR-08 | Mật khẩu băm argon2id. Session opaque lưu Redis, cookie `httpOnly; Secure; SameSite=Lax`, hết hạn tuyệt đối sau 8 giờ. Đổi mật khẩu bắt buộc ở lần đăng nhập đầu. Thao tác tài chính của Phòng Tài vụ có thêm CSRF token. |
| NFR-09 | Log JSON có request id và correlation id. `/metrics` cho Prometheus, có dashboard Grafana. |
| NFR-10 | Nhật ký kiểm toán và sổ cái chỉ ghi thêm, không có API sửa hay xoá. |
| NFR-11 | Thông báo trong ứng dụng cho: tự huỷ vì trượt tiên quyết, cấm thi, thanh toán đã ghi nhận, sửa điểm. |
| NFR-12 | Xuất file: BM7 (Excel, PDF), bảng điểm sinh viên (PDF), danh sách lớp (Excel). Thời khoá biểu dạng lưới tuần. |

## 10. Tham số mặc định

Các giá trị dưới đây là cấu hình, Quản trị hoặc Phòng Tài vụ đổi được. Thay đổi không hồi tố.

| Tham số | Mặc định |
|---|---|
| Tín chỉ tối thiểu / tối đa mỗi học kỳ chính | 14 / 24 |
| Tín chỉ tối đa học kỳ hè | 12 |
| Đơn giá tín chỉ LT / TH | 27.000đ / 37.000đ |
| Ngưỡng Đạt | 5,0 |
| Độ trễ job cấm thi sau hạn đóng | 1 giờ |
| Chu kỳ polling trang đăng ký | 5 giây |
| TTL cache danh sách lớp và chỗ còn | vài giây (mặc định 3 giây) |
| TTL khoá chống lặp | 24 giờ |
| Thời hạn session | 8 giờ tuyệt đối |
| Timeout / maxWait transaction đăng ký | 5 giây / 2 giây |
