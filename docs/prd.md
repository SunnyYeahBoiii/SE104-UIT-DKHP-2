# PRD: Hệ thống Đăng ký học phần và Học phí (DKHP)

Tài liệu này đặc tả yêu cầu người dùng của hệ thống. Thuật ngữ in đậm theo [CONTEXT.md](../CONTEXT.md). Quy tắc chi
tiết có mã (ví dụ DK-05) nằm trong [requirements.md](./requirements.md). Luồng dữ liệu từng chức năng nằm trong
[mo-hinh-hoa/so-do-luong-du-lieu.md](./mo-hinh-hoa/so-do-luong-du-lieu.md). Lý do của các quyết định lớn nằm trong
[adr/](./adr/).

## Vấn đề

Trường cần quản lý việc đăng ký học phần và thu học phí cho sinh viên. Hiện mỗi bên gặp một vấn đề riêng.

**Sinh viên:**

- Phải tự dò xem lớp nào còn chỗ, lớp nào trùng lịch và mình đã đủ điều kiện tiên quyết chưa. Thường chỉ biết mình
  sai khi Phòng Đào tạo huỷ đăng ký sau đợt.
- Trong đợt đăng ký, cả nghìn người cùng giành chỗ một lúc. Hệ thống cũ có lúc nhận quá sĩ số, nhận hai lần cùng một
  môn, hoặc treo.
- Không biết chính xác mình còn nợ bao nhiêu, vì sao phải đóng số đó, và tiền chuyển khoản đã được ghi nhận hay chưa.

**Phòng Đào tạo:**

- Thời khoá biểu học kỳ đã soạn sẵn trên tệp Excel nhưng phải gõ lại từng lớp, từng buổi vào hệ thống đăng ký.
- Không có công cụ quản lý mốc thời gian của học kỳ và khung giờ đăng ký theo khoá.
- Sửa khoá, hệ đào tạo hay đối tượng ưu tiên của sinh viên giữa đợt thì phải báo Phòng Tài vụ tính lại học phí bằng
  tay.

**Phòng Tài vụ:**

- Phải đối chiếu từng giao dịch chuyển khoản với sinh viên bằng mắt.
- Tự tính phụ thu học lại và học hè, tự tính giảm trừ cho đối tượng ưu tiên.
- Lập báo cáo sinh viên chưa đóng học phí bằng tay.
- Số liệu công nợ bị ghi đè khi sửa, nên mất dấu vết.

## Giải pháp

Một ứng dụng web cho ba vai trò, phục vụ đúng ba nghiệp vụ: sinh viên đăng ký học phần, Phòng Đào tạo quản lý đăng
ký học phần, Phòng Tài vụ quản lý đóng học phí.

- **Sinh viên**
  - Đăng ký và huỷ lớp trên điện thoại trong đợt đăng ký.
  - Mỗi lần thao tác biết ngay kết quả và lý do nếu bị từ chối.
  - Hệ thống bảo đảm không bao giờ vượt sĩ số, vượt tín chỉ tối đa, trùng lịch hay trùng môn, dù tải cao đến đâu.
  - Xem công nợ học phí tách theo từng khoản và quét mã VietQR để chuyển khoản. Tiền về tự động được ghi nhận, có
    phiếu thu, và có email báo khi đã đóng đủ.
- **Phòng Đào tạo**
  - Quản lý hồ sơ sinh viên tối giản (chỉ những gì việc đăng ký và tính học phí cần) cùng tài khoản sinh viên, đối
    tượng ưu tiên và khoá tuyển sinh.
  - Sửa mốc thời gian của học kỳ, khung giờ đăng ký theo khoá và giới hạn tín chỉ.
  - Nhập cả thời khoá biểu học kỳ từ tệp Excel theo mẫu của trường. Sau đó điều chỉnh từng lớp trong giới hạn của
    giai đoạn.
  - Giai đoạn học kỳ tự chuyển theo mốc thời gian, phiếu tự chốt khi hết Điều chỉnh.
- **Phòng Tài vụ**
  - Khai báo đơn giá, bảng phí theo (khoá, hệ đào tạo) và tài khoản nhận học phí.
  - Mọi khoản tiền nằm trong một sổ cái chỉ ghi thêm, do hệ thống sinh theo quy tắc. Không ai ghi đè số liệu.
  - Giao dịch SePay tự khớp theo mã thanh toán. Giao dịch không khớp vào hàng chờ gán thủ công.
  - Báo cáo BM7 luôn khớp với sổ cái.

**Dữ liệu nền** được nạp sẵn khi cài đặt, hệ thống chỉ đọc (HS-09, ADR-0019): hệ đào tạo, năm học và học kỳ, danh
mục môn học, môn tương đương, điều kiện tiên quyết, giảng viên, phòng học, môn đã học và điểm học phần của sinh viên,
tài khoản Phòng Đào tạo và Phòng Tài vụ. Hệ thống chỉ đọc điểm để xét tiên quyết và hình thức học, không nhập, không
tính và không hiển thị bảng điểm (ADR-0018).

## Câu chuyện người dùng

### Mọi vai trò

1. Là người dùng, tôi muốn đăng nhập bằng mã số sinh viên hoặc mã cán bộ và mật khẩu, để vào đúng các chức năng của
   vai trò mình.
2. Là người dùng, tôi muốn bị buộc đổi mật khẩu ở lần đăng nhập đầu và sau khi được đặt lại mật khẩu, để mật khẩu do
   người khác cấp không còn dùng được.
3. Là người dùng, tôi muốn tự đổi mật khẩu bất cứ lúc nào, để giữ an toàn tài khoản.
4. Là người dùng, tôi muốn phiên đăng nhập tự hết hạn sau 8 giờ, để máy dùng chung không giữ tài khoản của tôi quá lâu.
5. Là người dùng, tôi muốn một thông báo chung khi đăng nhập sai, để kẻ khác không dò được mã số nào có tồn tại.
6. Là người dùng, tôi muốn hệ thống tạm chặn khi có quá nhiều lần đăng nhập sai, để tài khoản không bị dò mật khẩu.
7. Là cán bộ giữ nhiều vai trò, ví dụ vừa thuộc Phòng Đào tạo vừa thuộc Phòng Tài vụ, tôi muốn dùng một tài khoản cho
   mọi vai trò, để không phải nhớ nhiều mật khẩu.
8. Là người dùng, tôi muốn giao diện hoàn toàn bằng tiếng Việt, để không phải đoán nghĩa thuật ngữ.

### Sinh viên: đăng ký học phần

9. Là sinh viên, tôi muốn xem danh sách lớp học phần mở trong học kỳ: môn, loại môn, số tín chỉ của môn mở, giảng
   viên (nếu đã phân công), lịch học, ngôn ngữ giảng dạy và số chỗ còn, để chọn lớp phù hợp.
