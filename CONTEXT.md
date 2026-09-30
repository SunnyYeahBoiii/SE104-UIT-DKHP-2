# Đăng ký học phần và Học phí (DKHP)

Hệ thống cho một trường đại học: sinh viên đăng ký lớp học phần mỗi học kỳ, giảng viên chấm điểm, và phòng tài vụ
thu học phí. Tài liệu này là glossary. Mỗi thuật ngữ ghi kèm **tên duy nhất trong code (tiếng Anh)**, theo
[ADR-0014](./docs/adr/0014-ten-trong-code-bang-tieng-anh.md). Quy tắc nghiệp vụ nằm ở
[docs/requirements.md](./docs/requirements.md).

Quy ước: **Thuật ngữ** (`TenTrongCode`): định nghĩa. _Tránh_: các từ không dùng.

## Tổ chức và con người

**Khoa** (`Faculty`):
Đơn vị quản lý một hoặc nhiều ngành.

**Ngành** (`Major`):
Ngành đào tạo thuộc một khoa. Mỗi sinh viên học đúng một ngành tại một thời điểm.
_Tránh_: chuyên ngành, ngành học (khi viết tắt trong code)

**Khoá tuyển sinh** (`Cohort`):
Nhóm sinh viên nhập học cùng năm (ví dụ K2024). Khoá của một sinh viên không bao giờ đổi. Khoá quyết định chương
trình học, bảng phí và khung giờ đăng ký.
_Tránh_: niên khoá, lớp sinh hoạt, batch

**Sinh viên** (`Student`):
Người học có mã số sinh viên, thuộc một ngành và một khoá tuyển sinh.
_Tránh_: học sinh, học viên, user

**Mã số sinh viên** (`studentCode`):
Mã định danh nghiệp vụ duy nhất của sinh viên (MSSV), dùng để đăng nhập và làm mã thanh toán.
_Tránh_: student id (khi nói về khoá chính kỹ thuật)

**Hồ sơ sinh viên** (`StudentProfile`):
Thông tin nhân thân theo BM1: họ tên, ngày sinh, giới tính, quê quán, đối tượng ưu tiên, ngành. Chỉ Phòng Đào tạo được sửa.

**Tỉnh** (`Province`) / **Huyện** (`District`):
Danh mục địa giới dùng cho quê quán. Mỗi huyện có cờ cho biết huyện đó có thuộc vùng sâu, vùng xa hay không.

**Đối tượng ưu tiên** (`PriorityGroup`):
Diện chính sách được giảm học phí theo một tỉ lệ (ví dụ con liệt sĩ 80%). Mỗi đối tượng có một độ ưu tiên. Sinh
viên thuộc nhiều đối tượng thì chỉ áp dụng đối tượng có độ ưu tiên cao nhất.
_Tránh_: diện miễn giảm, loại sinh viên

**Tỉ lệ giảm** (`discountRate`):
Phần trăm học phí được giảm theo đối tượng ưu tiên.

**Giảng viên** (`Lecturer`):
Người dạy lớp học phần và chịu trách nhiệm bảng điểm của lớp đó.
_Tránh_: giáo viên, teacher

**Phòng Đào tạo** (vai trò `ACADEMIC_OFFICE`):
Bộ phận quản lý hồ sơ, danh mục môn học, chương trình học, lớp học phần, học kỳ và khoá điểm.
_Tránh_: PĐT (chỉ dùng khi viết tắt trong văn bản)

**Phòng Tài vụ** (vai trò `FINANCE_OFFICE`):
Bộ phận quản lý bảng phí, hạn đóng, thu tiền tại quầy, đối soát và báo cáo công nợ.
_Tránh_: phòng kế toán, PTV (chỉ dùng khi viết tắt trong văn bản)

**Quản trị** (vai trò `ADMIN`):
Người quản lý tài khoản, phân quyền và danh mục hệ thống.

### Trạng thái sinh viên

**Trạng thái sinh viên** (`StudentStatus`):
Tình trạng học tập của sinh viên trong một học kỳ cụ thể, suy ra từ lịch sử quyết định. Gồm **Đang học**
(`ACTIVE`), **Bảo lưu** (`ON_LEAVE`), **Thôi học** (`WITHDRAWN`), **Đã tốt nghiệp** (`GRADUATED`).
_Tránh_: đình chỉ (không có trạng thái này)

**Quyết định bảo lưu** (`LeaveDecision`):
Quyết định của Phòng Đào tạo cho sinh viên tạm dừng học trong một hoặc nhiều học kỳ xác định.

## Đào tạo

