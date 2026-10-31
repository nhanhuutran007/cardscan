/**
 * CardScan KYC → Google Sheets
 *
 * Nhận hồ sơ khách hàng từ CardScan và ghi vào trang tính "KhachHang".
 * Hồ sơ đã có (trùng ID) được cập nhật, hồ sơ mới được thêm vào cuối.
 * Google Sheets này dùng làm nguồn dữ liệu cho ứng dụng AppSheet.
 *
 * Cài đặt:
 *   1. Mở Google Sheets → Tiện ích mở rộng → Apps Script, dán toàn bộ mã này.
 *      (Hoặc tạo dự án mới tại script.google.com và điền SPREADSHEET_ID bên dưới.)
 *   2. Đổi TOKEN bên dưới thành mã bí mật của bạn → Lưu.
 *   3. Triển khai → Tùy chọn triển khai mới → Ứng dụng web
 *        Thực thi dưới dạng: Tôi · Người có quyền truy cập: Bất kỳ ai
 *   4. Dán URL ứng dụng web (.../exec) và TOKEN vào CardScan › Tích hợp AppSheet.
 *
 * Nhận dạng bằng AI (tùy chọn):
 *   Lấy khóa API miễn phí tại https://aistudio.google.com/apikey
 *   Cài đặt dự án (biểu tượng bánh răng) → Thuộc tính tập lệnh → Thêm:
 *        GEMINI_API_KEY = <khóa API>
 *        GEMINI_MODEL   = gemini-flash-lite-latest   (không bắt buộc)
 *   Sau đó Triển khai → Quản lý các bản triển khai → Chỉnh sửa → Phiên bản mới.
 */

const TOKEN = 'doi-ma-bao-mat-nay';   // phải trùng với "Mã bảo mật" nhập trong CardScan
const SHEET_NAME = 'KhachHang';

// Để trống nếu mở Apps Script từ trong Google Sheets (Tiện ích mở rộng → Apps Script).
// Nếu tạo dự án riêng tại script.google.com: dán ID trang tính, là đoạn giữa /d/ và /edit
// trong đường dẫn: https://docs.google.com/spreadsheets/d/<SPREADSHEET_ID>/edit
const SPREADSHEET_ID = '';
const spreadsheet_ = () => SPREADSHEET_ID ? SpreadsheetApp.openById(SPREADSHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();

const COLUMNS = ['ID', 'HoTen', 'ChucDanh', 'CongTy', 'SoDienThoai', 'Email', 'Website',
                 'DiaChi', 'GhiChu', 'TrangThaiKYC', 'NgayTao', 'CapNhatLuc', 'AnhDanhThiep'];
const DATE_COLUMNS = ['NgayTao', 'CapNhatLuc'];
// Các cột chỉ được sửa trong AppSheet, CardScan không ghi đè
const APPSHEET_ONLY = ['AnhDanhThiep'];

// Mọi lỗi bên trong (thiếu quyền, lỗi Sheets...) đều trả về JSON để CardScan hiển thị rõ nguyên nhân,
// thay vì trang lỗi HTML của Google (trình duyệt sẽ chỉ báo "không gọi được Apps Script").
function doGet(e) { return safe_(() => handleGet_(e)); }
function doPost(e) { return safe_(() => handlePost_(e)); }
function safe_(fn) {
  try {
    return fn();
  } catch (err) {
    const msg = String((err && err.message) || err);
    const hint = /permission|quyền|authoriz/i.test(msg)
      ? ' — mở Apps Script, chọn hàm kiemTraGemini và bấm Chạy để cấp quyền' : '';
    return json_({ ok: false, error: 'Lỗi Apps Script: ' + msg + hint });
  }
}

/**
 * Chạy hàm này MỘT LẦN trong trình soạn thảo Apps Script (chọn kiemTraGemini → bấm Chạy):
 *   - Google hỏi cấp quyền "kết nối với dịch vụ bên ngoài" (cần để gọi Gemini)
 *   - Kiểm tra GEMINI_API_KEY và model, kết quả xem ở "Nhật ký thực thi"
 */
function kiemTraGemini() {
  const key = prop_('GEMINI_API_KEY');
  if (!key) throw new Error('Chưa có thuộc tính GEMINI_API_KEY (Cài đặt dự án → Thuộc tính tập lệnh)');
  const model = prop_('GEMINI_MODEL') || GEMINI_DEFAULT_MODEL;
  const res = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model),
    { headers: { 'x-goog-api-key': key }, muteHttpExceptions: true });
  const data = JSON.parse(res.getContentText() || '{}');
  if (res.getResponseCode() !== 200) {
    throw new Error('Gemini báo lỗi: ' + ((data.error && data.error.message) || ('HTTP ' + res.getResponseCode())));
  }
  Logger.log('OK — khóa Gemini hợp lệ, model: ' + (data.displayName || data.name));
  Logger.log('Nhớ triển khai lại: Triển khai → Quản lý các bản triển khai → Chỉnh sửa → Phiên bản mới.');
}

