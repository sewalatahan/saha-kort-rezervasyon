export function calculatePricing({
  selectedCourt,
  volleyLicense,
  tennisCategory,
  tennisDayType,
}) {
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

  return {
    unitPrice,
    category,
    pricingType,
    dayType,
  };
}