10. Là sinh viên, tôi muốn lọc lớp theo mã hoặc tên môn, thứ trong tuần, loại môn và khoá dành cho, để tìm nhanh trong
    danh sách dài.
11. Là sinh viên, tôi muốn chỉ thấy và chỉ đăng ký được lớp cùng hệ đào tạo với mình, để không chọn nhầm lớp của hệ
    khác.
12. Là sinh viên, tôi muốn số chỗ còn tự cập nhật khoảng 5 giây một lần, để không phải tải lại trang khi đang giành chỗ.
13. Là sinh viên, tôi muốn đăng ký một lớp bằng một lần bấm và biết ngay kết quả, để không phải chờ duyệt.
14. Là sinh viên, tôi muốn được báo đúng lý do đầu tiên khi bị từ chối, để biết phải sửa gì. Các lý do theo thứ tự
    kiểm tra: ngoài đợt hoặc ngoài khung giờ, môn không mở, khác hệ đào tạo, trùng môn, sai lớp cha của nhóm thực
    hành, thiếu tiên quyết, trùng lịch, vượt tín chỉ, hết chỗ.
15. Là sinh viên, tôi muốn chỉ được đăng ký trong khung giờ dành cho khoá của mình ở giai đoạn Đăng ký, để việc giành
    chỗ công bằng giữa các khoá.
16. Là sinh viên, tôi muốn ở giai đoạn Điều chỉnh được đăng ký bất cứ lúc nào, để sửa lại phiếu sau đợt chính.
17. Là sinh viên, tôi muốn hệ thống chặn việc đăng ký cùng một môn, hoặc môn tương đương, hai lần trong một học kỳ, để
    không phải đóng tiền thừa.
18. Là sinh viên, tôi muốn hệ thống kiểm tra môn tiên quyết và môn học trước theo điểm đã có, tính cả môn tương đương,
    để không học môn mình chưa đủ nền.
19. Là sinh viên đang học môn tiên quyết ở học kỳ trước nhưng chưa có điểm, tôi muốn được đăng ký có điều kiện, để
    không bị lỡ lớp chỉ vì điểm ra muộn.
20. Là sinh viên đăng ký có điều kiện, tôi muốn thấy dòng đăng ký chuyển sang đã huỷ trong phiếu khi điểm ra là trượt
    môn tiên quyết lúc đợt đăng ký còn mở, để kịp đăng ký lớp khác.
21. Là sinh viên, tôi muốn hệ thống chặn lớp trùng lịch với lớp đã có trong phiếu, xét theo ngày học thực tế (kể cả
    lớp học cách tuần hay chỉ học nửa học kỳ), để không phải học hai nơi một lúc mà cũng không bị chặn oan.
22. Là sinh viên, tôi muốn hệ thống chặn khi tổng tín chỉ vượt mức tối đa (mặc định 24 ở học kỳ chính, 12 ở học kỳ
    hè), để không quá tải.
23. Là sinh viên, tôi muốn gửi nhiều lớp (cả lớp lý thuyết và nhóm thực hành con) trong một lượt đăng ký và nhận kết
    quả từng lớp, để một lớp đầy không kéo các lớp khác bị từ chối.
24. Là sinh viên đã đạt phần lý thuyết nhưng trượt phần thực hành, tôi muốn được đăng ký riêng nhóm thực hành ở bất kỳ
    lớp lý thuyết nào, để không phải học lại phần đã đạt.
25. Là sinh viên, tôi muốn hệ thống tự xác định hình thức học của từng dòng đăng ký (lần đầu, học lại, cải thiện), để
    tôi không phải khai và phụ thu được tính đúng.
26. Là sinh viên, tôi muốn thấy ngay phụ thu và giảm trừ của dòng vừa đăng ký, để biết chi phí trước khi quyết định
    giữ lớp.
27. Là sinh viên, tôi muốn bấm lại nút đăng ký khi mạng chập chờn mà không bị đăng ký hai lần, để yên tâm thao tác.
28. Là sinh viên, tôi muốn huỷ một lớp trong đợt đăng ký và trả lại chỗ cho người khác ngay, để sửa lựa chọn của mình.
    Muốn sang lớp khác thì tôi huỷ rồi đăng ký lại, không có thao tác đổi lớp.
29. Là sinh viên, tôi muốn huỷ lớp lý thuyết thì nhóm thực hành con cũng bị huỷ, và huỷ nhóm thực hành thì lớp lý
    thuyết cha cũng bị huỷ, để phiếu không còn dòng mồ côi.
30. Là sinh viên, tôi muốn phụ thu của lớp đã huỷ được đảo trong công nợ, để không phải đóng tiền cho lớp không học.
31. Là sinh viên chọn nhóm thực hành, tôi muốn chỉ thấy các nhóm con của lớp lý thuyết mình đang đăng ký, kèm hình
    thức thực hành (HT1 theo lịch, HT2 tự xếp lịch, không có buổi học), để không chọn nhầm nhóm.
32. Là sinh viên học môn thực hành đứng riêng (không có môn lý thuyết đi kèm, ví dụ `CE119`), tôi muốn đăng ký lớp đó
    như lớp thường, để không phải chọn lớp cha nào.
33. Là sinh viên, tôi muốn xem phiếu đăng ký học phần (BM5) và in ra, để có bằng chứng các môn đã đăng ký.
34. Là sinh viên, tôi muốn xem thời khoá biểu dạng lưới tuần, chỉ hiện các buổi có ngày học trong tuần đang xem, để
    biết đúng lịch học từng ngày.
35. Là sinh viên, tôi muốn sau khi hết giai đoạn Điều chỉnh không thể sửa phiếu nữa, để biết danh sách lớp của mình đã
    cố định.
36. Là sinh viên, tôi muốn dùng trang đăng ký thoải mái trên điện thoại rộng 360 px, không cuộn ngang, nút đủ lớn để
    chạm, vì phần lớn sinh viên đăng ký bằng điện thoại.

### Sinh viên: học phí và thanh toán

37. Là sinh viên, tôi muốn xem công nợ của từng học kỳ: số tiền đăng ký, số tiền phải đóng, đã thanh toán và số tiền
    còn lại, để biết chính xác mình nợ bao nhiêu.
38. Là sinh viên, tôi muốn xem từng dòng tạo nên công nợ (học phí cố định, phụ thu, giảm trừ, các dòng đảo, thanh
    toán, số dư chuyển kỳ), để hiểu vì sao có con số đó.
39. Là sinh viên thuộc đối tượng ưu tiên, tôi muốn được giảm trừ tự động theo tỉ lệ của đối tượng có độ ưu tiên cao
    nhất của mình, để không phải làm đơn.