/** Kiểm tra kết nối: GET .../exec?token=... */
function handleGet_(e) {
  const p = (e && e.parameter) || {};
  if (p.token !== TOKEN) return json_({ ok: false, error: 'Sai mã bảo mật' });
  const sheet = getSheet_();
  return json_({
    ok: true,
    spreadsheet: spreadsheet_().getName(),
    sheet: SHEET_NAME,
    rows: Math.max(0, sheet.getLastRow() - 1),
    ai: !!prop_('GEMINI_API_KEY')
  });
}

/**
 * POST { token, records: [...] }                       → đồng bộ hồ sơ
 * POST { token, action: 'ocr', image: <base64>, mime } → nhận dạng danh thiếp bằng Gemini
 */
function handlePost_(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, error: 'Dữ liệu gửi lên không hợp lệ' });
  }
  if (body.token !== TOKEN) return json_({ ok: false, error: 'Sai mã bảo mật' });
  if (body.action === 'ocr') return json_(recognizeCard_(body));
  const records = Array.isArray(body.records) ? body.records : [];

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);                       // tránh 2 thiết bị ghi cùng lúc
  try {
    const sheet = getSheet_();
    const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
    const idCol = header.indexOf('ID');
    const lastRow = sheet.getLastRow();
    const data = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, header.length).getValues() : [];

    const rowById = {};
    data.forEach((row, i) => { if (row[idCol]) rowById[row[idCol]] = i; });

    const now = new Date();
    let added = 0, updated = 0;
    records.forEach(rec => {
      if (!rec || !rec.ID) return;
      const values = Object.assign({}, rec, { CapNhatLuc: now });
      if (values.NgayTao) values.NgayTao = new Date(values.NgayTao);

      const idx = rowById[rec.ID];
      const row = idx !== undefined ? data[idx] : header.map(() => '');
      header.forEach((h, c) => {
        if (h in values && APPSHEET_ONLY.indexOf(h) < 0) row[c] = values[h];
      });
      if (idx !== undefined) {
        updated++;
      } else {
        rowById[rec.ID] = data.length;
        data.push(row);
        added++;
      }
    });

    if (data.length) sheet.getRange(2, 1, data.length, header.length).setValues(data);
    return json_({ ok: true, added: added, updated: updated, total: data.length });
  } finally {
    lock.releaseLock();
  }
}

/** Lấy (hoặc tạo) trang tính, đảm bảo đủ cột và định dạng */
function getSheet_() {
  const ss = spreadsheet_();
  const sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, COLUMNS.length).setValues([COLUMNS]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  // Thêm các cột còn thiếu (khi trang tính được tạo thủ công trước đó)
  let header = sheet.getRange(1, 1, 1, Math.max(1, sheet.getLastColumn())).getValues()[0].map(String);
  COLUMNS.forEach(name => {
    if (header.indexOf(name) < 0) {
      sheet.getRange(1, header.length + 1).setValue(name).setFontWeight('bold');
      header.push(name);
    }
  });

  // Cột văn bản để dạng "Văn bản thuần": giữ số 0 đầu SĐT, không biến "+84..." hay "=..." thành công thức
  const rows = sheet.getMaxRows() - 1;
  if (rows > 0) {
    header.forEach((name, c) => {
      const fmt = DATE_COLUMNS.indexOf(name) >= 0 ? 'yyyy-mm-dd hh:mm:ss' : '@';
      sheet.getRange(2, c + 1, rows, 1).setNumberFormat(fmt);
    });
  }
  return sheet;
}