**Môn học** (`Course`):
Đơn vị kiến thức trong danh mục của trường, có mã môn, tên, loại môn và số tiết. Mỗi môn chỉ có một loại (LT
hoặc TH). Một học phần có cả lý thuyết lẫn thực hành được tách thành hai môn.
_Tránh_: học phần (khi nói về danh mục), subject

**Loại môn** (`CourseType`):
**Lý thuyết** (`THEORY`) hoặc **Thực hành** (`PRACTICE`).

**Số tiết** (`totalPeriods`):
Tổng số tiết của môn. Với môn LT phải là bội số của 15, với môn TH phải là bội số của 30.
_Tránh_: nhầm với **tiết** trong lịch học (khung giờ)

**Số tín chỉ** (`credits`):
Số tiết / 15 với môn LT, số tiết / 30 với môn TH. Luôn là số nguyên.
_Tránh_: TC (chỉ dùng khi viết tắt trong văn bản), đơn vị học trình

**Môn LT đi kèm** (`companionTheoryCourse`):
Môn LT mà một môn TH gắn vào. Các nhóm thực hành của môn TH đó là con của lớp thuộc môn LT đi kèm.

**Môn tương đương** (`CourseEquivalence`):
Nhóm các môn được coi là một khi xét hình thức học, điều kiện tiên quyết và tín chỉ tích lũy (ví dụ môn cũ
đổi mã).
_Tránh_: môn thay thế

**Điều kiện tiên quyết** (`Prerequisite`):
Quan hệ giữa hai môn, gồm hai loại. **Tiên quyết** (`REQUIRED_PASS`): phải Đạt môn trước. **Học trước**
(`REQUIRED_ATTEMPT`): chỉ cần đã học môn trước và có điểm.
_Tránh_: môn song hành (không hỗ trợ)

**Chương trình học** (`Curriculum`):
Kế hoạch đào tạo của một ngành cho một khoá tuyển sinh (BM3), gồm các khối kiến thức và tổng tín chỉ tối
thiểu để tốt nghiệp.
_Tránh_: chương trình đào tạo, CTĐT (chỉ dùng khi viết tắt trong văn bản), khung chương trình

**Khối kiến thức** (`KnowledgeBlock`):
Nhóm môn trong chương trình học. Có hai loại. **Nhóm bắt buộc** (`REQUIRED`): phải đạt mọi môn trong nhóm.
**Nhóm tự chọn** (`ELECTIVE`): phải đạt tối thiểu một số tín chỉ trong danh sách môn của nhóm.

**Học kỳ gợi ý** (`suggestedTerm`):
Học kỳ mà chương trình học khuyến nghị học một môn. Chỉ để tham khảo, không ràng buộc việc đăng ký.

**Tiến độ chương trình** (`CurriculumProgress`):
Mức hoàn thành từng khối kiến thức và tổng tín chỉ của sinh viên so với chương trình học.

### Học kỳ

**Năm học** (`AcademicYear`):
Ví dụ 2025-2026. Gồm hai học kỳ chính và có thể có học kỳ hè.

**Học kỳ** (`Term`):
Một kỳ học trong năm học, gồm **HK1** (`FIRST`), **HK2** (`SECOND`) hoặc **Học kỳ hè** (`SUMMER`).
_Tránh_: semester (khi đặt tên trong code)

**Mã học kỳ** (`termCode`):
Chuỗi số định danh học kỳ, ghép từ năm bắt đầu của năm học và số kỳ (ví dụ `20251` là HK1 năm 2025-2026).

**Giai đoạn học kỳ** (`TermPhase`):
Vị trí của học kỳ trong vòng đời, theo thứ tự: **Chuẩn bị** (`PREPARATION`) → **Đăng ký** (`REGISTRATION`) →
**Điều chỉnh** (`ADJUSTMENT`) → **Đang học** (`IN_PROGRESS`) → **Kết thúc** (`CLOSED`).

**Đợt đăng ký** (`registration period`):
Hai giai đoạn Đăng ký và Điều chỉnh gộp lại, là khoảng thời gian sinh viên được thêm, huỷ hoặc đổi lớp.
_Tránh_: đợt ĐKHP, cổng đăng ký

**Khung giờ đăng ký** (`RegistrationSlot`):
Khoảng thời gian trong giai đoạn Đăng ký, chỉ dành cho một tập khoá tuyển sinh.

**Hạn đóng học phí** (`tuitionDeadline`):
Thời điểm mà sau đó sinh viên còn nợ học phí của học kỳ sẽ bị cấm thi.

### Môn mở và lớp

**Môn mở** (`OfferedCourse`):
Môn học được mở trong một học kỳ (BM4).
_Tránh_: môn học mở (khi viết tắt trong code)

