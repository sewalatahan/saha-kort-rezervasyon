import React, { useEffect, useMemo, useState } from "react";
import JSZip from "jszip";
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
import FacilityCard from "./components/FacilityCard";

function App() {
  const [reservations, setReservations] = useState([]);
  const [closedSlots, setClosedSlots] = useState([]);

  const [selectedCourt, setSelectedCourt] = useState("tenis");
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
  const isStudentReservation =
    (selectedCourt === "tenis" && tennisCategory === "ogrenci") ||
    (selectedCourt === "salon" && volleyLicense === "ogrenci");
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

  async function downloadReceipts(receiptPaths) {
    if (!receiptPaths || receiptPaths.length === 0) {
      alert("İndirilecek dekont bulunamadı.");
      return;
    }

    const zip = new JSZip();
    let addedFileCount = 0;

    for (const path of receiptPaths) {
      const { data, error } = await supabase.storage
        .from("dekontlar")
        .createSignedUrl(path, 60);

      if (error) {
        console.log("Dekont indirilemedi:", path, error.message);
        continue;
      }

      try {
        const response = await fetch(data.signedUrl);

        if (!response.ok) {
          console.log("Dekont indirilemedi:", path, response.status);
          continue;
        }

        const blob = await response.blob();
        const fileName = path.split("/").pop() || `dekont-${addedFileCount + 1}`;
        zip.file(fileName, blob);
        addedFileCount += 1;
      } catch (error) {
        console.log("Dekont ZIP'e eklenemedi:", path, error);
      }
    }

    if (addedFileCount === 0) {
      alert("ZIP dosyasına eklenecek dekont bulunamadı.");
      return;
    }

    const zipBlob = await zip.generateAsync({ type: "blob" });
    const zipUrl = URL.createObjectURL(zipBlob);
    const link = document.createElement("a");
    link.href = zipUrl;
    link.download = "dekontlar.zip";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(zipUrl);
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

    if (!selectedTime) {
      alert("Lütfen yukarıdaki BOŞ saat kutularından birine tıklayınız. Seçilen saat siyah renkte görünmelidir.");
      return;
    }

    if (!name.trim()) {
      alert("Lütfen ad soyad bilgisini giriniz.");
      return;
    }

    if (!phone.trim()) {
      alert("Lütfen telefon numarası bilgisini giriniz.");
      return;
    }

    if (!personCount || Number(personCount) < 1) {
      alert("Lütfen kişi sayısını giriniz.");
      return;
    }


    const { data: selectedSlotReservations, error: selectedSlotError } = await supabase
      .from("reservations")
      .select("id")
      .eq("reservation_date", selectedDate)
      .eq("court_id", selectedCourt)
      .eq("reservation_time", selectedTime);

    if (selectedSlotError) {
      alert("Saat doluluk kontrolü yapılamadı: " + selectedSlotError.message);
      return;
    }

    if ((selectedSlotReservations || []).length > 0) {
      alert("Bu saat dolu.");
      return;
    }

    if (closedTimes.includes(selectedTime)) {
      alert("Bu saat kapalı.");
      return;
    }
const normalizePersonName = (value) =>
  String(value || "")
    .trim()
    .toLocaleUpperCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");

const normalizePhone = (value) => {
  const digits = String(value || "").replace(/\D/g, "");

  if (digits.startsWith("90") && digits.length === 12) {
    return digits.slice(2);
  }

  if (digits.startsWith("0") && digits.length === 11) {
    return digits.slice(1);
  }

  if (digits.length > 10) {
    return digits.slice(-10);
  }

  return digits;
};

const normalizedName = normalizePersonName(name);
const normalizedPhone = normalizePhone(phone);

const { data: latestSameDayReservations, error: sameDayError } = await supabase
  .from("reservations")
  .select("id, full_name, phone, reservation_date, reservation_time, court_id")
  .eq("reservation_date", selectedDate)
  .eq("court_id", selectedCourt);

if (sameDayError) {
  alert("Rezervasyon kontrolü yapılamadı: " + sameDayError.message);
  return;
}

const sameDaySamePersonReservations = (latestSameDayReservations || []).filter(
  (reservation) => {
    const reservationName = normalizePersonName(reservation.full_name);
    const reservationPhone = normalizePhone(reservation.phone);

    return reservationName === normalizedName || reservationPhone === normalizedPhone;
  }
);

if (selectedCourt === "salon" && sameDaySamePersonReservations.length >= 1) {
  alert("Aynı kişi aynı gün Çok Amaçlı Salon için sadece 1 saat rezervasyon yapabilir.");
  return;
}

if (
  selectedCourt === "tenis" &&
  tennisCategory === "ogrenci" &&
  sameDaySamePersonReservations.length >= 1
) {
  alert("Tenis Kortu için aynı gün sadece 1 saat rezervasyon yapılabilir.");
  return;
}

const isToday = selectedDate === getToday();
const currentHour = new Date().getHours();
const isAfterFivePm = currentHour >= 17;
const adultTenisLimit = isToday && isAfterFivePm ? 3 : 2;

if (
  selectedCourt === "tenis" &&
  tennisCategory === "yetiskin" &&
  sameDaySamePersonReservations.length >= adultTenisLimit
) {
  alert(
    isToday && isAfterFivePm
      ? "Aynı kişi bugün saat 17:00'den sonra Tenis Kortu için en fazla 3 saat rezervasyon yapabilir."
      : "Aynı kişi Tenis Kortu için aynı gün en fazla 2 saat rezervasyon yapabilir."
  );
  return;
}

    if (!receiptFile) {
      alert(
        isStudentReservation
          ? "Lütfen öğrenci belgesi veya öğrenci kartı fotoğrafı yükleyiniz."
          : "Lütfen ödeme dekontunu yükleyiniz."
      );
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

  const tennisIcon = (
    <svg width="48" height="48" viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <ellipse cx="36" cy="22" rx="14" ry="18" transform="rotate(38 36 22)" stroke="currentColor" strokeWidth="3" />
      <path d="M26 32L10 49" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      <path d="M19 42L13 48" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
      <path d="M28 14C35 18 41 24 45 31" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M22 20C30 24 36 30 40 37" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M36 7C32 16 27 24 19 30" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M45 15C39 24 33 31 26 38" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="46" cy="47" r="5" stroke="currentColor" strokeWidth="3" />
      <path d="M43 47H49" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M46 44V50" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );

  const salonIcon = (
    <svg width="48" height="48" viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <path d="M10 51V21C10 12 20 7 32 7C44 7 54 12 54 21V51" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M14 30H50" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M17 25C22 31 42 31 47 25" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M18 36H46" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M22 30V42" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M30 30V42" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M38 30V42" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M46 30V42" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M18 42H46" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );

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
          reservations={reservations}
          downloadReceipts={downloadReceipts}
          deleteClosedSlot={deleteClosedSlot}
          deleteReservation={deleteReservation}
          openReceipt={openReceipt}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        maxWidth: 1050,
        margin: "0 auto",
        padding: "28px 20px",
        fontFamily: "Arial",
        color: "#0f172a",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 18,
          marginBottom: 28,
          textAlign: "left",
          borderBottom: "2px solid #1d4ed8",
          paddingBottom: 18,
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
              fontSize: 42,
              lineHeight: 1.05,
              color: "#0b2f6b",
            }}
          >
            Saha & Kort Rezervasyon
          </h1>
        </div>
      </div>

      <div
        style={{
          marginBottom: 24,
          padding: 22,
          borderRadius: 12,
          border: "1px solid #dbe3ef",
          background: "#ffffff",
          boxShadow: "0 8px 24px rgba(15, 23, 42, 0.08)",
        }}
      >
        <div style={{ marginBottom: 18 }}>
          <h2
            style={{
              margin: 0,
              fontSize: 22,
              color: "#0b2f6b",
              letterSpacing: 0.3,
              textTransform: "uppercase",
            }}
          >
            Tesis Seçimi
          </h2>
          <p style={{ margin: "6px 0 0", color: "#475569", fontSize: 15 }}>
            Rezervasyon yapmak istediğiniz tesisi ve tarihi seçin.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: 14,
            marginBottom: 20,
          }}
        >
          <FacilityCard
            title="Tenis Kortu"
            description="Tenis kortu rezervasyonu yapın."
            icon={tennisIcon}
            iconColor="#0b5ed7"
            isSelected={selectedCourt === "tenis"}
            onClick={() => handleCourtChange({ target: { value: "tenis" } })}
          />

          <FacilityCard
            title="Çok Amaçlı Salon / Voleybol"
            description="Salon rezervasyonu yapın."
            icon={salonIcon}
            iconColor="#475569"
            isSelected={selectedCourt === "salon"}
            onClick={() => handleCourtChange({ target: { value: "salon" } })}
          />
        </div>

        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <label style={{ fontWeight: "bold", color: "#0b2f6b", fontSize: 15 }}>
            Tarih
          </label>
          <input
            type="date"
            value={selectedDate}
            min={selectedCourt === "tenis" ? getToday() : getWeekRange().start}
            max={selectedCourt === "tenis" ? getMaxTenisDate() : getWeekRange().end}
            onChange={(e) => {
              setSelectedDate(e.target.value);
              setSelectedTime("");
            }}
            style={{
              fontSize: 18,
              padding: "10px 14px",
              borderRadius: 8,
              border: "1px solid #b7c7e6",
              background: "#ffffff",
              color: "#0f172a",
              outline: "none",
            }}
          />
        </div>
      </div>

      <div
        style={{
          marginBottom: 18,
          padding: "12px 14px",
          borderRadius: 8,
          border: "1px solid #bfdbfe",
          background: "#eff6ff",
          color: "#0b2f6b",
          fontSize: 15,
        }}
      >
        {selectedCourt === "salon"
          ? "Çok Amaçlı Salon için sadece bulunduğunuz hafta içinde rezervasyon yapılabilir."
          : "Tenis Kortu için sadece bugün, yarın ve sonraki gün rezervasyon yapılabilir."}
      </div>

      <h3 style={{ color: "#0b2f6b", marginBottom: 12 }}>Uygun Saatler</h3>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3,1fr)",
          gap: 12,
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
                padding: "18px 12px",
                borderRadius: 8,
                border: isClosed
                  ? "1px solid #fecaca"
                  : isReserved
                  ? "1px solid #d1d5db"
                  : selectedTime === hour
                  ? "2px solid #1d4ed8"
                  : "1px solid #dbe3ef",
                background: isClosed
                  ? "#fef2f2"
                  : isReserved
                  ? "#e5e7eb"
                  : selectedTime === hour
                  ? "#eff6ff"
                  : "#ffffff",
                color: isClosed
                  ? "#dc2626"
                  : isReserved
                  ? "#374151"
                  : selectedTime === hour
                  ? "#1d4ed8"
                  : "#0b2f6b",
                cursor: isReserved || isClosed ? "not-allowed" : "pointer",
                fontWeight: "bold",
                boxShadow: "0 4px 12px rgba(15, 23, 42, 0.04)",
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
        <p style={{ fontWeight: "bold", color: selectedTime ? "#111827" : "#991b1b" }}>
          Seçilen Saat: {selectedTime || "Henüz saat seçilmedi"}
        </p>

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

            <label style={{ marginRight: 20 }}>
              <input
                type="radio"
                checked={volleyLicense === "lisansli"}
                onChange={() => setVolleyLicense("lisansli")}
              />
              {" "}Lisanslı kişi başı 25 TL
            </label>

            <label>
              <input
                type="radio"
                checked={volleyLicense === "ogrenci"}
                onChange={() => setVolleyLicense("ogrenci")}
              />
              {" "}Öğrenci ücretsiz
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

          {isStudentReservation && (
            <p style={{ fontSize: 14, lineHeight: 1.6 }}>
              Öğrenci rezervasyonları ücretsizdir. Dekont yerine öğrenci belgesi veya öğrenci kartı fotoğrafı yükleyebilirsiniz.
            </p>
          )}

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

          <div style={{ marginTop: 12, marginBottom: 12 }}>
            <button onClick={copyIban}>IBAN Kopyala</button>
          </div>

          <a
            href="/SahaUcret_Tablo.pdf"
            target="_blank"
            rel="noreferrer"
            style={{
              display: "inline-block",
              marginBottom: 12,
              color: "#60a5fa",
              fontWeight: "bold",
              textDecoration: "none",
            }}
          >
            Tesis Kullanım Şartları ve Ücretlendirme Bilgileri (PDF)
          </a>
          <p style={{ fontSize: 14, lineHeight: 1.6 }}>
            Banka açıklama kısmına mutlaka:
            <br />
            <strong>Ad Soyad + Tesis Adı + Tarih + Saat</strong>
            <br />
            bilgilerini yazınız.
          </p>
        </div>

        <label>
          {isStudentReservation
            ? "Öğrenci Belgesi / Öğrenci Kartı Fotoğrafı Yükle:"
            : "Dekont Yükle:"}
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