40. Là sinh viên, tôi muốn thấy hạn đóng học phí, để đóng đúng hạn.
41. Là sinh viên còn nợ, tôi muốn quét mã VietQR có sẵn số tài khoản, số tiền còn lại và nội dung chuyển khoản, để
    chuyển tiền không cần gõ tay.
42. Là sinh viên, tôi muốn có nút lưu ảnh QR và nút sao chép số tài khoản, số tiền và nội dung chuyển khoản, để dùng với
    ứng dụng ngân hàng trên cùng điện thoại.
43. Là sinh viên, tôi muốn chuyển khoản xong thì công nợ tự cập nhật và có phiếu thu, để không phải mang biên lai lên
    phòng Tài vụ.
44. Là sinh viên, tôi muốn được đóng nhiều lần cho một học kỳ, để chia nhỏ khoản phải đóng.
45. Là sinh viên chuyển thiếu, tôi muốn số đã chuyển vẫn được ghi nhận và mã QR tiếp theo hiện phần còn lại, để đóng
    bù dễ dàng.
46. Là sinh viên chuyển thừa, tôi muốn phần dư thành số dư có và tự trừ vào học kỳ sau, để không mất tiền.
47. Là sinh viên, tôi muốn nhận email khi đã đóng đủ học phí của học kỳ, dù đóng qua chuyển khoản hay tại quầy, để
    biết chắc mình không còn nợ.
48. Là sinh viên, tôi muốn xem danh sách phiếu thu (BM6) của mình và in từng phiếu, để lưu chứng từ.
49. Là sinh viên chuyển khoản trước hạn nhưng tiền về hệ thống trễ, tôi muốn phiếu thu ghi thời điểm ngân hàng ghi
    nhận, để có bằng chứng mình đóng đúng hạn.

### Phòng Đào tạo: hồ sơ và tài khoản sinh viên

50. Là Phòng Đào tạo, tôi muốn lập hồ sơ sinh viên gồm mã số sinh viên, họ tên, email, khoá tuyển sinh, hệ đào tạo và
    đối tượng ưu tiên (có thể không có), để sinh viên có mặt trong hệ thống với đủ thông tin đăng ký và tính học phí.
51. Là Phòng Đào tạo, tôi muốn mã số sinh viên là duy nhất và không sửa được sau khi tạo, để mã thanh toán và lịch sử
    đăng ký luôn trỏ đúng một người.
52. Là Phòng Đào tạo, tôi muốn lập hồ sơ thì tài khoản sinh viên được tạo luôn với mật khẩu ngẫu nhiên hiện một lần
    duy nhất cho tôi, để sinh viên đăng nhập được ngay mà mật khẩu không nằm lại ở đâu.
53. Là Phòng Đào tạo, tôi muốn đặt lại mật khẩu cho sinh viên quên mật khẩu: mật khẩu mới hiện một lần, mọi phiên
    đăng nhập cũ của sinh viên bị đăng xuất ngay, để xử lý cả trường hợp lộ mật khẩu.
54. Là Phòng Đào tạo, tôi muốn gán nhiều đối tượng ưu tiên cho một sinh viên, để hệ thống tự chọn đối tượng có độ ưu
    tiên cao nhất khi tính giảm trừ.
55. Là Phòng Đào tạo, tôi muốn sửa họ tên, email, khoá, hệ đào tạo và đối tượng ưu tiên của sinh viên, để sửa sai sót
    lúc nhập.
56. Là Phòng Đào tạo, tôi muốn sửa khoá, hệ đào tạo hoặc đối tượng ưu tiên trong đợt đăng ký thì học phí của học kỳ đó
    tự tính lại theo hồ sơ mới, còn sửa ngoài đợt thì chỉ áp từ học kỳ sau, để không phải nhờ Phòng Tài vụ sửa tay.
57. Là Phòng Đào tạo, tôi muốn các dòng đăng ký sinh viên đã có giữ nguyên khi tôi sửa hệ đào tạo, để sửa hồ sơ không
    làm sinh viên mất lớp.
58. Là Phòng Đào tạo, tôi muốn chỉ xoá được hồ sơ của sinh viên chưa có phiếu đăng ký và chưa có dòng sổ cái, và xoá
    hồ sơ thì xoá luôn tài khoản, để nhập sai mã thì xoá rồi tạo lại mà không làm mất lịch sử tiền.
59. Là Phòng Đào tạo, tôi muốn thêm, sửa, xoá đối tượng ưu tiên (tỉ lệ giảm, độ ưu tiên), không xoá được đối tượng
    đang có sinh viên, và sửa tỉ lệ chỉ áp cho khoản nợ phát sinh sau đó, để giữ đúng công nợ cũ.
60. Là Phòng Đào tạo, tôi muốn thêm, sửa, xoá khoá tuyển sinh, không xoá được khoá đang có sinh viên, bảng phí hoặc
    khung giờ, để hồ sơ và bảng phí không mất tham chiếu.

### Phòng Đào tạo: học kỳ và đợt đăng ký

61. Là Phòng Đào tạo, tôi muốn sửa năm mốc thời gian của học kỳ (bắt đầu và kết thúc Đăng ký, bắt đầu và kết thúc
    Điều chỉnh, hạn đóng học phí) và hệ thống kiểm tra thứ tự các mốc, để không lập lịch sai.
62. Là Phòng Đào tạo, tôi muốn mốc đã qua thì không sửa được, và khoảng đã bắt đầu thì chỉ sửa được ngày kết thúc,
    để không đổi lại thứ đã xảy ra với sinh viên.
63. Là Phòng Đào tạo, tôi muốn gia hạn đóng học phí của học kỳ khi hạn cũ chưa qua, để sinh viên có thêm thời gian
    đóng.
64. Là Phòng Đào tạo, tôi muốn giai đoạn học kỳ tự chuyển theo mốc thời gian (Chuẩn bị → Đăng ký → Điều chỉnh → Đang
    học), để không phải bấm tay đúng giờ.
65. Là Phòng Đào tạo, tôi muốn hệ thống không cho hai học kỳ cùng mở đăng ký, để sinh viên không nhầm học kỳ.
66. Là Phòng Đào tạo, tôi muốn thêm, sửa, xoá khung giờ đăng ký và gán khoá cho từng khung, theo cùng luật thời gian
    của mốc học kỳ, để giảm tải lúc mở cổng và ưu tiên khoá sắp tốt nghiệp.
67. Là Phòng Đào tạo, tôi muốn đổi giới hạn tín chỉ (tối thiểu, tối đa học kỳ chính, tối đa học kỳ hè), và giá trị mới
    chỉ áp cho học kỳ chưa mở đăng ký, để không đổi luật giữa đợt.
