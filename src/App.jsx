import { useEffect, useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import { supabase } from "./supabase";
import { hours, IBAN, ALICI } from "./data/courts";

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

const normalizeReservationDate = (value) => String(value ?? "").slice(0, 10);
const normalizeReservationTime = (value) => String(value ?? "").slice(0, 5);
const normalizeCourtId = (value) => String(value ?? "").trim().toLocaleLowerCase("en-US");

const defaultAdminUsers =
  "EBRU.ERDEMIR:ebru.erdemir@saha-kort.local,SEVVAL.ATAHAN:sevval.atahan@saha-kort.local,GUVENLIK:guvenlik@saha-kort.local";
const adminUserMap = Object.fromEntries(
  (import.meta.env.VITE_ADMIN_USERS || defaultAdminUsers)
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [username, email] = entry.split(":").map((part) => part.trim());
      if (!username || !email) return null;

      return [
        username
          .toLocaleUpperCase("tr-TR")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, ""),
        email.toLocaleLowerCase("en-US"),
      ];
    })
    .filter(Boolean)
);

const sevvalAdminEmail =
  (import.meta.env.VITE_SEVVAL_EMAIL || "sevval.atahan@saha-kort.local").toLocaleLowerCase("en-US");

function App() {
  const [showPaymentNotice, setShowPaymentNotice] = useState(true);
  const paymentNoticeRef = useRef(null);

  useEffect(() => {
    if (showPaymentNotice) paymentNoticeRef.current?.showModal();
  }, [showPaymentNotice]);

  const reservationRequestId = useRef(0);
  const [reservations, setReservations] = useState([]);
  const [closedSlots, setClosedSlots] = useState([]);
  const [noShowCandidates, setNoShowCandidates] = useState([]);
  const [blacklistedPeople, setBlacklistedPeople] = useState([]);

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
  const [adminEmail, setAdminEmail] = useState("");
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [adminSelectedDate, setAdminSelectedDate] = useState(getToday());

  const [closeCourt, setCloseCourt] = useState("salon");
  const [closeDate, setCloseDate] = useState(getToday());
  const [closeStart, setCloseStart] = useState("12:00");
  const [closeEnd, setCloseEnd] = useState("14:00");
  const [closeReason, setCloseReason] = useState("Kurs");

  const tennisDayType =
    selectedCourt === "tenis" && selectedTime
      ? getTenisDayType(selectedDate, selectedTime)
      : "";

  const { unitPrice } = calculatePricing({
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

  async function loadReservations(role = "") {
    const requestId = ++reservationRequestId.current;
    const rpcName =
      role === "full"
        ? "get_admin_reservations"
        : role === "readonly"
          ? "get_security_reservations"
          : "get_reservations";
    const { data, error } = await supabase.rpc(rpcName);

    if (requestId !== reservationRequestId.current) return;

    if (error) {
      alert("Rezervasyonlar yüklenemedi: " + error.message);
      return;
    }

    setReservations(data || []);
  }

  async function loadNoShowCandidates() {
    const { data, error } = await supabase.rpc("get_no_show_candidates");

    if (error) {
      alert("Gelmeyen rezervasyonlar yüklenemedi: " + error.message);
      return;
    }

    setNoShowCandidates(data || []);
  }

  async function loadBlacklist() {
    const { data, error } = await supabase.rpc("get_no_show_blacklist");

    if (error) {
      alert("Kara liste yüklenemedi: " + error.message);
      return;
    }

    setBlacklistedPeople(data || []);
  }

  async function markReservationArrived(id) {
    const { error } = await supabase.rpc("mark_reservation_arrived", {
      p_reservation_id: String(id),
    });

    if (error) {
      alert("Geliş kaydedilemedi: " + error.message);
      return;
    }

    loadReservations("readonly");
  }

  async function addNoShowToBlacklist(id) {
    const { error } = await supabase.rpc("add_no_show_to_blacklist", {
      p_reservation_id: String(id),
    });

    if (error) {
      alert("Kara listeye eklenemedi: " + error.message);
      return;
    }

    loadNoShowCandidates();
    loadBlacklist();
  }

  async function removeNoShowFromBlacklist(phoneNumber) {
    const { error } = await supabase.rpc("remove_no_show_from_blacklist", {
      p_phone: phoneNumber,
    });

    if (error) {
      alert("Kara listeden çıkarılamadı: " + error.message);
      return;
    }

    loadBlacklist();
  }

  async function logoutAdmin() {
    await supabase.auth.signOut();
    setAdminOpen(false);
    setAdminRole("");
    setAdminEmail("");
    setNoShowCandidates([]);
    setBlacklistedPeople([]);
    loadReservations("");
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
    const { error } = await supabase.rpc("create_closed_slot", {
      p_court_id: closeCourt,
      p_close_date: closeDate,
      p_start_time: closeStart,
      p_end_time: closeEnd,
      p_reason: closeReason,
    });

    if (error) {
      alert("Kapalı saat kaydedilemedi: " + error.message);
      return;
    }

    alert("Saat başarıyla kapatıldı.");
    loadClosedSlots();
  }

  async function deleteClosedSlot(id) {
    const { error } = await supabase.rpc("delete_closed_slot", {
      p_closed_slot_id: String(id),
    });

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
          normalizeCourtId(reservation.court_id) === normalizeCourtId(selectedCourt) &&
          normalizeReservationDate(reservation.reservation_date) === selectedDate
      )
      .map((reservation) => normalizeReservationTime(reservation.reservation_time));
  }, [reservations, selectedCourt, selectedDate]);

 const closedTimes = useMemo(() => {
  return hours.filter((hour) => {
    const isVolleyCourseTime =
      selectedCourt === "salon" && hour < "18:00";

    const isManuallyClosed = closedSlots.some((slot) => {
      return (
        normalizeCourtId(slot.court_id) === normalizeCourtId(selectedCourt) &&
        normalizeReservationDate(slot.close_date) === selectedDate &&
        hour >= normalizeReservationTime(slot.start_time) &&
        hour <= normalizeReservationTime(slot.end_time)
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

    const { error } = await supabase.rpc("delete_reservation", {
      p_reservation_id: String(id),
    });

    if (error) {
      alert("Rezervasyon silinemedi: " + error.message);
      return;
    }

    alert("Rezervasyon silindi.");
    loadReservations(adminRole);
  }

  async function reserve() {
    if (!isDateAllowed(selectedCourt, selectedDate)) {
      if (selectedCourt === "salon") {
        alert(
          "Çok Amaçlı Salon için sadece içinde bulunulan haftaya rezervasyon yapılabilir."
        );
      } else {
        alert(
          "Tenis Kortu için sadece bugün, yarın için rezervasyon yapılabilir."
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


    if (closedTimes.includes(selectedTime)) {
      alert("Bu saat kapalı.");
      return;
    }
    if (reservedTimes.includes(selectedTime)) {
      alert("Bu saat dolu.");
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

    const { data: reservationResult, error } = await supabase.rpc(
      "create_reservation",
      {
        p_court_id: selectedCourt,
        p_reservation_date: selectedDate,
        p_reservation_time: selectedTime,
        p_full_name: name,
        p_phone: phone,
        p_person_count: Number(personCount),
        p_category: selectedCourt === "tenis" ? tennisCategory : volleyLicense,
        p_receipt_url: filePath,
        p_receipt_name: receiptFile.name,
      }
    );

    if (!error && reservationResult !== "ok") {
      const resultMessages = {
        invalid_contact: "Lütfen geçerli ad soyad ve telefon bilgisi giriniz.",
        invalid_date: "Seçilen tarih için rezervasyon yapılamaz.",
        invalid_court: "Seçilen tesis geçersiz.",
        invalid_category: "Seçilen kategori geçersiz.",
        invalid_reservation: "Rezervasyon bilgileri geçersiz.",
        slot_taken: "Bu saat dolu.",
        slot_closed: "Bu saat kapalı.",
        reservation_limit:
          "Bu kişi için aynı tesis ve tarihteki rezervasyon sınırına ulaşıldı.",
      };
      alert(resultMessages[reservationResult] || "Rezervasyon oluşturulamadı.");
      return;
    }

    if (error) {
      if (error.code === "23505") {
        alert(
          "Bu saat az önce başka bir kullanıcı tarafından rezerve edildi. Lütfen başka bir saat seçiniz."
        );
      } else {
        alert("Rezervasyon kaydedilemedi. Lütfen tekrar deneyiniz.");
      }
      return;
    }

    alert("Rezervasyonunuz oluşturulmuştur.");

    setSelectedTime("");
    setName("");
    setPhone("");
    setPersonCount(1);
    setReceiptFile(null);

    await loadReservations(adminRole);
  }

   async function loginAdmin() {
    const username = adminUsername
      .trim()
      .toLocaleUpperCase("tr-TR")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    const email = adminUserMap[username];

    if (!email || !adminPassword) {
      alert("Kullanıcı adı veya parola yanlış.");
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: adminPassword,
    });

    if (error || !data.user) {
      alert("Kullanıcı adı veya parola yanlış.");
      return;
    }

    const role = data.user.app_metadata?.role;

    if (role !== "full" && role !== "readonly") {
      await supabase.auth.signOut();
      alert("Bu hesabın yönetici yetkisi bulunmuyor.");
      return;
    }

    setAdminOpen(true);
    setAdminRole(role);
    setAdminEmail((data.user.email || "").toLocaleLowerCase("en-US"));
    setAdminUsername("");
    setAdminPassword("");
    await loadReservations(role);

    if ((data.user.email || "").toLocaleLowerCase("en-US") === sevvalAdminEmail) {
      await Promise.all([loadNoShowCandidates(), loadBlacklist()]);
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
          isSevval={adminEmail === sevvalAdminEmail}
          adminUsername={adminUsername}
          adminPassword={adminPassword}
          setAdminUsername={setAdminUsername}
          setAdminPassword={setAdminPassword}
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
          markReservationArrived={markReservationArrived}
          noShowCandidates={noShowCandidates}
          blacklistedPeople={blacklistedPeople}
          addNoShowToBlacklist={addNoShowToBlacklist}
          removeNoShowFromBlacklist={removeNoShowFromBlacklist}
          logoutAdmin={logoutAdmin}
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
      {showPaymentNotice && (
        <>
          <style>{`
            .payment-notice::backdrop { background: rgba(15, 23, 42, 0.45); }
          `}</style>
          <dialog
            ref={paymentNoticeRef}
            className="payment-notice"
            aria-labelledby="payment-notice-title"
            aria-describedby="payment-notice-description"
            onCancel={() => setShowPaymentNotice(false)}
            style={{
              width: "calc(100% - 32px)",
              maxWidth: 480,
              maxHeight: "calc(100dvh - 32px)",
              boxSizing: "border-box",
              margin: "auto",
              padding: "56px 24px 24px",
              border: "none",
              borderRadius: 16,
              background: "#fff",
              color: "#0f172a",
              boxShadow: "0 20px 60px rgba(0, 0, 0, 0.25)",
              textAlign: "center",
              lineHeight: 1.6,
              overflowY: "auto",
            }}
          >
            <button
              type="button"
              aria-label="Bilgilendirmeyi kapat"
              onClick={() => setShowPaymentNotice(false)}
              style={{
                position: "absolute",
                top: 8,
                right: 8,
                width: 44,
                height: 44,
                border: "none",
                borderRadius: 8,
                background: "#f1f5f9",
                color: "#334155",
                fontSize: 22,
                cursor: "pointer",
              }}
            >
              X
            </button>
            <h2
              id="payment-notice-title"
              style={{ color: "#92400e", fontSize: "clamp(18px, 4.5vw, 22px)", lineHeight: 1.4, margin: "0 0 20px", fontWeight: 700 }}
            >
              ⚠️ ÖNEMLİ ÖDEME BİLGİLENDİRMESİ
            </h2>
            <div id="payment-notice-description" style={{ fontSize: 16 }}>
              <p>Banka açıklama kısmına mutlaka aşağıdaki bilgileri yazınız:</p>
              <strong
                style={{ display: "block", margin: "20px 0", padding: 16, borderRadius: 10, border: "1px solid #f59e0b", background: "#fffbeb", color: "#92400e", fontSize: 18, fontWeight: 800 }}
              >
                Ad Soyad + Tesis Adı + Tarih + Saat
              </strong>
              <p>Lütfen ödeme yaparken bu bilgileri eksiksiz belirtiniz.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowPaymentNotice(false)}
              style={{ width: "100%", marginTop: 24, padding: "12px 20px", border: "none", borderRadius: 10, background: "#0b2f6b", color: "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer" }}
            >
              Anladım
            </button>
          </dialog>
        </>
      )}
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
          : "Tenis Kortu için sadece bugün ve yarın rezervasyon yapılabilir."}
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
