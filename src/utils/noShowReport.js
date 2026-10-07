import JSZip from "jszip";

// Gelmeme geçmişi ve Excel raporu bu tarihten itibaren takip edilir (dahil).
export const NO_SHOW_TRACKING_START_DATE = "2026-10-07";

export function getYesterday(today) {
  const date = new Date(`${today}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

export function normalizePhone(phone) {
  let digits = String(phone ?? "").replace(/\D/g, "");
  if (digits.startsWith("0090") && digits.length === 14) digits = digits.slice(4);
  else if (digits.startsWith("90") && digits.length === 12) digits = digits.slice(2);
  else if (digits.startsWith("0") && digits.length === 11) digits = digits.slice(1);
  return digits;
}

export function groupNoShows(reservations, today) {
  const groups = new Map();
  for (const r of reservations) {
    const date = String(r.reservation_date ?? "").slice(0, 10);
    if (r.arrived !== false || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date < NO_SHOW_TRACKING_START_DATE || date >= today) continue;
    const phone = normalizePhone(r.phone);
    // Missing contact details must not merge unrelated customers.
    const key = phone || `missing:${r.id}`;
    if (!groups.has(key)) groups.set(key, { key, fullName: r.full_name, phone: phone || "Telefon bilgisi yok", count: 0, lastDate: "", dates: [] });
    const person = groups.get(key);
    person.count += 1;
    person.dates.push(date);
    if (date >= person.lastDate) {
      person.lastDate = date;
      person.fullName = r.full_name || person.fullName;
    }
  }
  return [...groups.values()].map((person) => ({ ...person, dates: person.dates.sort().reverse() }))
    .sort((a, b) => b.lastDate.localeCompare(a.lastDate) || a.phone.localeCompare(b.phone));
}

const escapeXml = (value) => String(value ?? "")
  // XML 1.0 forbids these control characters in spreadsheet text.
  // eslint-disable-next-line no-control-regex
  .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&apos;");

export async function createNoShowWorkbook(people) {
  const rows = [
    ["Ad Soyad", "Telefon", "Gelmeme Sayısı", "Son Gelmediği Tarih", "Gelmediği Tarihler"],
    ...people.map((p) => [p.fullName, p.phone, p.count, p.lastDate, p.dates.join(", ")]),
  ];
  const sheetRows = rows.map((row, i) => `<row r="${i + 1}">${row.map((value, j) => {
    const ref = `${String.fromCharCode(65 + j)}${i + 1}`;
    return typeof value === "number"
      ? `<c r="${ref}"><v>${value}</v></c>`
      : `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
  }).join("")}</row>`).join("");
  const zip = new JSZip();
  zip.file("[Content_Types].xml", '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>');
  zip.file("_rels/.rels", '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
  zip.file("xl/workbook.xml", '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Gelmeme Geçmişi" sheetId="1" r:id="rId1"/></sheets></workbook>');
  zip.file("xl/_rels/workbook.xml.rels", '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>');
  zip.file("xl/worksheets/sheet1.xml", `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols><col min="1" max="2" width="25" customWidth="1"/><col min="3" max="4" width="22" customWidth="1"/><col min="5" max="5" width="60" customWidth="1"/></cols><sheetData>${sheetRows}</sheetData></worksheet>`);
  return zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", compression: "DEFLATE" });
}