68. Là Phòng Đào tạo, tôi muốn phiếu đăng ký tự chốt khi hết giai đoạn Điều chỉnh, để danh sách lớp cố định đúng hạn.
69. Là Phòng Đào tạo, tôi muốn nhận danh sách sinh viên có phiếu dưới mức tín chỉ tối thiểu sau khi chốt, để liên hệ
    nhắc nhở.
70. Là Phòng Đào tạo, tôi muốn hệ thống xét lại hằng ngày các đăng ký có điều kiện khi điểm môn tiên quyết đã có:
    trượt mà phiếu còn trong đợt thì tự huỷ, phiếu đã chốt thì giữ nguyên, để không phải dò tay từng sinh viên.

### Phòng Đào tạo: thời khoá biểu và lớp học phần

71. Là Phòng Đào tạo, tôi muốn nhập thời khoá biểu học kỳ (BM4) từ tệp Excel theo mẫu của trường, và một lần nhập tạo
    đủ môn mở, lớp học phần, nhóm thực hành và buổi học, để không phải gõ lại từng lớp.
72. Là Phòng Đào tạo, tôi muốn chỉ nhập được thời khoá biểu khi học kỳ còn ở giai đoạn Chuẩn bị, và nhập lại thì thay
    toàn bộ bản cũ, để sửa tệp rồi nhập lại mà không phải xoá tay.
73. Là Phòng Đào tạo, tôi muốn tệp có lỗi ở bất kỳ dòng nào thì không dòng nào được ghi, và nhận báo cáo lỗi theo dòng
    và cột, để sửa tệp rồi nhập lại mà không phải dọn dữ liệu dở dang.
74. Là Phòng Đào tạo, tôi muốn tệp thời khoá biểu có mã môn, mã giảng viên, mã phòng hay hệ đào tạo không có trong dữ
    liệu nền thì bị báo lỗi theo dòng thay vì tự tạo mục mới, để dữ liệu nền không bị rác vì gõ nhầm.
75. Là Phòng Đào tạo, tôi muốn dòng thực hành (`<mã lớp LT>.n`) tự vào môn thực hành đi kèm của môn lý thuyết, dù tệp
    ghi mã môn lý thuyết, và lớp có bao nhiêu nhóm `.n` cũng được, mỗi nhóm có sĩ số riêng, để khớp đúng tệp của
    trường.
76. Là Phòng Đào tạo, tôi muốn số tín chỉ của môn mở lấy từ cột tín chỉ của tệp (trống thì lấy tín chỉ mặc định của
    môn, cho phép 0), để môn đổi số tín chỉ theo học kỳ mà không cần sửa danh mục môn học.
77. Là Phòng Đào tạo, tôi muốn sửa tín chỉ của một môn mở khi học kỳ còn ở giai đoạn Chuẩn bị, để chỉnh nhanh mà không
    phải nhập lại cả tệp.
78. Là Phòng Đào tạo, tôi muốn mỗi dòng có lịch tạo một buổi học với thứ, tiết, phòng, ngày bắt đầu, ngày kết thúc và
    nhịp mỗi tuần hoặc cách tuần, còn dòng ghi `*` thì không có buổi học, để lịch trong hệ thống đúng như tệp.
79. Là Phòng Đào tạo, tôi muốn khoá dành cho, ngôn ngữ giảng dạy và ghi chú của từng lớp được lưu để hiển thị và lọc,
    để sinh viên dễ tìm lớp của khoá mình.
80. Là Phòng Đào tạo, tôi muốn được cảnh báo khi lớp trùng phòng hoặc trùng giảng viên với lớp khác nhưng vẫn nhập
    được, để tự quyết trong các trường hợp đặc biệt.
81. Là Phòng Đào tạo, tôi muốn ở giai đoạn Chuẩn bị được thêm, sửa, xoá lớp, nhóm thực hành và buổi học tự do, để chỉnh
    nhanh sau khi nhập tệp.
82. Là Phòng Đào tạo, tôi muốn từ giai đoạn Đăng ký trở đi chỉ sửa được sĩ số (không thấp hơn số đã đăng ký) và điền
    giảng viên hay phòng còn trống, để không làm hỏng phiếu của sinh viên đã đăng ký.
83. Là Phòng Đào tạo, tôi muốn xem danh sách sinh viên của từng lớp (BB01) và xuất ra Excel, để gửi giảng viên và các
    phòng liên quan.

### Phòng Tài vụ

84. Là Phòng Tài vụ, tôi muốn đổi đơn giá tín chỉ mặc định (lý thuyết, thực hành), để bảng phí mới lập lấy đúng giá.
85. Là Phòng Tài vụ, tôi muốn khai báo bảng phí cho từng khoá và hệ đào tạo: học phí cố định mỗi học kỳ chính, đơn giá
    tín chỉ lý thuyết và thực hành, để học phí tính đúng cho từng nhóm sinh viên.
86. Là Phòng Tài vụ, tôi muốn đổi tài khoản nhận học phí, để mã QR và webhook dùng đúng tài khoản ngân hàng hiện hành.
87. Là Phòng Tài vụ, tôi muốn học phí cố định tự ghi nợ khi học kỳ chính vào giai đoạn Đăng ký, kèm giảm trừ theo đối
    tượng ưu tiên, để không phải lập công nợ bằng tay.
88. Là Phòng Tài vụ, tôi muốn phụ thu học lại, cải thiện và học hè tự tính theo tín chỉ của môn mở và đơn giá đã chốt
    lúc đăng ký, để đổi bảng phí sau đó không làm sai số đã thu.
89. Là Phòng Tài vụ, tôi muốn tỉ lệ giảm được chốt vào từng khoản lúc ghi nợ, để đổi tỉ lệ của đối tượng ưu tiên về
    sau không âm thầm làm thay đổi công nợ cũ.
90. Là Phòng Tài vụ, tôi muốn lập phiếu thu tại quầy (BM6) và in ngay, để thu tiền mặt.
91. Là Phòng Tài vụ, tôi muốn bấm lập phiếu hai lần do mạng lag mà không thu trùng, để sổ sách không lệch.
92. Là Phòng Tài vụ, tôi muốn giao dịch SePay có đúng mã thanh toán (`HP` + mã số sinh viên + mã học kỳ) tự ghi nhận
    đúng số tiền thực nhận, để không phải đối chiếu bằng mắt.
93. Là Phòng Tài vụ, tôi muốn webhook gửi lại nhiều lần vẫn chỉ sinh một phiếu thu, để không ghi nhận tiền hai lần.
94. Là Phòng Tài vụ, tôi muốn webhook bị từ chối nếu sai khoá API, không phải tiền vào, hoặc không đúng tài khoản nhận
    học phí, để kẻ xấu không giả được thanh toán.
95. Là Phòng Tài vụ, tôi muốn giao dịch sai hoặc thiếu mã thanh toán vào hàng chờ, nơi tôi gán cho đúng sinh viên và
    học kỳ hoặc đánh dấu bỏ qua, để không có khoản tiền nào bị bỏ sót.
