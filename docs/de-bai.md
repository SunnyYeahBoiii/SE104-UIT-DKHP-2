# Đề bài gốc: Quản lý việc đăng ký môn học và thu học phí của sinh viên

> Nguồn: đề tài 1.13, file `Danh sach de tai - NM CNPM.docx` (môn SE104, Nhập môn Công nghệ phần mềm, UIT).
> Bản này chép lại nguyên văn nội dung đề để tra cứu. Phần mở rộng và các điểm lệch so với đề nằm trong
> [requirements.md](./requirements.md) và các ADR, đặc biệt là [ADR-0001](./adr/0001-mo-rong-pham-vi-so-voi-de.md)
> và [ADR-0003](./adr/0003-mo-hinh-hoc-phi-lai.md).

## Danh sách các yêu cầu

| STT | Tên yêu cầu | Biểu mẫu | Qui định |
|---|---|---|---|
| 1 | Lập hồ sơ sinh viên | BM1 | QĐ1 |
| 2 | Nhập danh sách môn học | BM2 | QĐ2 |
| 3 | Nhập chương trình học | BM3 | QĐ3 |
| 4 | Nhập môn học mở trong học kỳ | BM4 | QĐ4 |
| 5 | Lập phiếu đăng ký học phần | BM5 | QĐ5 |
| 6 | Lập phiếu thu học phí | BM6 | QĐ6 |
| 7 | Lập báo cáo sinh viên chưa đóng học phí | BM7 | QĐ7 |

## Biểu mẫu và qui định

### BM1: Hồ sơ sinh viên

Họ tên, Ngày sinh, Giới tính, Quê quán, Đối tượng, Ngành học.

**QĐ1:** Quê quán gồm Huyện và Tỉnh. Cần lưu lại danh sách các Huyện và Tỉnh này, thông tin về Huyện sẽ cho
biết Huyện đó có thuộc vùng sâu/vùng xa hay không. Sinh viên thuộc một trong các đối tượng ưu tiên sau: con
liệt sĩ, con thương binh, vùng sâu, vùng xa… Mỗi đối tượng có một tỉ lệ tương ứng về việc giảm học phí (80%,
50%, 30%…), đối tượng của sinh viên là đối tượng có độ ưu tiên cao nhất mà sinh viên thuộc về. Mỗi Khoa có
nhiều Ngành học, mỗi sinh viên học một Ngành học.

### BM2: Danh sách môn học

| Stt | Mã môn học | Tên môn học | Loại môn | Số tiết |
|---|---|---|---|---|

**QĐ2:** Có hai loại môn: lý thuyết (LT) và thực hành (TH). Dựa vào loại môn và số tiết để biết được số tín
chỉ của môn học: số tín chỉ = số tiết/15 đối với môn LT; số tín chỉ = số tiết/30 đối với môn TH.

### BM3: Chương trình học

Ngành học, Khoa.

| Học kỳ | Môn học | Ghi chú |
|---|---|---|

**QĐ3:** Phòng đào tạo sẽ dựa trên kế hoạch đào tạo (chương trình học) của các ngành để lập danh sách các môn
học sẽ mở trong một học kỳ của năm học.

### BM4: Danh sách môn học mở

Học kỳ, Năm học.

| Stt | Môn học |
|---|---|

**QĐ4:** Có hai học kỳ chính trong một năm học (HK I, HK II). Có thể có học kỳ bổ sung (học kỳ hè) tuỳ theo
nhu cầu thực tế.

### BM5: Phiếu đăng ký học phần

Số phiếu, Mã số sinh viên, Ngày lập, Học kỳ, Năm học.

| Stt | Môn học | Số tín chỉ |
|---|---|---|

**QĐ5:** Phòng tài vụ sẽ dựa trên số tín chỉ mà sinh viên đăng ký để thu học phí: nếu đăng ký môn LT sinh viên
sẽ phải đóng 27.000đ/1 tín chỉ; với môn TH là 37.000đ/1 tín chỉ. Sinh viên chỉ được đăng ký các môn học có mở
trong một học kỳ của năm học.

### BM6: Phiếu thu học phí

Số phiếu, Ngày lập, Mã số sinh viên, Số tiền thu.

**QĐ6:** Phiếu thu được lập dựa trên phiếu đăng ký học phần của sinh viên trong một học kỳ. Sinh viên có thể
đóng học phí nhiều lần cho một phiếu đăng ký nhưng phải hoàn thành việc đóng học phí trước thời hạn qui định
đóng học phí của học kỳ đó (nếu không sẽ không được tham dự kỳ thi cuối kỳ).

### BM7: Danh sách sinh viên chưa hoàn thành việc đóng học phí

Học kỳ, Năm học.

| Stt | Mã số sinh viên | Số tiền đăng ký | Số tiền phải đóng | Số tiền còn lại |
|---|---|---|---|---|

**QĐ7:** Số tiền phải đóng <= Số tiền đăng ký, do sinh viên thuộc các đối tượng ưu tiên.
