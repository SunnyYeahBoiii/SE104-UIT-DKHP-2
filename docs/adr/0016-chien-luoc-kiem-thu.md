# 0016. Chiến lược kiểm thử

- Trạng thái: accepted
- Ngày: 2026-09-30
- Nguồn: phiên grill 2026-09-30, câu 35

## Bối cảnh

Rủi ro lớn nhất nằm ở tính đúng dưới tranh chấp và ở tiền. Cả hai đều không bắt được bằng unit test có mock DB. Tỉ
lệ coverage không nói lên việc từng quy tắc nghiệp vụ đã được kiểm tra hay chưa.

## Quyết định

- **Unit test** (`bun test`) cho logic miền thuần: suy ra hình thức học, kết quả hiện hành, GPA, xếp loại, trùng lịch, tính phụ thu và giảm trừ.
- **Integration test** (`bun test`) trên Postgres và Redis thật, dựng bằng `compose.test.yml`, gọi qua `CommandBus` thật.
- **Test tranh chấp bắt buộc trong CI:**
  - 200 sinh viên giành lớp 50 chỗ → đúng 50 dòng đăng ký, `enrolled_count = 50`.
  - Một sinh viên gửi 10 request song song → không vượt tín chỉ tối đa, không trùng lịch, không trùng môn.
  - Đổi lớp chéo A→B và B→A cùng lúc → không deadlock, bất biến giữ nguyên.
  - Cùng một webhook SePay gửi 5 lần → đúng 1 phiếu thu.
- **Load test k6** 1000 VU trước mỗi lần release: p95 < 500 ms, 0 lỗi 5xx, 0 vi phạm bất biến (kiểm tra bằng SQL sau khi chạy).
- **E2E Playwright** cho các luồng chính, có viewport di động.
- Không đặt mục tiêu % coverage. **Mọi quy tắc trong [requirements.md](../requirements.md) phải có ít nhất một test ghi mã quy tắc** (ví dụ `it('DK-09: rejects when section is full')`).

## Hệ quả

- CI cần Docker để dựng Postgres và Redis, nên chậm hơn unit test thuần nhưng bắt được lỗi thật.
- Có thể viết script kiểm tra mọi mã quy tắc trong requirements đều xuất hiện trong ít nhất một file test.

## Phương án đã cân nhắc

- **Mock DB cho integration:** nhanh, nhưng không kiểm được khoá hàng, unique index hay CHECK.
- **Mục tiêu 80% coverage:** dễ đo, nhưng không đảm bảo quy tắc quan trọng được kiểm.