96. Là Phòng Tài vụ, tôi muốn hệ thống đối soát hằng ngày với SePay, tự ghi bù giao dịch webhook bỏ sót và cho tôi xem
    các chỗ lệch còn lại, để sổ sách luôn khớp ngân hàng.
97. Là Phòng Tài vụ, tôi muốn số dư có của học kỳ trước tự chuyển sang học kỳ sau, để sinh viên đóng thừa được trừ
    đúng.
98. Là Phòng Tài vụ, tôi muốn mọi dòng sổ cái do hệ thống sinh theo quy tắc, ngoài phiếu thu tại quầy, và không có
    thao tác sửa, xoá hay ghi tuỳ ý, để công nợ luôn truy ngược được về nguồn gốc.
99. Là Phòng Tài vụ, tôi muốn lập báo cáo sinh viên chưa hoàn thành học phí (BM7) theo học kỳ và xuất Excel hoặc PDF,
    để báo cáo lãnh đạo và gửi các phòng xử lý sinh viên còn nợ.
100. Là Phòng Tài vụ, tôi muốn ba con số của BM7 luôn tính lại từ sổ cái, để báo cáo không bao giờ lệch với phiếu thu.
101. Là Phòng Tài vụ, tôi muốn các thao tác tài chính có thêm bảo vệ CSRF, để không bị lừa bấm lập phiếu thu từ trang
     khác.

### Yêu cầu chung của hệ thống

102. Là nhà trường, tôi muốn hệ thống chịu được 1000 người dùng đồng thời trong đợt đăng ký với p95 dưới 500 ms và
     không lỗi 5xx, để đợt đăng ký không sập.
103. Là nhà trường, tôi muốn mọi thao tác ghi được lưu vào nhật ký kiểm toán chỉ ghi thêm (ai, vai trò, lúc nào, dữ
     liệu vào, kết quả), để truy vết khi có sự cố.
104. Là nhà trường, tôi muốn sự kiện quan trọng (thanh toán ghi nhận, email đóng đủ) không bao giờ mất khi tiến trình
     chết, và gửi email lỗi không ảnh hưởng việc ghi sổ, để không có sinh viên nào bị bỏ sót xử lý.
105. Là nhà trường, tôi muốn log JSON có request id và correlation id, cùng metrics cho Prometheus và dashboard
     Grafana, để chẩn đoán sự cố.

## Quyết định triển khai

### Kiến trúc

- **Modular monolith NestJS** (ADR-0007). Mỗi miền là một module và sở hữu nhóm bảng riêng:
  - `identity`: tài khoản, vai trò, đăng nhập, đổi và đặt lại mật khẩu, session.
  - `students`: hồ sơ sinh viên, đối tượng ưu tiên, khoá tuyển sinh. Tạo hồ sơ gọi `identity` tạo tài khoản trong
    cùng transaction; sửa hồ sơ gọi `tuition` tính lại học phí.
  - `academics`: đọc dữ liệu nền (hệ, môn, tiên quyết, giảng viên, phòng); học kỳ, khung giờ, giới hạn tín chỉ; thời
    khoá biểu (môn mở, lớp, buổi học) và bộ nhập thời khoá biểu.
  - `registration`: phiếu, dòng đăng ký, lần học; đọc điểm học phần và kết quả hiện hành (ADR-0018).
  - `tuition`: đơn giá, bảng phí, tài khoản nhận, sổ cái, thanh toán, SePay, đối soát.
  - `notification` (email đóng đủ), `audit`.

  Module chỉ gọi nhau qua service, command hoặc query được export. Transaction xuyên module vẫn là một transaction
  Postgres. Worker dùng cùng codebase, chạy bằng entrypoint khác.
- **Dữ liệu nền** (ADR-0019) nạp bằng seed. Không có command thêm, sửa, xoá cho các bảng này.
- **Ghi và đọc tách nhau (CQRS mức 1, ADR-0008).**
  - Thao tác ghi đi qua `CommandBus`, domain logic và transaction. Một interceptor ghi nhật ký kiểm toán cho mọi
    command.
  - Thao tác đọc đi qua `QueryBus`, đọc thẳng SQL trên cùng database, không có read model riêng.
  - Sự kiện quan trọng ghi vào bảng outbox trong cùng transaction. Một relay đẩy sang BullMQ (ADR-0010). Consumer phải
    idempotent.
- **Hạ tầng:** Postgres là nguồn sự thật duy nhất. Redis giữ session, cache ngắn hạn, khoá chống lặp và hàng đợi
  (ADR-0006).
- **Next.js chỉ làm frontend** (ADR-0012), gọi API của NestJS.
- **Truy cập dữ liệu:** Prisma, với TypedSQL cho các truy vấn phức tạp (ADR-0009).
- **Công cụ:** Bun và Turborepo (ADR-0015).
- **Đặt tên:** mọi tên trong code bằng tiếng Anh, theo cột tên tiếng Anh trong CONTEXT.md (ADR-0014).

### Các module sâu (logic thuần, giao diện nhỏ, ít đổi)

Các module dưới đây gói nhiều quy tắc sau một giao diện hẹp. Chúng không phụ thuộc database, nên test cô lập được:

- **Bộ sinh ngày học.** Vào: ngày bắt đầu, ngày kết thúc, nhịp (mỗi tuần hoặc cách tuần). Ra: tập ngày học của buổi
  (DT-09).
- **Bộ kiểm tra trùng lịch.** Vào: hai tập buổi học. Ra: có trùng hay không. Hai buổi trùng khi cùng thứ, khoảng tiết
  giao nhau và có ít nhất một ngày học chung. Lớp không có buổi học không bao giờ trùng. Dùng chung cho đăng ký
  (DK-07) và cảnh báo trùng phòng, trùng giảng viên (DT-10).
- **Bộ đọc thời khoá biểu.** Vào: các dòng của tệp Excel và ảnh chụp dữ liệu nền (môn, giảng viên, phòng, hệ). Ra: kế
  hoạch thay thế gồm môn mở, lớp, nhóm thực hành và buổi học, hoặc danh sách lỗi theo dòng và cột. Gói các luật đọc
  cột của TKB-03 đến TKB-07: ghép dòng `.n` vào môn TH đi kèm, tín chỉ theo môn mở, `*` là không có buổi, quy KHOÁ
  HỌC về năm nhập học, tách sĩ số. Không ghi database; command nhập chỉ áp kế hoạch trong một transaction.
- **Bộ kết quả hiện hành.** Vào: các lần học của sinh viên kèm điểm (có thể chưa có), nhóm tương đương, ngưỡng Đạt.
  Ra: kết quả hiện hành từng môn: Đạt, Không đạt hoặc chưa có kết quả (KQ-02 đến KQ-04). Dùng cho tiên quyết và hình
  thức học.