**Lớp học phần** (`CourseSection`):
Một lớp cụ thể của một môn mở, có mã lớp (ví dụ `SE104.P21`), giảng viên, sĩ số tối đa và lịch học. Đây là
đơn vị sinh viên đăng ký.
_Tránh_: lớp (không kèm "học phần"), class, section (trong văn bản)

**Nhóm thực hành** (`PracticeSection`):
Lớp học phần của môn TH, là con của một lớp thuộc môn LT đi kèm (ví dụ `SE104.P21.1` thuộc `SE104.P21`).
_Tránh_: lớp TH độc lập, HT1/HT2

**Sĩ số tối đa** (`capacity`) / **Số đã đăng ký** (`enrolledCount`):
Số chỗ của lớp học phần và số chỗ đã có sinh viên giữ.

**Buổi học** (`Meeting`):
Một lịch lặp lại của lớp học phần: thứ trong tuần, tiết bắt đầu, tiết kết thúc, phòng và tập tuần học.

**Tiết** (`slot`):
Khung giờ học đánh số trong ngày (tiết 1 đến tiết 10).

**Tuần học** (`weeks`):
Tập các tuần của học kỳ mà buổi học diễn ra (ví dụ tuần 1–15, hoặc chỉ các tuần chẵn).

**Trùng lịch** (`ScheduleConflict`):
Hai buổi học cùng thứ, có khoảng tiết giao nhau và có ít nhất một tuần học chung.

## Đăng ký

**Phiếu đăng ký học phần** (`RegistrationForm`):
Tập hợp các dòng đăng ký của một sinh viên trong một học kỳ (BM5). Mỗi sinh viên có tối đa một phiếu cho mỗi
học kỳ.
_Tránh_: phiếu ĐKHP (chỉ dùng khi viết tắt trong văn bản), đơn đăng ký, giỏ môn

**Dòng đăng ký** (`Enrollment`):
Việc một sinh viên chiếm một chỗ trong một lớp học phần của một môn. Trạng thái: **Đã đăng ký** (`REGISTERED`),
**Đã huỷ** (`CANCELLED`), **Đã chốt** (`FINALIZED`).
_Tránh_: đăng ký môn, registration (khi chỉ một dòng)

**Lần học** (`Enrollment` ở trạng thái `FINALIZED`):
Một dòng đăng ký đã chốt. Mọi lần học đều có điểm (vắng thi thì điểm cuối kỳ là 0).
_Tránh_: lượt học, attempt (trong văn bản)

**Chốt phiếu** (`finalize`):
Việc khoá phiếu đăng ký khi hết giai đoạn Điều chỉnh. Từ lúc đó các dòng đăng ký trở thành lần học.
_Tránh_: khoá sổ

**Huỷ lớp** (`cancel`):
Bỏ một dòng đăng ký trong đợt đăng ký. Lớp đã huỷ không để lại lần học nào.
_Tránh_: rút môn, drop (khái niệm rút môn sau khi chốt không tồn tại)

**Đổi lớp** (`switchSection`):
Huỷ lớp cũ và đăng ký lớp mới của cùng một môn thành một thao tác duy nhất.

**Đăng ký có điều kiện** (`pendingPrerequisite`):
Dòng đăng ký được chấp nhận trong khi môn tiên quyết của nó còn đang học và chưa có điểm.

**Giới hạn tín chỉ** (`creditLimit`):
Tổng tín chỉ tối thiểu và tối đa mà sinh viên được đăng ký trong một học kỳ.

**Hình thức học** (`AttemptType`):
Phân loại một dòng đăng ký, suy ra từ kết quả hiện hành và chương trình học. Gồm **Lần đầu** (`FIRST`), **Học
lại** (`RETAKE`, kết quả hiện hành là Không đạt), **Cải thiện** (`IMPROVEMENT`, kết quả hiện hành là Đạt) và
**Môn tự do** (`FREE_ELECTIVE`, môn không thuộc chương trình học của sinh viên).
_Tránh_: học ngoài chương trình, học vượt (học vượt là Lần đầu)

**Môn tự do** (`FREE_ELECTIVE`):
Môn không thuộc chương trình học của sinh viên. Vẫn có điểm trên bảng điểm, nhưng không tính tín chỉ tích lũy,
không tính GPA và không phụ thu.
_Tránh_: môn ngoài chương trình

## Kết quả học tập

**Thành phần điểm** (`GradeComponent`):
Một cột điểm của lớp học phần (quá trình, giữa kỳ, thực hành, cuối kỳ) có trọng số. Tổng trọng số là 100%, và
luôn có cột cuối kỳ.