/* ===================== Nhận dạng danh thiếp bằng Gemini ===================== */

const GEMINI_DEFAULT_MODEL = 'gemini-flash-lite-latest';   // bản Flash-Lite mới nhất: nhanh (~2 giây), đủ chính xác cho danh thiếp

const CARD_SCHEMA = {
  type: 'OBJECT',
  properties: {
    name:    { type: 'STRING' },
    title:   { type: 'STRING' },
    company: { type: 'STRING' },
    phones:  { type: 'ARRAY', items: { type: 'STRING' } },
    email:   { type: 'STRING' },
    website: { type: 'STRING' },
    address: { type: 'STRING' },
    text:    { type: 'STRING' }
  },
  required: ['name', 'title', 'company', 'phones', 'email', 'website', 'address', 'text']
};

const CARD_PROMPT = [
  'Bạn là công cụ trích xuất thông tin từ ảnh danh thiếp. Trả về JSON theo schema.',
  'Quy tắc:',
  '- name: họ tên đầy đủ của NGƯỜI trên thẻ, giữ nguyên dấu tiếng Việt như in. Nếu thẻ không có tên người (thẻ cửa hàng, thẻ công ty) thì để chuỗi rỗng, không dùng tên thương hiệu.',
  '- title: chức danh của người đó.',
  '- company: tên công ty / cửa hàng / thương hiệu đầy đủ như in trên thẻ.',
  '- phones: tất cả số điện thoại theo thứ tự xuất hiện, giữ nguyên cách viết trên thẻ (kể cả mã quốc gia). Không lấy số fax.',
  '- email, website: viết thường; website không thêm http://.',
  '- address: địa chỉ đầy đủ, gộp thành một dòng.',
  '- text: toàn bộ chữ đọc được trên thẻ, mỗi dòng của thẻ là một dòng.',
  '- Chỉ ghi thông tin có trên thẻ, không suy đoán. Trường không có thì để chuỗi rỗng hoặc mảng rỗng.',
  '- Nếu ảnh có nhiều thẻ, chỉ đọc thẻ rõ nhất ở giữa ảnh.'
].join('\n');

function recognizeCard_(body) {
  const key = prop_('GEMINI_API_KEY');
  if (!key) return { ok: false, error: 'Chưa cấu hình GEMINI_API_KEY trong Apps Script' };
  if (!body.image) return { ok: false, error: 'Thiếu ảnh danh thiếp' };
  const model = prop_('GEMINI_MODEL') || GEMINI_DEFAULT_MODEL;

  const request = {
    contents: [{
      role: 'user',
      parts: [
        { inlineData: { mimeType: body.mime || 'image/jpeg', data: body.image } },
        { text: CARD_PROMPT }
      ]
    }],
    generationConfig: { responseMimeType: 'application/json', responseSchema: CARD_SCHEMA }
  };
  const res = UrlFetchApp.fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent',
    {
      method: 'post',
      contentType: 'application/json',
      headers: { 'x-goog-api-key': key },
      payload: JSON.stringify(request),
      muteHttpExceptions: true
    });

  const code = res.getResponseCode();
  let data = {};
  try { data = JSON.parse(res.getContentText()); } catch (err) {}
  if (code !== 200) {
    return { ok: false, error: 'Gemini: ' + ((data.error && data.error.message) || ('HTTP ' + code)) };
  }
  const cand = data.candidates && data.candidates[0];
  const parts = (cand && cand.content && cand.content.parts) || [];
  const text = parts.map(p => p.text || '').join('');
  if (!text) {
    return { ok: false, error: 'Gemini không trả về kết quả' + (cand && cand.finishReason ? ' (' + cand.finishReason + ')' : '') };
  }
  let fields;
  try { fields = JSON.parse(text); } catch (err) {
    return { ok: false, error: 'Kết quả AI không đúng định dạng' };
  }
  return { ok: true, model: data.modelVersion || model, fields: fields };
}

function prop_(name) {
  return PropertiesService.getScriptProperties().getProperty(name);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