- **Bộ suy ra hình thức học.** Vào: kết quả hiện hành của môn. Ra: lần đầu, học lại hoặc cải thiện (DK-16).
- **Bộ tính phí đăng ký.** Vào: hình thức học, loại học kỳ, tín chỉ của môn mở, đơn giá đã chốt, tỉ lệ giảm. Ra: phụ
  thu và giảm trừ, làm tròn xuống tới đồng (HP-03, HP-06).
- **Bộ tính lại học phí.** Vào: các dòng nợ và giảm trừ hiện có của sinh viên trong học kỳ, các dòng đăng ký còn hiệu
  lực, bảng phí và tỉ lệ giảm theo hồ sơ mới. Ra: các dòng đảo và các dòng ghi lại (HP-12). Thanh toán không bị đụng.
- **Bộ tổng hợp công nợ.** Vào: các dòng sổ cái của một sinh viên trong một học kỳ. Ra: số tiền đăng ký, phải đóng,
  đã thanh toán và còn lại (HP-09). Dùng chung cho trang công nợ, QR, BM7 và quyết định gửi email đóng đủ.
- **Bộ mã thanh toán.** Lập và tách mã `HP` + mã số sinh viên + mã học kỳ (TT-02). Trả "không khớp" khi nội dung chuyển
  khoản không đúng dạng.
- **Chính sách đăng ký.** Vào: ảnh chụp trạng thái đã đọc trong transaction (học kỳ, khung giờ, hệ đào tạo của sinh
  viên, phiếu, môn, tiên quyết, lịch). Ra: lỗi đầu tiên theo thứ tự DK-10, hoặc quyết định chấp nhận kèm cờ có điều
  kiện và hình thức học. Bước giành chỗ không nằm trong module này, mà là bước SQL cuối cùng của command.
- **Chính sách điều chỉnh lớp.** Vào: giai đoạn học kỳ, lớp hiện tại, số đã đăng ký và thay đổi đề xuất. Ra: cho phép
  hoặc lỗi (LHP-01, LHP-02).
- **Chính sách sửa mốc thời gian.** Vào: các mốc hiện tại, mốc đề xuất và thời điểm hiện tại. Ra: cho phép hoặc lỗi
  (HK-02, HK-06, HK-07). Dùng chung cho mốc học kỳ, hạn đóng và khung giờ.
- **Máy trạng thái giai đoạn học kỳ.** Vào: các mốc và thời điểm hiện tại. Ra: giai đoạn đích. Không cho chuyển ngược
  (HK-02, HK-03).

### Đồng thời khi đăng ký (ADR-0005)

- Mỗi lớp trong một lượt đăng ký, và mỗi command huỷ, chạy trong một transaction riêng (DK-18), gồm các bước:
  1. Khoá hàng phiếu đăng ký của sinh viên bằng `SELECT … FOR UPDATE` để tuần tự hoá thao tác của cùng một sinh viên.
  2. Chạy chính sách đăng ký.
  3. Giành chỗ cuối cùng bằng một câu UPDATE có điều kiện "số đã đăng ký < sĩ số tối đa".
- Giành chỗ chỉ đụng một lớp. Huỷ hai chiều (DK-11) đụng hai lớp, nên khoá các lớp theo id tăng dần để không
  deadlock.
- Bất biến được giữ thêm bằng ràng buộc trong database:
  - CHECK "số đã đăng ký" nằm trong đoạn [0; sĩ số tối đa];
  - partial unique index một môn mỗi phiếu, không tính dòng đã huỷ.
- Sửa sĩ số từ giai đoạn Đăng ký trở đi (LHP-02) dùng cùng khoá hàng lớp với giành chỗ, nên không hạ sĩ số xuống dưới
  số đã đăng ký được.
- Khoá chống lặp lưu trong Redis 24 giờ.
- Transaction đăng ký có timeout 5 giây và maxWait 2 giây.

### Thời khoá biểu (ADR-0002, ADR-0017)

- Nhập thời khoá biểu là một command duy nhất: xoá toàn bộ thời khoá biểu cũ của học kỳ rồi ghi kế hoạch mới trong cùng
  transaction. Chỉ chạy khi học kỳ ở `PREPARATION`, nên chưa có dòng đăng ký nào trỏ tới lớp cũ.
- Tín chỉ nằm trên môn mở (môn, học kỳ), không nằm trên lớp. Mọi dòng của cùng một môn trong tệp phải cùng tín chỉ.
- Lớp học phần có 0..n buổi học. Giảng viên và phòng có thể trống.

### Hồ sơ sinh viên và tính lại học phí (ADR-0019)

- Tạo hồ sơ và tài khoản trong cùng transaction. Mật khẩu ngẫu nhiên chỉ trả về trong response của command, không lưu
  bản rõ ở đâu.
- Sửa khoá, hệ hoặc đối tượng ưu tiên khi học kỳ đang ở `REGISTRATION` hoặc `ADJUSTMENT`: trong cùng transaction với
  việc sửa hồ sơ, ghi dòng đảo cho mọi khoản nợ và giảm trừ của sinh viên trong học kỳ đó, rồi ghi lại theo hồ sơ mới.
  Thanh toán và học kỳ trước giữ nguyên.
- Xoá hồ sơ chỉ khi không có phiếu và không có dòng sổ cái; xoá luôn tài khoản và mọi session.

### Học phí và sổ cái (ADR-0003, ADR-0004)

- **Mô hình học phí lai:** học phí cố định mỗi học kỳ chính theo khoá và hệ đào tạo, cộng phụ thu theo tín chỉ cho
  học lại, cải thiện và học hè.
- **Sổ cái chỉ ghi thêm.** Trigger chặn UPDATE và DELETE. Các loại dòng: học phí cố định, đảo học phí cố định, phụ thu,
  đảo phụ thu, giảm trừ, đảo giảm trừ, thanh toán, chuyển số dư ra, chuyển số dư vào. Không có dòng điều chỉnh hay
  hoàn tiền (HP-13).
- Mọi con số công nợ đều tính từ sổ cái, không lưu sẵn.
- Số tín chỉ, đơn giá và tỉ lệ giảm được chốt vào dòng đăng ký và dòng sổ cái lúc ghi.

### Thanh toán (ADR-0011)

- Không lưu "yêu cầu thanh toán". Mã QR sinh lại mỗi lần xem, với số tiền bằng số còn lại.
- Webhook SePay xử lý theo các bước:
  1. Kiểm tra khoá API, `transferType = in` và tài khoản nhận.
  2. Lưu giao dịch với id SePay duy nhất.
  3. Trả 200 ngay.
