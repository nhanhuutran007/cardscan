# CardScan KYC — Demo phỏng vấn Thực tập sinh CNTT

Ứng dụng số hóa **danh thiếp** bằng **OCR**, tự bóc tách thông tin, kiểm tra **KYC** và xuất dữ liệu sang
**Google Sheets / AppSheet**. Bám sát mô tả công việc: name card · OCR · KYC · AppSheet · JavaScript · Python · thiết kế web.

| Yêu cầu trong JD | Thể hiện trong demo |
|---|---|
| Xử lý, chỉnh sửa thông tin danh thiếp | Form chỉnh sửa sau OCR, sửa/xóa hồ sơ đã lưu |
| Vận hành & tối ưu OCR | Tesseract.js (Việt + Anh), tiền xử lý ảnh (xám, tăng tương phản, Otsu), chọn chế độ bố cục (PSM) |
| KYC: kiểm tra, xác thực, đối chiếu | Kiểm tra trường bắt buộc, định dạng SĐT VN/email, đối chiếu tên miền email ↔ website, phát hiện trùng |
| AppSheet, tự động hóa | Xuất CSV đúng chuẩn → Google Sheets → AppSheet |
| Xử lý lỗi dữ liệu | `kyc_check.py` làm sạch & báo cáo lỗi hàng loạt |
| JavaScript, Python, Thiết kế web | `index.html` (HTML/CSS/JS thuần, responsive, dark mode) + `kyc_check.py` |

## Cấu trúc

```
index.html           Ứng dụng web (một file duy nhất)
kyc_check.py         Script Python: chuẩn hóa, kiểm tra KYC, phát hiện trùng, xuất file sạch
sample_contacts.csv  Dữ liệu mẫu có cố ý chèn lỗi để demo script Python
```

## Cách chạy

```bash
# Web app (cần Internet ở lần đầu để tải Tesseract.js + dữ liệu tiếng Việt)
python -m http.server 8765
# mở http://localhost:8765

# Script Python (chỉ dùng thư viện chuẩn)
python kyc_check.py sample_contacts.csv
```

> **Trước buổi phỏng vấn:** mở app và chạy OCR một lần để trình duyệt cache mô hình tiếng Việt.
> Mang theo 2–3 danh thiếp thật. Nếu mất mạng: dán văn bản vào ô "Văn bản thô" → "Bóc tách lại" vẫn chạy được.

## Kịch bản demo (~5 phút)

1. **Giới thiệu bài toán (30s):** "Công ty nhận nhiều danh thiếp, nhập tay thì chậm và dễ sai. Em làm công cụ số hóa + kiểm tra dữ liệu trước khi đưa vào AppSheet."
2. **Danh thiếp mẫu → Chạy OCR (1 phút):** nói về tiền xử lý ảnh và vì sao chọn PSM 4 (danh thiếp có nhiều cỡ chữ; chế độ mặc định bỏ sót dòng tên in to).
   **Với ảnh chụp thật (thẻ nghiêng, có nền bàn):** chạy OCR ngay sẽ gần như không ra gì. Bấm **✂ Làm thẳng thẻ**,
   chọn 4 góc theo thứ tự trên-trái → trên-phải → dưới-phải → dưới-trái (theo chiều đọc chữ), rồi chạy OCR.
   Kể lại được "trước/sau" là điểm cộng lớn: *biến đổi phối cảnh (homography) giải hệ 8 phương trình, nội suy bilinear*.
3. **Bóc tách + KYC (1 phút):** chỉ ra các trường tự điền, sửa tay một lỗi dấu, KYC cập nhật ngay khi gõ.
4. **Thẻ thứ 3 (Gmail):** KYC báo "Cần xác minh" vì email cá nhân, đúng tinh thần đối chiếu hồ sơ.
5. **Quét lại thẻ cũ:** hệ thống cảnh báo **trùng lặp**.
6. **Quét danh thiếp thật** nhà tuyển dụng đưa (ấn tượng nhất!).
7. **Xuất CSV → Python:** chạy `kyc_check.py` để thấy báo cáo lỗi hàng loạt và file `_cleaned.csv`.
8. **Kết nối AppSheet:** trình bày các bước bên dưới (hoặc làm sẵn app AppSheet để mở cho xem).

## Đưa dữ liệu vào AppSheet

1. Google Sheets → *Tệp > Nhập* → tải `khach_hang.csv` (hoặc `*_cleaned.csv`).
2. *Tiện ích mở rộng > AppSheet > Tạo ứng dụng*. AppSheet tự nhận các cột `HoTen`, `SoDienThoai`, `Email`...
3. Trong AppSheet: đặt `ID` làm Key; kiểu cột `SoDienThoai` = Phone, `Email` = Email, `TrangThaiKYC` = Enum (Đạt / Cần xác minh / Không đạt).
4. Thêm cột `AnhDanhThiep` kiểu **Image** để nhân viên chụp thẻ ngay trên điện thoại.
5. Tạo **Slice** "Cần xác minh" + **Automation (Bot)** gửi email nhắc người phụ trách khi có hồ sơ mới cần xác minh.

## Câu hỏi có thể gặp & gợi ý trả lời

- **Vì sao OCR chạy trên trình duyệt?** Ảnh danh thiếp là dữ liệu cá nhân, xử lý tại máy nên không gửi lên server, không tốn chi phí API.
- **OCR sai thì sao?** Có nhiều lớp: làm thẳng thẻ bằng biến đổi phối cảnh, tiền xử lý ảnh, tự thử nhiều chế độ PSM và giữ kết quả tốt nhất,
  so khớp từ khóa không phân biệt dấu (chịu được "Giám đóc"), lọc ký tự rác do icon ☎ ✉ 📍, khôi phục email khi OCR đọc `@` thành `l`
  (dựa vào tên miền website trên cùng thẻ), và cuối cùng là bước người kiểm tra lại trước khi lưu.
- **Vì sao không tự động tìm 4 góc?** Có thể làm bằng OpenCV.js (phát hiện cạnh + contour), nhưng chọn tay 4 góc ổn định hơn với nền phức tạp. Đây là hướng cải tiến tiếp theo.
- **Bóc tách trường bằng cách nào?** Regex cho email/SĐT/website, từ khóa cho công ty/chức danh/địa chỉ, chấm điểm heuristic cho họ tên.
- **Nếu làm tiếp sẽ cải thiện gì?** Google Cloud Vision / Document AI cho độ chính xác cao hơn; dùng LLM để bóc tách trường; Apps Script ghi thẳng vào Sheets thay vì xuất CSV; đối chiếu mã số thuế công ty với cổng thông tin doanh nghiệp.
- **Hạn chế hiện tại?** Danh thiếp bố cục phức tạp, chữ nghệ thuật, nền tối thì OCR kém hơn; dữ liệu lưu ở localStorage (chỉ phục vụ demo).