**Điểm thành phần** (`ComponentScore`):
Điểm của một sinh viên ở một thành phần, theo thang 10.

**Điểm học phần** (`courseScore`):
Tổng có trọng số của các điểm thành phần trong một lần học, theo thang 10, làm tròn 0,1.
_Tránh_: điểm tổng kết môn, điểm chữ (không dùng điểm chữ)

**Đạt / Không đạt** (`PASSED` / `FAILED`):
Kết luận của một lần học: Đạt khi điểm học phần ≥ 5,0.

**Thang 4** (`toScale4`):
Cách hiển thị điểm bằng thang 10 × 0,4. Không lưu riêng.
_Tránh_: điểm hệ 4 (khi hiểu là bảng quy đổi theo bậc)

**Bảng điểm lớp** (`Gradebook`):
Toàn bộ điểm của một lớp học phần. Trạng thái: **Nháp** (`DRAFT`) → **Đã nộp** (`SUBMITTED`) → **Đã khoá** (`LOCKED`).

**Sửa điểm** (`GradeAmendment`):
Thay đổi điểm sau khi bảng điểm lớp đã khoá. Chỉ Phòng Đào tạo làm được, có lý do và có lịch sử.
_Tránh_: phúc khảo (phúc khảo là một lý do để sửa điểm)

**Bảng điểm sinh viên** (`Transcript`):
Danh sách mọi lần học của một sinh viên, gồm cả môn tự do và các lần trượt.

**Kết quả hiện hành** (`EffectiveResult`):
Lần học đại diện cho một môn (hoặc nhóm tương đương) của một sinh viên. Nếu đã có lần Đạt thì lấy **lần Đạt gần
nhất**. Nếu chưa thì lấy **lần học gần nhất**. Hình thức học, tiên quyết, tín chỉ tích lũy và GPA tích lũy đều
dựa trên khái niệm này.
_Tránh_: điểm cao nhất, điểm cuối cùng

**Tín chỉ tích lũy** (`accumulatedCredits`):
Tổng tín chỉ các môn có kết quả hiện hành là Đạt, mỗi môn (hoặc nhóm tương đương) tính một lần, không tính môn tự do.

**GPA học kỳ** (`termGpa`):
Trung bình điểm học phần có trọng số tín chỉ, tính trên mọi lần học trong học kỳ, kể cả các lần Không đạt,
không tính môn tự do.

**GPA tích lũy** (`cumulativeGpa`):
Trung bình điểm có trọng số tín chỉ của kết quả hiện hành, tính trên các môn đã Đạt, không tính môn tự do.
_Tránh_: GPA (không kèm "học kỳ" hay "tích lũy"), CPA, điểm trung bình chung

**Xếp loại** (`Classification`):
Nhãn cho GPA: **Xuất sắc** (`EXCELLENT`, 9,0–10), **Giỏi** (`VERY_GOOD`, 8,0 đến dưới 9,0), **Khá** (`GOOD`,
7,0 đến dưới 8,0), **Trung bình** (`AVERAGE`, 5,0 đến dưới 7,0), **Yếu** (`WEAK`, dưới 5,0). Chỉ dùng cho
học lực học kỳ và hạng bằng dự kiến, không dùng cho một môn.

**Học lực học kỳ** (`termStanding`):
Xếp loại của GPA học kỳ.

**Hạng bằng dự kiến** (`projectedDegreeClass`):
Xếp loại của GPA tích lũy. Chỉ để tham khảo, không phải quyết định tốt nghiệp.

**Cấm thi** (`ExamBan`):
Tình trạng một sinh viên không được dự thi cuối kỳ ở mọi lớp của một học kỳ, vì còn nợ học phí lúc hạn đóng.
Điểm cuối kỳ của các lớp bị cấm thi là 0.
_Tránh_: cấm thi theo từng môn

## Học phí

**Bảng phí** (`FeeSchedule`):
Bộ tham số học phí của một khoá tuyển sinh: học phí cố định mỗi học kỳ chính, và đơn giá tín chỉ LT và TH.

**Học phí cố định** (`BaseTuition`):
Khoản phí trọn gói của một học kỳ chính, không phụ thuộc vào số lớp đăng ký.
_Tránh_: học phí niên chế, học phí khoá

**Đơn giá tín chỉ** (`creditRate`):
Số tiền cho mỗi tín chỉ, khác nhau giữa LT và TH (mặc định theo QĐ5 là 27.000đ và 37.000đ).