- Worker ghi nhận thanh toán theo số thực nhận. Phiếu thu lấy thời điểm giao dịch ngân hàng làm thời điểm đóng.
- Trạng thái giao dịch: chờ xử lý, đã khớp, chưa khớp, bỏ qua.
- Đối soát hằng ngày gọi API SePay, tự ghi bù giao dịch bỏ sót, lưu các chỗ lệch còn lại để Phòng Tài vụ xem.
- **Email đóng đủ (TT-10):** mọi nơi ghi thanh toán (webhook, thu tại quầy, gán thủ công, đối soát ghi bù) kiểm tra
  số tiền còn lại trong cùng transaction; nếu chuyển từ > 0 về ≤ 0 thì ghi sự kiện vào outbox. Consumer gửi email tới
  địa chỉ trong hồ sơ. Lỗi giữa lúc gửi và lúc lưu trạng thái có thể gửi trùng một email; chấp nhận được.

### Job định kỳ (ADR-0010)

- Chuyển giai đoạn học kỳ theo mốc, chạy mỗi phút: ghi nợ học phí cố định khi học kỳ chính vào Đăng ký, chuyển số dư
  có từ học kỳ trước, chốt phiếu khi hết Điều chỉnh. Mỗi bước dùng UPDATE có điều kiện trên giai đoạn để không chạy
  hai lần.
- Đối soát SePay hằng ngày.
- Xét lại đăng ký có điều kiện hằng ngày: với mỗi dòng có điều kiện mà điểm môn tiên quyết đã có và là Không đạt,
  nếu phiếu còn trong đợt thì tự huỷ (trả chỗ, đảo phụ thu), đã chốt thì giữ nguyên. Không gửi thông báo. Idempotent:
  dòng đã xử lý không bị xử lý lại.

### Xác thực (ADR-0013)

- Session opaque lưu Redis. Cookie `httpOnly; Secure; SameSite=Lax`, hết hạn tuyệt đối sau 8 giờ.
- Không dùng JWT, không SSO.
- Đặt lại mật khẩu hoặc xoá hồ sơ thì xoá mọi session của tài khoản đó.
- Mật khẩu băm argon2id.

### Giao diện

- Giao diện sinh viên mobile-first: rộng từ 360 px, không cuộn ngang, vùng chạm ≥ 44 px.
- Trang đăng ký polling khoảng 5 giây. Danh sách lớp và số chỗ còn được cache 3 giây.
- Giao diện nhân viên desktop-first nhưng dùng được trên di động. Bảng rộng cuộn ngang trong khung riêng.
- Màn hình nhập thời khoá biểu hiện bảng lỗi theo dòng và cột, cùng danh sách cảnh báo trùng phòng và trùng giảng viên.
- Mật khẩu ngẫu nhiên khi tạo hồ sơ hoặc đặt lại hiện trong hộp thoại một lần, có nút sao chép.

### Tham số và thay đổi qui định

- Bảy tham số đổi được trên giao diện, mỗi tham số thuộc một phòng:

  | # | Tham số | Mặc định | Người đổi |
  |---|---|---|---|
  | 1 | Đối tượng ưu tiên (tỉ lệ giảm, độ ưu tiên) | theo seed | Phòng Đào tạo |
  | 2 | Tín chỉ của môn mở | theo thời khoá biểu | Phòng Đào tạo |
  | 3 | Đơn giá tín chỉ LT / TH | 27.000đ / 37.000đ | Phòng Tài vụ |
  | 4 | Bảng phí của (khoá, hệ) | theo seed | Phòng Tài vụ |
  | 5 | Hạn đóng học phí của học kỳ | theo học kỳ | Phòng Đào tạo |
  | 6 | Giới hạn tín chỉ | 14 / 24 học kỳ chính, 12 học kỳ hè | Phòng Đào tạo |
  | 7 | Tài khoản nhận học phí | theo seed | Phòng Tài vụ |

- Ngưỡng Đạt (mặc định 5,0) và tham số kỹ thuật là cấu hình triển khai (biến môi trường hoặc seed), không đổi trên
  giao diện.
- Mọi thay đổi qui định không hồi tố. Giá trị cần giữ được chép vào học kỳ, dòng đăng ký hoặc dòng sổ cái lúc ghi.
- Chi tiết 7 yêu cầu thay đổi qui định nằm trong
  [mo-hinh-hoa/thay-doi-qui-dinh.md](./mo-hinh-hoa/thay-doi-qui-dinh.md).

## Quyết định kiểm thử

### Thế nào là test tốt

- Test hành vi nhìn thấy từ bên ngoài, qua giao diện công khai của module hoặc qua `CommandBus` và `QueryBus`. Không
  test chi tiết cài đặt như tên hàm private hay thứ tự câu SQL.
- Mỗi quy tắc trong requirements có ít nhất một test, và tên test ghi mã quy tắc, ví dụ
  `it('DK-09: rejects when section is full')`. Có thể viết script kiểm tra mọi mã quy tắc đều có test.
- Không đặt mục tiêu % coverage (ADR-0016).

### Các tầng test

- **Unit test** (`bun test`) cho các module sâu kể trên:
  - sinh ngày học và trùng lịch;
  - đọc thời khoá biểu (dùng các dòng mẫu cắt từ tệp thật của trường: dòng HT2 có `*`, dòng `.n`, môn TH đứng riêng,
    KHOÁ HỌC `16` và `0`, sĩ số `120(0)`);
  - kết quả hiện hành và hình thức học;
  - phụ thu và giảm trừ;
  - tính lại học phí;
  - tổng hợp công nợ;
  - mã thanh toán;
  - chính sách đăng ký;
  - chính sách điều chỉnh lớp;
  - chính sách sửa mốc thời gian;
  - máy trạng thái học kỳ.

  Đây là nơi phủ phần lớn quy tắc DK, TKB, KQ, HK, HP và TT.
- **Integration test** trên Postgres và Redis thật (dựng bằng compose cho test), gọi qua `CommandBus` thật. Không mock
  database, vì phải kiểm được khoá hàng, unique index, CHECK và trigger chỉ ghi thêm. Các luồng bắt buộc có:
  - tạo hồ sơ tạo luôn tài khoản; xoá hồ sơ bị chặn khi đã có phiếu hoặc dòng sổ cái;
  - sửa hệ đào tạo trong đợt → đảo và ghi lại học phí, thanh toán giữ nguyên, dòng đăng ký giữ nguyên;
  - thanh toán làm số còn lại về 0 → đúng một sự kiện email trong outbox.
