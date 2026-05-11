import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";
import { courtsSeed, hours, IBAN, ALICI } from "./data/courts";
import {
  getToday,
  getWeekRange,
  getMaxTenisDate,
  isDateAllowed,
  getTenisDayType,
} from "./utils/dateRules";
import { calculatePricing } from "./utils/pricing";
import AdminPanel from "./components/AdminPanel";

function App() {
  const [reservations, setReservations] = useState([]);
  const [closedSlots, setClosedSlots] = useState([]);

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
  const [adminUsername, setAdminUsername] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminRole, setAdminRole] = useState("");
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [adminSelectedDate, setAdminSelectedDate] = useState(getToday());

  const [closeCourt, setCloseCourt] = useState("salon");
  const [closeDate, setCloseDate] = useState(getToday());
  const [closeStart, setCloseStart] = useState("12:00");
  const [closeEnd, setCloseEnd] = useState("14:00");
  const [closeReason, setCloseReason] = useState("Kurs");

  const selectedCourtName =
    courtsSeed.find((court) => court.id === selectedCourt)?.name || "";

  const tennisDayType =
    selectedCourt === "tenis" && selectedTime
      ? getTenisDayType(selectedDate, selectedTime)
      : "";

  const { unitPrice, category, pricingType, dayType } = calculatePricing({
    selectedCourt,
    volleyLicense,
    tennisCategory,
    tennisDayType,
  });

  const totalPrice = Number(personCount || 0) * unitPrice;

  useEffect(() => {
    loadReservations();
    loadClosedSlots();
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

  async function loadClosedSlots() {
    const { data, error } = await supabase.from("closed_slots").select("*");

    if (error) {
      console.log(error.message);
      return;
    }

    setClosedSlots(data || []);
  }

  async function createClosedSlot() {
    const { error } = await supabase.from("closed_slots").insert({
      court_id: closeCourt,
      close_date: closeDate,
      start_time: closeStart,
      end_time: closeEnd,
      reason: closeReason,
    });

    if (error) {
      alert("Kapalı saat kaydedilemedi: " + error.message);
      return;
    }

    alert("Saat başarıyla kapatıldı.");
    loadClosedSlots();
  }

  async function deleteClosedSlot(id) {
    const { error } = await supabase
      .from("closed_slots")
      .delete()
      .eq("id", id);

    if (error) {
      alert("Kapalı saat silinemedi: " + error.message);
      return;
    }

    loadClosedSlots();
  }

  const reservedTimes = useMemo(() => {
    return reservations
      .filter(
        (reservation) =>
          reservation.court_id === selectedCourt &&
          reservation.reservation_date === selectedDate
      )
      .map((reservation) => reservation.reservation_time);
  }, [reservations, selectedCourt, selectedDate]);

 const closedTimes = useMemo(() => {
  return hours.filter((hour) => {
    const isVolleyCourseTime =
      selectedCourt === "salon" && hour < "18:00";

    const isManuallyClosed = closedSlots.some((slot) => {
      return (
        slot.court_id === selectedCourt &&
        slot.close_date === selectedDate &&
        hour >= slot.start_time &&
        hour <= slot.end_time
      );
    });

    return isVolleyCourseTime || isManuallyClosed;
  });
}, [closedSlots, selectedCourt, selectedDate]);

  const adminReservations = useMemo(() => {
    return reservations
      .filter(
        (reservation) => reservation.reservation_date === adminSelectedDate
      )
      .sort((a, b) => a.reservation_time.localeCompare(b.reservation_time));
  }, [reservations, adminSelectedDate]);

  const adminClosedSlots = useMemo(() => {
    return closedSlots
      .filter((slot) => slot.close_date === adminSelectedDate)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
  }, [closedSlots, adminSelectedDate]);

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

  async function deleteReservation(id) {
    const ok = confirm("Bu rezervasyonu silmek istediğinizden emin misiniz?");

    if (!ok) return;

    const { error } = await supabase
      .from("reservations")
      .delete()
      .eq("id", id);

    if (error) {
      alert("Rezervasyon silinemedi: " + error.message);
      return;
    }

    alert("Rezervasyon silindi.");
    loadReservations();
  }

  async function reserve() {
    if (!isDateAllowed(selectedCourt, selectedDate)) {
      if (selectedCourt === "salon") {
        alert(
          "Çok Amaçlı Salon için sadece içinde bulunulan haftaya rezervasyon yapılabilir."
        );
      } else {
        alert(
          "Tenis Kortu için sadece bugün, yarın ve sonraki gün rezervasyon yapılabilir."
        );
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

    if (closedTimes.includes(selectedTime)) {
      alert("Bu saat kapalı.");
      return;
    }
const normalizedName = name.trim().toLocaleUpperCase("tr-TR");

const sameDaySameNameReservations = reservations.filter((reservation) => {
  return (
    reservation.reservation_date === selectedDate &&
    reservation.court_id === selectedCourt &&
    reservation.full_name.trim().toLocaleUpperCase("tr-TR") === normalizedName
  );
});

if (selectedCourt === "salon" && sameDaySameNameReservations.length >= 1) {
  alert("Aynı kişi aynı gün Çok Amaçlı Salon için sadece 1 saat rezervasyon yapabilir.");
  return;
}

const currentHour = new Date().getHours();
const isAfterFivePm = currentHour >= 17;

if (
  selectedCourt === "tenis" &&
  !isAfterFivePm &&
  sameDaySameNameReservations.length >= 2
) {
  alert("Aynı kişi saat 17:00'ye kadar Tenis Kortu için aynı gün en fazla 2 saat rezervasyon yapabilir.");
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
    const users = {
      "EBRU.ERDEMIR": { password: "12345.eE", role: "full" },
      "SEVVAL.ATAHAN": { password: "12345.sA", role: "full" },
      "GUVENLIK": { password: "12345.tA", role: "readonly" },
    };

    const username = adminUsername
      .trim()
      .toLocaleUpperCase("tr-TR")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    const user = users[username];

    if (user && user.password === adminPassword) {
      setAdminOpen(true);
      setAdminRole(user.role);
      setAdminUsername("");
      setAdminPassword("");
    } else {
      alert("Kullanıcı adı veya parola yanlış.");
    }
  }

  function handleCourtChange(e) {
    const newCourt = e.target.value;
    setSelectedCourt(newCourt);
    setSelectedTime("");

    if (!isDateAllowed(newCourt, selectedDate)) {
      setSelectedDate(getToday());
    }
  }

  if (showAdminPanel) {
    return (
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: 20, fontFamily: "Arial" }}>
        <button
          onClick={() => setShowAdminPanel(false)}
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            border: "1px solid #ccc",
            background: "white",
            cursor: "pointer",
            marginBottom: 20,
          }}
        >
          ← Rezervasyon Sayfasına Dön
        </button>

        <AdminPanel
          adminOpen={adminOpen}
          adminRole={adminRole}
          adminUsername={adminUsername}
          adminPassword={adminPassword}
          setAdminUsername={setAdminUsername}
          setAdminPassword={setAdminPassword}
          setAdminOpen={setAdminOpen}
          setAdminRole={setAdminRole}
          loginAdmin={loginAdmin}
          closeCourt={closeCourt}
          setCloseCourt={setCloseCourt}
          closeDate={closeDate}
          setCloseDate={setCloseDate}
          closeStart={closeStart}
          setCloseStart={setCloseStart}
          closeEnd={closeEnd}
          setCloseEnd={setCloseEnd}
          closeReason={closeReason}
          setCloseReason={setCloseReason}
          createClosedSlot={createClosedSlot}
          adminSelectedDate={adminSelectedDate}
          setAdminSelectedDate={setAdminSelectedDate}
          adminClosedSlots={adminClosedSlots}
          adminReservations={adminReservations}
          deleteClosedSlot={deleteClosedSlot}
          deleteReservation={deleteReservation}
          openReceipt={openReceipt}
        />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 950, margin: "0 auto", padding: 20, fontFamily: "Arial" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          marginBottom: 24,
          textAlign: "left",
        }}
      >
        <img
          src="/logo.png"
          alt="Şehit Tolga Artuğ Gençlik Merkezi"
          style={{
            width: 95,
            height: 95,
            objectFit: "contain",
          }}
        />

        <div>
          <p
            style={{
              margin: 0,
              fontSize: 18,
              color: "#374151",
              fontWeight: "600",
            }}
          >
            Şehit Tolga Artuğ Gençlik Merkezi
          </p>

          <h1
            style={{
              margin: 0,
              fontSize: 44,
              lineHeight: 1.05,
            }}
          >
            Saha & Kort Rezervasyon
          </h1>
        </div>
      </div>

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

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3,1fr)",
          gap: 10,
          marginBottom: 30,
        }}
      >
        {hours.map((hour) => {
          const isReserved = reservedTimes.includes(hour);
          const isClosed = closedTimes.includes(hour);

          return (
            <button
              key={hour}
              disabled={isReserved || isClosed}
              onClick={() => setSelectedTime(hour)}
              style={{
                padding: 20,
                borderRadius: 10,
                border: "1px solid #ccc",
                background: isClosed
                  ? "#991b1b"
                  : isReserved
                  ? "#ddd"
                  : selectedTime === hour
                  ? "black"
                  : "white",
                color: selectedTime === hour || isClosed ? "white" : "black",
                cursor: isReserved || isClosed ? "not-allowed" : "pointer",
              }}
            >
              <div>{hour}</div>
              <div>{isClosed ? "KAPALI" : isReserved ? "DOLU" : "BOŞ"}</div>
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

          <p>
            <strong>Alıcı:</strong> {ALICI}
          </p>

          <div
            style={{
              background: "#000",
              padding: 12,
              borderRadius: 8,
              fontWeight: "bold",
              fontSize: 18,
              letterSpacing: 1,
              marginBottom: 10,
            }}
          >
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

      <div style={{ marginTop: 40, textAlign: "center" }}>
        <button
          onClick={() => setShowAdminPanel(true)}
          style={{
            padding: "12px 18px",
            background: "#111827",
            color: "white",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
          }}
        >
          Yönetici Paneli
        </button>
      </div>
    </div>
  );
}

export default App;