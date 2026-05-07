import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";

const courtsSeed = [
  { id: "salon", name: "Çok Amaçlı Salon / Voleybol" },
  { id: "tenis", name: "Tenis Kortu" },
];

const hours = [
  "07:00", "08:00", "09:00", "10:00", "11:00",
  "12:00", "13:00", "14:00", "15:00", "16:00",
  "17:00", "18:00", "19:00", "20:00", "21:00",
  "22:00", "23:00",
];

const IBAN = "TR67 0001 0020 8888 2519 6250 16";
const ALICI = "Manisa Gençlik ve Spor İl Müdürlüğü";

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function getWeekRange(date = new Date()) {
  const current = new Date(date);
  const day = current.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;

  const monday = new Date(current);
  monday.setDate(current.getDate() + diffToMonday);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return {
    start: monday.toISOString().slice(0, 10),
    end: sunday.toISOString().slice(0, 10),
  };
}

function getMaxTenisDate() {
  const date = new Date();
  date.setDate(date.getDate() + 2);
  return date.toISOString().slice(0, 10);
}

function isDateAllowed(courtId, dateText) {
  const today = getToday();

  if (courtId === "tenis") {
    return dateText >= today && dateText <= getMaxTenisDate();
  }

  if (courtId === "salon") {
    const week = getWeekRange();
    return dateText >= week.start && dateText <= week.end;
  }

  return true;
}

function getTenisDayType(date, time) {
  if (!date || !time) return "";

  const monthDay = date.slice(5);
  const hour = Number(time.slice(0, 2));
  const summer = monthDay >= "06-01" && monthDay <= "10-01";

  if (summer) {
    return hour >= 7 && hour <= 19 ? "gunduz" : "gece";
  }

  return hour >= 8 && hour <= 17 ? "gunduz" : "gece";
}