**Phụ thu** (`Surcharge`):
Khoản thu theo tín chỉ cho các dòng đăng ký học lại, cải thiện, và cho mọi dòng đăng ký của học kỳ hè.
_Tránh_: học phí tín chỉ, phí học lại

**Sổ cái công nợ** (`TuitionLedger`):
Nhật ký chỉ ghi thêm của mọi khoản nợ và khoản có của một sinh viên, chia theo học kỳ.
_Tránh_: bảng công nợ, tài khoản học phí

**Dòng sổ cái** (`LedgerEntry`):
Một khoản **ghi nợ** (học phí cố định, phụ thu, điều chỉnh tăng) hoặc **ghi có** (thanh toán, giảm trừ, đảo
phụ thu, chuyển số dư) trong sổ cái.

**Giảm trừ** (`Discount`):
Khoản ghi có tính từ tỉ lệ giảm của đối tượng ưu tiên, được chốt vào lúc khoản nợ tương ứng phát sinh.

**Khoản điều chỉnh** (`Adjustment`):
Dòng sổ cái do Phòng Tài vụ hoặc hệ thống tạo ra để sửa công nợ (ví dụ bảo lưu muộn, đổi đối tượng hồi tố), luôn có lý do.

**Số tiền đăng ký** (`grossAmount`):
Tổng các khoản ghi nợ của học kỳ, trước giảm trừ (cột BM7).

**Số tiền phải đóng** (`netAmount`):
Số tiền đăng ký trừ giảm trừ (cột BM7, luôn ≤ số tiền đăng ký).

**Số tiền còn lại** (`outstandingAmount`):
Số tiền phải đóng trừ số tiền đã thanh toán của học kỳ (cột BM7).
_Tránh_: nợ học phí (khi cần con số chính xác)

**Số dư có** (`CreditBalance`):
Phần tiền sinh viên đã đóng vượt số phải đóng, được tự trừ vào học kỳ sau.
_Tránh_: tiền thừa, tiền hoàn

**Thanh toán** (`Payment`):
Một lần tiền về cho một sinh viên và một học kỳ, qua một kênh thu.

**Kênh thu** (`PaymentChannel`):
**Tại quầy** (`COUNTER`) hoặc **Chuyển khoản** (`BANK_TRANSFER`).

**Phiếu thu** (`Receipt`):
Chứng từ cho một lần thanh toán (BM6), sinh ra với mọi kênh thu.
_Tránh_: biên lai, hoá đơn

**Mã thanh toán** (`paymentCode`):
Nội dung chuyển khoản cố định của một cặp (sinh viên, học kỳ): `HP` + mã số sinh viên + mã học kỳ.

**QR học phí** (`TuitionQr`):
Mã VietQR hiển thị khi số tiền còn lại lớn hơn 0, chứa số tiền còn lại và mã thanh toán. Sinh viên không chỉnh được.
_Tránh_: yêu cầu thanh toán, đơn hàng (không có thực thể này)

**Giao dịch ngân hàng** (`BankTransaction`):
Một khoản tiền vào tài khoản của trường, được SePay báo về.

**Giao dịch chưa khớp** (`UnmatchedTransaction`):
Giao dịch ngân hàng không xác định được sinh viên và học kỳ. Chờ Phòng Tài vụ gán thủ công.

**Đối soát** (`Reconciliation`):
Việc so danh sách giao dịch ngân hàng với sổ cái để tìm chỗ lệch.

## Các điểm dễ nhầm đã chốt

- "Đăng ký môn" luôn nghĩa là đăng ký **lớp học phần** của môn đó. Không có việc đăng ký một môn mà không chọn lớp.
- **Huỷ lớp** chỉ có trong đợt đăng ký. Sau khi chốt phiếu, không còn khái niệm rút môn: sinh viên vắng thi thì điểm cuối kỳ là 0.
- **Số tiết** (thuộc môn học, dùng để tính tín chỉ) khác **tiết** (khung giờ trong lịch học).
- **Học vượt** (học sớm hơn học kỳ gợi ý) là **Lần đầu**, không phải một hình thức học riêng.
- **Cải thiện mà trượt** không làm mất trạng thái Đạt: kết quả hiện hành vẫn là lần Đạt gần nhất, nhưng lần trượt vẫn được tính vào GPA học kỳ của kỳ đó.
- Học phí **không** tính theo tín chỉ như QĐ5. Đơn giá tín chỉ chỉ dùng cho phụ thu (xem [ADR-0003](./docs/adr/0003-mo-hinh-hoc-phi-lai.md)).
- **Số tiền phải đóng** là số sau khi giảm. **Số tiền còn lại** là số sau khi đã trừ các lần thanh toán.
