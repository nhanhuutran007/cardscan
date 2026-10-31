/**
 * CardScan KYC → Google Sheets
 *
 * Nhận hồ sơ khách hàng từ CardScan và ghi vào trang tính "KhachHang".
 * Hồ sơ đã có (trùng ID) được cập nhật, hồ sơ mới được thêm vào cuối.
 * Google Sheets này dùng làm nguồn dữ liệu cho ứng dụng AppSheet.
 *
 * Cài đặt:
 *   1. Mở Google Sheets → Tiện ích mở rộng → Apps Script, dán toàn bộ mã này.
 *   2. Đổi TOKEN bên dưới thành mã bí mật của bạn → Lưu.
 *   3. Triển khai → Tùy chọn triển khai mới → Ứng dụng web
 *        Thực thi dưới dạng: Tôi · Người có quyền truy cập: Bất kỳ ai
 *   4. Dán URL ứng dụng web (.../exec) và TOKEN vào CardScan › Tích hợp AppSheet.
 */

const TOKEN = 'doi-ma-bao-mat-nay';   // phải trùng với "Mã bảo mật" nhập trong CardScan
const SHEET_NAME = 'KhachHang';

const COLUMNS = ['ID', 'HoTen', 'ChucDanh', 'CongTy', 'SoDienThoai', 'Email', 'Website',
                 'DiaChi', 'GhiChu', 'TrangThaiKYC', 'NgayTao', 'CapNhatLuc', 'AnhDanhThiep'];
const DATE_COLUMNS = ['NgayTao', 'CapNhatLuc'];
// Các cột chỉ được sửa trong AppSheet, CardScan không ghi đè
const APPSHEET_ONLY = ['AnhDanhThiep'];

/** Kiểm tra kết nối: GET .../exec?token=... */
function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.token !== TOKEN) return json_({ ok: false, error: 'Sai mã bảo mật' });
  const sheet = getSheet_();
  return json_({
    ok: true,
    spreadsheet: SpreadsheetApp.getActiveSpreadsheet().getName(),
    sheet: SHEET_NAME,
    rows: Math.max(0, sheet.getLastRow() - 1)
  });
}

/** Đồng bộ: POST { token, records: [{ ID, HoTen, ... }] } */
function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, error: 'Dữ liệu gửi lên không hợp lệ' });
  }
  if (body.token !== TOKEN) return json_({ ok: false, error: 'Sai mã bảo mật' });
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
  const ss = SpreadsheetApp.getActiveSpreadsheet();
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

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
