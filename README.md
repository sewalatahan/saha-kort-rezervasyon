# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Aynı saate çift rezervasyon düzeltmesi

`supabase/migrations/20261010000000_prevent_duplicate_reservations.sql` dosyasını
Supabase SQL Editor üzerinden çalıştırın (önceki migration'lar uygulanmış olmalı).
Saat kontrolü `21:00` ve `21:00:00` değerlerini aynı saat olarak karşılaştırır.
Ayrı, erişimi kısıtlı bir saat tablosunun birincil anahtarı ve rezervasyon
trigger'ları eşzamanlı kayıtların aynı tesis/tarih/saati almasını engeller.
Mevcut çift kayıtlar silinmez; son kayıt kaldırılana kadar saat dolu kalır.
Arayüz değişikliği için yeni deployment gerekir.

Mevcut çakışmaları yalnızca yetkili SQL Editor'de incelemek için:

```sql
SELECT court_id, reservation_date::date AS reservation_date,
       reservation_time::time AS reservation_time, count(*) AS reservation_count
FROM public.reservations
GROUP BY court_id, reservation_date::date, reservation_time::time
HAVING count(*) > 1;
```

Hangi rezervasyonun korunacağı kontrol edilerek yönetici panelinden çözülmelidir.
