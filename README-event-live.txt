YurLaps Event + Community Live (12 November 2026)

1. Website: ekstrak YurLaps-website-event-live.zip ke root repository yurlaps-web. Commit dan push.
2. Supabase SQL Editor: jalankan berurutan isi:
   supabase/migrations/20261112090000_club_events.sql
   supabase/migrations/20261112110000_club_live.sql
   Mengunggah file SQL ke GitHub tidak otomatis menjalankannya di database.
3. Aplikasi: ekstrak YurLaps-application-event-live.zip ke root repository Yurlapsss. Commit dan push, lalu build Windows melalui GitHub Actions.
4. Login di aplikasi sebagai leader club yang sama. Event dari website masuk lewat sinkronisasi otomatis sekitar tiap 15 detik; tombol "Ambil dari website" memicu sync segera.
5. Community > club > Live menampilkan Event Race, Quick Race, lalu Practice. Layar penuh tersedia. Jika kiriman terhenti lebih dari 15 detik, layar menampilkan status offline. Practice publik memakai Mobil 1, Mobil 2, dst. tanpa identitas akun atau transponder.

Catatan: belum ada uji end-to-end terhadap Supabase produksi dan decoder Windows fisik. Tes lokal Event/Live dan build website lulus.