function App() {
  const [reservations, setReservations] = useState([]);
  const [selectedCourt, setSelectedCourt] = useState("salon");
  const [selectedDate, setSelectedDate] = useState(getToday());
  const [selectedTime, setSelectedTime] = useState("");

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [personCount, setPersonCount] = useState(1);

  const [volleyLicense, setVolleyLicense] = useState("lisanssiz");
  const [tennisCategory, setTennisCategory] = useState("yetiskin");

  const [receiptFile, setReceiptFile] = useState(null);

  const [adminOpen, setAdminOpen] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [adminSelectedDate, setAdminSelectedDate] = useState(getToday());

  const selectedCourtName =
    courtsSeed.find((c) => c.id === selectedCourt)?.name || "";

  const tennisDayType =
    selectedCourt === "tenis" && selectedTime
      ? getTenisDayType(selectedDate, selectedTime)
      : "";

  let unitPrice = 0;
  let category = "";
  let pricingType = "";
  let dayType = "";

  if (selectedCourt === "salon") {
    category = volleyLicense;
    pricingType = volleyLicense === "lisansli" ? "Lisanslı" : "Lisanssız";
    unitPrice = volleyLicense === "lisansli" ? 25 : 48;
  }

  if (selectedCourt === "tenis") {
    category = tennisCategory;
    dayType = tennisDayType;
    pricingType = tennisCategory === "yetiskin" ? "Yetişkin" : "Öğrenci";

    if (tennisCategory === "yetiskin" && tennisDayType === "gunduz") unitPrice = 163;
    if (tennisCategory === "yetiskin" && tennisDayType === "gece") unitPrice = 217;
    if (tennisCategory === "ogrenci" && tennisDayType === "gunduz") unitPrice = 122;
    if (tennisCategory === "ogrenci" && tennisDayType === "gece") unitPrice = 163;
  }

  const totalPrice = Number(personCount || 0) * unitPrice;

  useEffect(() => {
    loadReservations();
  }, []);

  async function loadReservations() {
    const { data, error } = await supabase
      .from("reservations")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      alert("Rezervasyonlar yüklenemedi: " + error.message);
      return;
    }

    setReservations(data || []);
  }

  const reservedTimes = useMemo(() => {
    return reservations
      .filter(
        (r) =>
          r.court_id === selectedCourt &&
          r.reservation_date === selectedDate
      )
      .map((r) => r.reservation_time);
  }, [reservations, selectedCourt, selectedDate]);

  const adminReservations = useMemo(() => {
    return reservations.filter(
      (r) => r.reservation_date === adminSelectedDate
    );
  }, [reservations, adminSelectedDate]);

  function copyIban() {
    navigator.clipboard.writeText(IBAN);
    alert("IBAN kopyalandı.");
  }

  async function openReceipt(path) {
    const { data, error } = await supabase.storage
      .from("dekontlar")
      .createSignedUrl(path, 60);

    if (error) {
      alert("Dekont açılamadı: " + error.message);
      return;
    }

    window.open(data.signedUrl, "_blank");
  }

  async function reserve() {
    if (!isDateAllowed(selectedCourt, selectedDate)) {
      if (selectedCourt === "salon") {
        alert("Çok Amaçlı Salon için sadece içinde bulunulan haftaya rezervasyon yapılabilir.");
      } else {
        alert("Tenis Kortu için sadece bugün, yarın ve sonraki gün rezervasyon yapılabilir.");
      }
      return;
    }

    if (!selectedTime || !name || !phone || !personCount || !receiptFile) {
      alert("Ad soyad, telefon, kişi sayısı, saat seçimi ve dekont zorunludur.");
      return;
    }

    if (reservedTimes.includes(selectedTime)) {
      alert("Bu saat dolu.");
      return;
    }

    const safeFileName = receiptFile.name
      .replaceAll(" ", "-")
      .replace(/[çÇ]/g, "c")
      .replace(/[ğĞ]/g, "g")
      .replace(/[ıİ]/g, "i")
      .replace(/[öÖ]/g, "o")
      .replace(/[şŞ]/g, "s")
      .replace(/[üÜ]/g, "u")
      .replace(/[^a-zA-Z0-9.-]/g, "");

    const filePath = `${selectedDate}/${Date.now()}-${safeFileName}`;

    const uploadResult = await supabase.storage
      .from("dekontlar")
      .upload(filePath, receiptFile);

    if (uploadResult.error) {
      alert("Dekont yüklenemedi: " + uploadResult.error.message);
      return;
    }

    const { error } = await supabase.from("reservations").insert({
      court_id: selectedCourt,
      court_name: selectedCourtName,
      reservation_date: selectedDate,
      reservation_time: selectedTime,
      full_name: name,
      phone,
      person_count: Number(personCount),
      category,
      pricing_type: pricingType,
      day_type: dayType,
      unit_price: unitPrice,
      total_price: totalPrice,
      receipt_url: filePath,
      receipt_name: receiptFile.name,
      is_approved: false,
    });

    if (error) {
      alert("Rezervasyon kaydedilemedi: " + error.message);
      return;
    }

    alert("Rezervasyon oluşturuldu. Dekont yönetici tarafından kontrol edilecektir.");

    setSelectedTime("");
    setName("");
    setPhone("");
    setPersonCount(1);
    setReceiptFile(null);

    loadReservations();
  }

  function loginAdmin() {
    if (adminPassword === "12345.eE") {
      setAdminOpen(true);
      setAdminPassword("");
    } else {
      alert("Yönetici şifresi yanlış.");
    }
  }

  function handleCourtChange(e) {
    const newCourt = e.target.value;
    setSelectedCourt(newCourt);

    if (!isDateAllowed(newCourt, selectedDate)) {
      setSelectedDate(getToday());
      setSelectedTime("");
    }
  }

  return (
    <div style={{ maxWidth: 950, margin: "0 auto", padding: 20, fontFamily: "Arial" }}>
      <h1>Saha & Kort Rezervasyon</h1>

      <div style={{ marginBottom: 20 }}>
        <select value={selectedCourt} onChange={handleCourtChange}>
          {courtsSeed.map((court) => (
            <option key={court.id} value={court.id}>
              {court.name}
            </option>
          ))}
        </select>

        <input
          type="date"
          value={selectedDate}
          min={selectedCourt === "tenis" ? getToday() : getWeekRange().start}
          max={selectedCourt === "tenis" ? getMaxTenisDate() : getWeekRange().end}
          onChange={(e) => {
            setSelectedDate(e.target.value);
            setSelectedTime("");
          }}
          style={{ marginLeft: 10 }}
        />
      </div>

      <p style={{ color: "#555" }}>
        {selectedCourt === "salon"
          ? "Çok Amaçlı Salon için sadece bulunduğunuz hafta içinde rezervasyon yapılabilir."
          : "Tenis Kortu için sadece bugün, yarın ve sonraki gün rezervasyon yapılabilir."}
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 30 }}>
        {hours.map((hour) => {
          const isReserved = reservedTimes.includes(hour);

          return (
            <button
              key={hour}
              disabled={isReserved}
              onClick={() => setSelectedTime(hour)}
              style={{
                padding: 20,
                borderRadius: 10,
                border: "1px solid #ccc",
                background: isReserved ? "#ddd" : selectedTime === hour ? "black" : "white",
                color: selectedTime === hour ? "white" : "black",
                cursor: isReserved ? "not-allowed" : "pointer",
              }}
            >
              <div>{hour}</div>
              <div>{isReserved ? "DOLU" : "BOŞ"}</div>
            </button>
          );
        })}
      </div>

      <div style={{ border: "1px solid #ddd", padding: 20, borderRadius: 10 }}>
        <h2>Rezervasyon Yap</h2>

        <input
          placeholder="Ad Soyad"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ width: "100%", padding: 10, marginBottom: 10 }}
        />

        <input
          placeholder="Telefon Numarası"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          style={{ width: "100%", padding: 10, marginBottom: 10 }}
        />

        <input
          type="number"
          min="1"
          placeholder="Kişi Sayısı"
          value={personCount}
          onChange={(e) => setPersonCount(e.target.value)}
          style={{ width: "100%", padding: 10, marginBottom: 10 }}
        />

        {selectedCourt === "salon" && (
          <div style={{ marginBottom: 15 }}>
            <label style={{ marginRight: 20 }}>
              <input
                type="radio"
                checked={volleyLicense === "lisanssiz"}
                onChange={() => setVolleyLicense("lisanssiz")}
              />
              {" "}Lisanssız kişi başı 48 TL
            </label>

            <label>
              <input
                type="radio"
                checked={volleyLicense === "lisansli"}
                onChange={() => setVolleyLicense("lisansli")}
              />
              {" "}Lisanslı kişi başı 25 TL
            </label>
          </div>
        )}

        {selectedCourt === "tenis" && (
          <div style={{ marginBottom: 15 }}>
            <label style={{ marginRight: 20 }}>
              <input
                type="radio"
                checked={tennisCategory === "yetiskin"}
                onChange={() => setTennisCategory("yetiskin")}
              />
              {" "}Yetişkin
            </label>

            <label>
              <input
                type="radio"
                checked={tennisCategory === "ogrenci"}
                onChange={() => setTennisCategory("ogrenci")}
              />
              {" "}Öğrenci
            </label>

            <p>
              Seçilen saate göre dönem:{" "}
              <strong>{tennisDayType === "gece" ? "Gece" : "Gündüz"}</strong>
            </p>
          </div>
        )}

        <div style={{ background: "#111827", color: "white", padding: 18, borderRadius: 10, marginBottom: 15 }}>
          <h3 style={{ marginTop: 0 }}>Ödeme Bilgileri</h3>

          <p>
            {personCount} kişi x {unitPrice} TL ={" "}
            <strong>{totalPrice} TL</strong>
          </p>

          <p>
            Lütfen toplam <strong>{totalPrice} TL</strong> tutarı aşağıdaki IBAN’a gönderiniz.
          </p>

          <p><strong>Alıcı:</strong> {ALICI}</p>

          <div style={{ background: "#000", padding: 12, borderRadius: 8, fontWeight: "bold", fontSize: 18, letterSpacing: 1, marginBottom: 10 }}>
            {IBAN}
          </div>

          <button onClick={copyIban}>IBAN Kopyala</button>

          <p style={{ fontSize: 14, lineHeight: 1.6 }}>
            Banka açıklama kısmına mutlaka:
            <br />
            <strong>Ad Soyad + Tesis Adı + Tarih + Saat</strong>
            <br />
            bilgilerini yazınız.
          </p>
        </div>

        <label>
          Dekont Yükle:
          <input
            type="file"
            accept="image/*,.pdf"
            onChange={(e) => setReceiptFile(e.target.files[0])}
            style={{ display: "block", marginTop: 8, marginBottom: 15 }}
          />
        </label>

        <button
          onClick={reserve}
          style={{
            padding: 12,
            background: "black",
            color: "white",
            border: "none",
            borderRadius: 8,
            width: "100%",
          }}
        >
          Rezervasyon Yap
        </button>
      </div>

      <div style={{ marginTop: 40 }}>
        <h2>Yönetici Girişi</h2>

        {!adminOpen ? (
          <div>
            <input
              type="password"
              placeholder="Yönetici şifresi"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              style={{ padding: 10, marginRight: 10 }}
            />
            <button onClick={loginAdmin}>Giriş Yap</button>
          </div>
        ) : (
          <div>
            <button onClick={() => setAdminOpen(false)}>
              Yönetici Panelini Kapat
            </button>

            <h2>Yönetici Paneli</h2>

            <div style={{ marginBottom: 20 }}>
              <label>
                Görüntülenecek tarih:{" "}
                <input
                  type="date"
                  value={adminSelectedDate}
                  onChange={(e) => setAdminSelectedDate(e.target.value)}
                  style={{ padding: 10 }}
                />
              </label>
            </div>

            {adminReservations.length === 0 && (
              <p>Seçilen tarihte rezervasyon yok.</p>
            )}

            {adminReservations.map((r) => (
              <div key={r.id} style={{ padding: 12, borderBottom: "1px solid #ddd" }}>
                <strong>{r.reservation_date}</strong> | {r.reservation_time} | {r.court_name}
                <br />
                {r.full_name} | {r.phone}
                <br />
                Kişi: {r.person_count} | {r.pricing_type} |{" "}
                {r.day_type ? r.day_type : "-"} | Tutar: {r.total_price} TL
                <br />
                Dekont: {r.receipt_name}
                <br />
                <button onClick={() => openReceipt(r.receipt_url)}>
                  Dekontu Aç
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;