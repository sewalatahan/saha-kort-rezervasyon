function FacilityCard({
  title,
  description,
  icon,
  isSelected,
  onClick,
  iconColor = "#0b5ed7",
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        position: "relative",
        minHeight: 120,
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 14,
        padding: "18px 20px",
        borderRadius: 10,
        border: isSelected ? "2px solid #1d4ed8" : "1px solid #cbd5e1",
        background: isSelected ? "#eff6ff" : "#ffffff",
        color: "#0f172a",
        cursor: "pointer",
        textAlign: "left",
        boxShadow: isSelected
          ? "0 8px 18px rgba(29, 78, 216, 0.12)"
          : "0 4px 12px rgba(15, 23, 42, 0.04)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          paddingRight: 96,
          minWidth: 0,
        }}
      >
        <div
          style={{
            width: 54,
            height: 54,
            display: "grid",
            placeItems: "center",
            color: iconColor,
            flexShrink: 0,
          }}
        >
          {icon}
        </div>

        <div>
          <div style={{ fontSize: 18, fontWeight: "bold", lineHeight: 1.2 }}>
            {title}
          </div>
          <div style={{ color: "#64748b", marginTop: 4, fontSize: 14 }}>
            {description}
          </div>
        </div>
      </div>

      {isSelected && (
        <div
          style={{
            position: "absolute",
            right: 12,
            top: "50%",
            transform: "translateY(-50%)",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span
            style={{
              padding: "6px 9px",
              borderRadius: 6,
              background: "#1d4ed8",
              color: "white",
              fontWeight: "bold",
              fontSize: 13,
            }}
          >
            Seçili
          </span>

          <span
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              display: "grid",
              placeItems: "center",
              background: "#1d4ed8",
              color: "white",
              fontWeight: "bold",
            }}
          >
            ✓
          </span>
        </div>
      )}
    </button>
  );
}

export default FacilityCard;