- **Test tranh chấp, bắt buộc trong CI:**
  - 200 sinh viên giành lớp 50 chỗ → đúng 50 dòng đăng ký và số đã đăng ký = 50.
  - Một sinh viên gửi 10 request song song → không vượt tín chỉ, không trùng lịch, không trùng môn.
  - Nhiều sinh viên cùng lúc huỷ hai chiều, người huỷ lớp lý thuyết, người huỷ nhóm thực hành → không deadlock.
  - Một lượt 5 lớp có một lớp đầy → các lớp còn lại vẫn vào.
  - Phòng Đào tạo hạ sĩ số trong lúc sinh viên giành chỗ → sĩ số không bao giờ thấp hơn số đã đăng ký.
  - Cùng một webhook SePay gửi 5 lần → đúng một phiếu thu.
- **E2E Playwright** cho các luồng chính, có viewport di động:
  - đăng nhập → đăng ký → thấy trong phiếu;
  - xem công nợ và QR;
  - Phòng Đào tạo tạo hồ sơ → sinh viên đăng nhập bằng mật khẩu ngẫu nhiên và bị buộc đổi mật khẩu;
  - Phòng Đào tạo nhập tệp thời khoá biểu → lớp hiện trong danh sách đăng ký;
  - Phòng Tài vụ thu tại quầy và xuất BM7.
- **Load test k6** 1000 VU trước mỗi lần release: p95 < 500 ms, 0 lỗi 5xx, và 0 vi phạm bất biến (kiểm tra bằng SQL
  sau khi chạy).

### Mẫu có sẵn trong repo

- Test controller health dùng `bun:test` với `Test.createTestingModule` của NestJS. Đây là mẫu cho test có dựng module
  Nest.
- Dữ liệu seed dev tất định, dựng quanh thời điểm hiện tại (đợt đăng ký luôn đang mở). Có thể dùng lại các kịch bản
  demo của seed làm fixture cho integration test và E2E. Dữ liệu nền, gồm điểm học phần mẫu, cũng nạp bằng seed
  (ADR-0018, ADR-0019).

## Ngoài phạm vi

- Hồ sơ sinh viên đầy đủ: ngày sinh, giới tính, quê quán (Tỉnh, Huyện), Khoa, Ngành, trạng thái sinh viên, bảo lưu,
  thôi học, đổi ngành. Sinh viên có hồ sơ được coi là đang học.
- Quản lý dữ liệu nền: thêm, sửa, xoá hệ đào tạo, năm học, học kỳ, môn học (BM2), môn tương đương, tiên quyết,
  giảng viên, phòng học.
- Chương trình học (BM3), học kỳ gợi ý, tiến độ chương trình, môn tự do.
- Nhập hàng loạt từ CSV/Excel, trừ thời khoá biểu học kỳ (BM4).
- Vai trò Quản trị, quản lý tài khoản nhân viên, tham số vận hành trên giao diện.
- Quản lý điểm: nhập điểm, bảng điểm, GPA, tín chỉ tích lũy, xếp loại. Cách đưa điểm vào hệ thống cũng nằm ngoài
  phạm vi (ADR-0018).
- Khoản điều chỉnh công nợ, huỷ phiếu thu, hoàn tiền. Sai sót công nợ sửa ngoài hệ thống.
- Thông báo trong ứng dụng và SMS. Thông báo duy nhất là email đóng đủ.
- Cấm thi. Phòng khảo thí làm ngoài hệ thống, dựa trên báo cáo BM7.
- Giảng viên dùng hệ thống. Giảng viên chỉ là mã và tên để hiển thị trên lớp.
- Chuyển học kỳ từ Đang học sang Kết thúc.
- Xét tốt nghiệp, cấp bằng.
- Rút môn sau khi chốt phiếu.
- Danh sách chờ khi lớp đầy.
- Đổi lớp trong một thao tác. Sinh viên huỷ rồi đăng ký lại.
- Môn song hành.
- Tự động xếp thời khoá biểu và phòng học, lịch thi, đánh giá giảng viên.
- Đa ngôn ngữ (chỉ tiếng Việt), ứng dụng di động native.
- SSO và đăng nhập qua bên thứ ba.

## Ghi chú thêm

### Giả định đang dùng

1. Mật khẩu ban đầu và mật khẩu đặt lại của sinh viên: chuỗi ngẫu nhiên hiện một lần cho Phòng Đào tạo, Phòng Đào
   tạo tự giao cho sinh viên. Hệ thống không gửi mật khẩu qua email.
2. Thời điểm chuyển số dư có sang học kỳ sau: khi học kỳ sau vào giai đoạn Đăng ký.
3. Đăng ký có điều kiện được xét lại bằng job hằng ngày, không theo sự kiện, vì điểm đến từ dữ liệu nền.
4. Bảng phí tính theo cặp (khoá, hệ đào tạo). Học kỳ chính vào Đăng ký mà thiếu bảng phí của một cặp đang có sinh viên
   thì chuyển giai đoạn thất bại, học kỳ ở lại Chuẩn bị cho tới khi Phòng Tài vụ bổ sung.
5. Giới hạn tín chỉ mới được chép vào các học kỳ đang ở Chuẩn bị; học kỳ đã mở đăng ký giữ giá trị cũ.
6. Tín chỉ của môn mở chỉ sửa trực tiếp được ở giai đoạn Chuẩn bị.

### Điểm requirements chưa rõ

1. Ngưỡng Đạt chưa được chốt theo học kỳ, nên đổi cấu hình ngưỡng sẽ có hiệu lực hồi tố lên kết quả hiện hành khi xét
   tiên quyết và hình thức học.
2. Độ ưu tiên của đối tượng ưu tiên chưa có ràng buộc duy nhất, nên "đối tượng cao nhất" có thể không xác định khi hai
   đối tượng cùng độ ưu tiên.
3. Sửa hồ sơ ngoài đợt đăng ký "chỉ áp từ học kỳ sau", nhưng học phí cố định của học kỳ đang học đã ghi nợ theo hồ sơ
   cũ; nếu hồ sơ cũ sai thì phần chênh phải xử lý ngoài hệ thống (HP-13).

### Liên hệ với các ticket đã có

Hệ thống đã được chia thành 37 lát cắt dọc trên GitHub (#1–#37, nhãn `ready-for-agent`). Mỗi lát cắt hiện thực một
nhóm câu chuyện người dùng ở trên. Ví dụ:

- #11–#16 phủ đăng ký.
- #25–#32 phủ học phí và thanh toán.

Các lát cắt viết trước ADR-0017, ADR-0018 và ADR-0019 cần đối chiếu lại với PRD này. Đã ra khỏi phạm vi: điểm và kết
quả học tập, cấm thi, màn hình giảng viên, quản trị, danh mục và chương trình học, trạng thái sinh viên, khoản điều
chỉnh, hoàn tiền, thông báo trong ứng dụng. Mở lớp thủ công thay bằng nhập thời khoá biểu.

PRD này là tài liệu gốc để đối chiếu phạm vi của các lát cắt đó.
